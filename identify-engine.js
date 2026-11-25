/**
 * MP3aud.io Client-Side Song Identification & Local Tag Engine
 * Computes Chromaprint audio fingerprints locally in a WASM Web Worker,
 * queries AcoustID directly from the browser (POST CORS with JSONP fallback),
 * enriches metadata/artwork via iTunes Search, and reads local ID3v2 tags.
 * Zero audio or metadata load hits the Render backend.
 */
(function (global) {
    'use strict';

    const DEFAULT_ACOUSTID_CLIENT_KEY = 'MTVnNF4Ow5';
    const MAX_FINGERPRINT_SECONDS = 120;
    const MIN_SCORE = 0.50;
    const RATE_LIMIT_GAP_MS = 400;

    let fpQueue = Promise.resolve();
    let acoustQueue = Promise.resolve();
    let lastAcoustRequestAt = 0;

    let fpWorker = null;
    let fpWorkerUrl = null;
    let nextWorkerReqId = 1;
    const pendingWorkerReqs = new Map();

    function isGenericTrackTitle(title) {
        const s = String(title || '').trim();
        if (!s) return true;
        if (/^(track|recording|clip|audio|song|untitled|unknown(\s+track)?|capture|rec|voice\s*memo|mix|output|download|videoplayback|imported\s*track)\s*([\-_#]?\s*\d+|\(\d+\))?$/i.test(s)) {
            return true;
        }
        if (/^\d{4}[-_]\d{2}[-_]\d{2}(?:[T _-]\d{2}[-_:]?\d{2}(?:[-_:]?\d{2})?)?$/.test(s)) {
            return true;
        }
        return false;
    }

    function resolveVendorAssetUrls() {
        const base = (global.document && global.document.baseURI) || (global.location && global.location.href) || 'http://127.0.0.1/';
        let jsUrl = '';
        let wasmUrl = '';
        try {
            jsUrl = new URL('vendor/chromaprint_web.js', base).href;
            wasmUrl = new URL('vendor/chromaprint_web_bg.wasm', base).href;
        } catch (_) {
            const origin = (global.location && global.location.origin) || '';
            jsUrl = `${origin}/vendor/chromaprint_web.js`;
            wasmUrl = `${origin}/vendor/chromaprint_web_bg.wasm`;
        }
        return { jsUrl, wasmUrl };
    }

    function buildMonoPcmWindow(leftInt16, rightInt16, sampleRate) {
        const lenL = leftInt16 ? leftInt16.length : 0;
        const lenR = rightInt16 ? rightInt16.length : 0;
        const totalLen = Math.min(lenL, lenR || lenL);
        const sr = Math.max(8000, Math.round(sampleRate || 44100));
        const duration = Math.max(1, Math.round(totalLen / sr));
        if (totalLen === 0) {
            return { mono: new Int16Array(0), effectiveRate: sr, duration: 0 };
        }

        const windowLen = Math.min(totalLen, Math.round(sr * MAX_FINGERPRINT_SECONDS));
        const step = sr > 65535 ? Math.ceil(sr / 44100) : 1;
        const effectiveRate = Math.floor(sr / step);
        const outLen = Math.floor(windowLen / step);
        const mono = new Int16Array(outLen);

        for (let i = 0, src = 0; i < outLen; i++, src += step) {
            const l = leftInt16[src] || 0;
            const r = rightInt16 && src < lenR ? rightInt16[src] : l;
            mono[i] = (l + r) >> 1;
        }

        return { mono, effectiveRate, duration };
    }

    let classicAssetPromise = null;

    function loadClassicWorkerAssets(jsUrl, wasmUrl) {
        if (classicAssetPromise) return classicAssetPromise;
        classicAssetPromise = (async () => {
            const [jsResp, wasmResp] = await Promise.all([fetch(jsUrl), fetch(wasmUrl)]);
            if (!jsResp.ok) throw new Error(`Failed to fetch chromaprint_web.js (${jsResp.status})`);
            if (!wasmResp.ok) throw new Error(`Failed to fetch chromaprint_web_bg.wasm (${wasmResp.status})`);
            const [jsText, wasmBuf] = await Promise.all([jsResp.text(), wasmResp.arrayBuffer()]);
            const patchedJs = jsText
                .replace(/\/\*[\s\S]*?\*\//, '')
                .replace(/\bimport\.meta\.url\b/g, JSON.stringify(wasmUrl))
                .replace(/export\s+function\s+fingerprint\b/, 'function fingerprint')
                .replace(/export\s*\{[\s\S]*?\}\s*;?/g, '');
            const wasmMod = await WebAssembly.compile(wasmBuf);
            return { patchedJs, wasmMod };
        })().catch((err) => {
            classicAssetPromise = null;
            throw err;
        });
        return classicAssetPromise;
    }

    function getFingerprintWorker(patchedJs) {
        if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined') {
            return null;
        }
        if (fpWorker) return fpWorker;

        const workerCode = `
${patchedJs}
let initedMod = null;
self.onmessage = function (ev) {
    const { id, wasmMod, sampleRate, buffer } = ev.data || {};
    try {
        if (!initedMod || initedMod !== wasmMod) {
            initSync({ module: wasmMod });
            initedMod = wasmMod;
        }
        const samples = new Int16Array(buffer);
        const fp = fingerprint(sampleRate, samples);
        self.postMessage({ id, ok: true, fingerprint: fp });
    } catch (err) {
        self.postMessage({ id, ok: false, error: (err && err.message) || String(err) });
    }
};
        `;

        try {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            fpWorkerUrl = URL.createObjectURL(blob);
            fpWorker = new Worker(fpWorkerUrl);

            fpWorker.onmessage = (ev) => {
                const { id, ok, fingerprint: fp, error } = ev.data || {};
                const pending = pendingWorkerReqs.get(id);
                if (!pending) return;
                pendingWorkerReqs.delete(id);
                if (ok && fp) pending.resolve(fp);
                else pending.reject(new Error(error || 'Chromaprint worker failed'));
            };

            fpWorker.onerror = (ev) => {
                const err = new Error((ev && ev.message) || 'Chromaprint worker error');
                for (const [, p] of pendingWorkerReqs) {
                    p.reject(err);
                }
                pendingWorkerReqs.clear();
                try { fpWorker.terminate(); } catch (_) { }
                fpWorker = null;
                if (fpWorkerUrl) {
                    try { URL.revokeObjectURL(fpWorkerUrl); } catch (_) { }
                    fpWorkerUrl = null;
                }
            };
            return fpWorker;
        } catch (_) {
            fpWorker = null;
            return null;
        }
    }

    async function computeFingerprintInWorker(mono, effectiveRate, jsUrl, wasmUrl) {
        const { patchedJs, wasmMod } = await loadClassicWorkerAssets(jsUrl, wasmUrl);
        const worker = getFingerprintWorker(patchedJs);
        if (!worker) throw new Error('Web Worker unavailable');

        const copy = new Int16Array(mono);
        const id = nextWorkerReqId++;
        return new Promise((resolve, reject) => {
            let settled = false;
            const startupTimer = setTimeout(() => {
                if (settled) return;
                settled = true;
                pendingWorkerReqs.delete(id);
                reject(new Error('Chromaprint worker timeout'));
            }, 15000);

            pendingWorkerReqs.set(id, {
                resolve: (val) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(startupTimer);
                    resolve(val);
                },
                reject: (err) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(startupTimer);
                    reject(err);
                }
            });
            try {
                worker.postMessage(
                    { id, wasmMod, sampleRate: effectiveRate, buffer: copy.buffer },
                    [copy.buffer]
                );
            } catch (err) {
                if (!settled) {
                    settled = true;
                    clearTimeout(startupTimer);
                    pendingWorkerReqs.delete(id);
                    reject(err);
                }
            }
        });
    }

    let mainModPromise = null;
    async function computeFingerprintMainThread(mono, effectiveRate, jsUrl, wasmUrl) {
        if (!mainModPromise) {
            mainModPromise = (async () => {
                const mod = await import(jsUrl);
                await mod.default({ module_or_path: wasmUrl });
                return mod.fingerprint;
            })().catch((err) => {
                mainModPromise = null;
                throw err;
            });
        }
        const fpFn = await mainModPromise;
        return fpFn(effectiveRate, mono);
    }

    function computeFingerprint(leftInt16, rightInt16, sampleRate = 44100) {
        const { mono, effectiveRate, duration } = buildMonoPcmWindow(leftInt16, rightInt16, sampleRate);
        if (mono.length === 0) {
            return Promise.reject(new Error('Cannot fingerprint empty audio slice'));
        }
        const { jsUrl, wasmUrl } = resolveVendorAssetUrls();

        const task = fpQueue.then(async () => {
            let fp = '';
            try {
                fp = await computeFingerprintInWorker(mono, effectiveRate, jsUrl, wasmUrl);
            } catch (_) {
                fp = await computeFingerprintMainThread(mono, effectiveRate, jsUrl, wasmUrl);
            }
            return { fingerprint: String(fp || ''), duration };
        });

        fpQueue = task.catch(() => {});
        return task;
    }

    function lookupAcoustIdJsonp(urlParams) {
        return new Promise((resolve, reject) => {
            if (typeof document === 'undefined' || !document.head) {
                reject(new Error('Document unavailable for JSONP fallback'));
                return;
            }
            const cbName = `__mp3audioAcoustId_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
            const params = new URLSearchParams(urlParams);
            params.set('format', 'jsonp');
            params.set('jsoncallback', cbName);

            const script = document.createElement('script');
            let settled = false;
            const cleanup = () => {
                try { delete global[cbName]; } catch (_) { global[cbName] = undefined; }
                if (script.parentNode) script.parentNode.removeChild(script);
            };
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error('AcoustID JSONP timeout'));
            }, 10000);

            global[cbName] = (data) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cleanup();
                resolve(data);
            };

            script.onerror = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cleanup();
                reject(new Error('AcoustID JSONP network error'));
            };

            script.src = `https://api.acoustid.org/v2/lookup?${params.toString()}`;
            document.head.appendChild(script);
        });
    }

    function lookupAcoustId(fingerprint, duration, clientKey = DEFAULT_ACOUSTID_CLIENT_KEY) {
        const key = String(clientKey || DEFAULT_ACOUSTID_CLIENT_KEY).trim();
        const dur = Math.max(1, Math.round(duration || 1));
        const fp = String(fingerprint || '').trim();
        if (!fp) return Promise.reject(new Error('Empty fingerprint'));

        const task = acoustQueue.then(async () => {
            const elapsed = Date.now() - lastAcoustRequestAt;
            if (elapsed < RATE_LIMIT_GAP_MS) {
                await new Promise(r => setTimeout(r, RATE_LIMIT_GAP_MS - elapsed));
            }
            lastAcoustRequestAt = Date.now();

            const formParams = {
                client: key,
                meta: 'recordings releasegroups',
                duration: String(dur),
                fingerprint: fp,
                format: 'json'
            };

            try {
                const controller = typeof AbortController === 'function' ? new AbortController() : null;
                const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
                try {
                    const resp = await fetch('https://api.acoustid.org/v2/lookup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams(formParams).toString(),
                        signal: controller ? controller.signal : undefined
                    });
                    if (resp.ok || resp.status === 400) {
                        const data = await resp.json();
                        if (data && typeof data === 'object') return data;
                    }
                } finally {
                    if (timer) clearTimeout(timer);
                }
            } catch (_) {
                // Fall back to JSONP if fetch fails due to CORS or network proxy
            }

            return await lookupAcoustIdJsonp(formParams);
        });

        acoustQueue = task.catch(() => {});
        return task;
    }

    function joinAcoustIdArtists(artists) {
        if (!Array.isArray(artists) || artists.length === 0) return '';
        let out = '';
        for (let i = 0; i < artists.length; i++) {
            const a = artists[i];
            const nm = a && a.name ? String(a.name).trim() : '';
            if (!nm) continue;
            out += nm;
            if (i < artists.length - 1) {
                out += (typeof a.joinphrase === 'string') ? a.joinphrase : ', ';
            }
        }
        return out.trim();
    }

    function pickBestAlbumFromReleaseGroups(releasegroups) {
        if (!Array.isArray(releasegroups) || releasegroups.length === 0) {
            return { album: '', releaseGroupId: '', isPrimaryAlbum: false };
        }
        let best = null;
        let bestRank = -1;
        for (const rg of releasegroups) {
            if (!rg || !rg.title) continue;
            const sec = Array.isArray(rg.secondarytypes) ? rg.secondarytypes.map(s => String(s).toLowerCase()) : [];
            const isComp = sec.includes('compilation') || sec.includes('live') || sec.includes('remix');
            const isAlbum = String(rg.type || '').toLowerCase() === 'album';
            const rank = (isAlbum ? 4 : 1) + (isComp ? 0 : 2);
            if (rank > bestRank) {
                bestRank = rank;
                best = rg;
            }
        }
        return best
            ? {
                album: String(best.title || '').trim(),
                releaseGroupId: String(best.id || ''),
                isPrimaryAlbum: String(best.type || '').toLowerCase() === 'album' && bestRank >= 6
            }
            : { album: '', releaseGroupId: '', isPrimaryAlbum: false };
    }

    function pickBestAcoustIdMatch(data, minScore = MIN_SCORE) {
        if (!data || data.status !== 'ok' || !Array.isArray(data.results) || data.results.length === 0) {
            return { matched: false, score: 0 };
        }

        const sorted = data.results
            .slice()
            .sort((a, b) => Number((b && b.score) || 0) - Number((a && a.score) || 0));

        const topScore = Number((sorted[0] && sorted[0].score) || 0);
        for (const res of sorted) {
            const score = Number((res && res.score) || 0);
            if (score < minScore) break;
            const recs = Array.isArray(res.recordings) ? res.recordings : [];
            let chosen = null;
            let chosenRank = -1;

            for (const rec of recs) {
                if (!rec || !rec.title || !String(rec.title).trim()) continue;
                const hasArtists = Array.isArray(rec.artists) && rec.artists.some(a => a && a.name);
                const rgInfo = pickBestAlbumFromReleaseGroups(rec.releasegroups);
                const rank = (hasArtists ? 8 : 0) + (rgInfo.isPrimaryAlbum ? 4 : (rgInfo.album ? 2 : 0));
                if (rank > chosenRank) {
                    chosenRank = rank;
                    chosen = { rec, rgInfo };
                }
            }

            if (chosen) {
                return {
                    matched: true,
                    score,
                    title: String(chosen.rec.title || '').trim(),
                    artist: joinAcoustIdArtists(chosen.rec.artists),
                    album: chosen.rgInfo.album,
                    recordingId: String(chosen.rec.id || ''),
                    releaseGroupId: chosen.rgInfo.releaseGroupId
                };
            }
        }

        return { matched: false, score: topScore };
    }

    function normMatchStr(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/[\(\)\[\]\{\}'"`.,!?:;\-_/\\]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async function enrichFromItunes(title, artist) {
        const empty = { matched: false, title: '', artist: '', album: '', year: '', genre: '', coverUrl: '', coverBytes: null, coverMime: '' };
        const t = String(title || '').trim();
        const a = String(artist || '').trim();
        if (!t) return empty;

        const term = a ? `${a} ${t}` : t;
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;

        let json = null;
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
            const resp = await fetch(url, { signal: controller ? controller.signal : undefined });
            if (!resp.ok) return empty;
            json = await resp.json();
        } catch (_) {
            return empty;
        } finally {
            if (timer) clearTimeout(timer);
        }

        const list = json && Array.isArray(json.results) ? json.results : [];
        if (list.length === 0) return empty;

        const nt = normMatchStr(t);
        const na = normMatchStr(a);
        let best = null;
        let bestRank = -1;
        for (const item of list) {
            const it = normMatchStr(item.trackName);
            const ia = normMatchStr(item.artistName);
            let rank = 0;
            if (nt && (it === nt || it.includes(nt) || nt.includes(it))) rank += 2;
            if (na && (ia === na || ia.includes(na) || na.includes(ia))) rank += 2;
            if (item.artworkUrl100) rank += 1;
            if (rank > bestRank) {
                bestRank = rank;
                best = item;
            }
        }

        if (!best || bestRank < 2) return empty;

        const matchedTitle = String(best.trackName || '').trim();
        const matchedArtist = String(best.artistName || '').trim();
        const album = String(best.collectionName || '').trim();
        const yearMatch = String(best.releaseDate || '').match(/\b(19\d\d|20\d\d)\b/);
        const year = yearMatch ? yearMatch[1] : '';
        const genre = String(best.primaryGenreName || '').trim();
        const coverUrl = best.artworkUrl100 ? String(best.artworkUrl100).replace(/100x100bb/i, '600x600bb') : '';

        let coverBytes = null;
        let coverMime = '';
        if (coverUrl) {
            const imgCtrl = typeof AbortController === 'function' ? new AbortController() : null;
            const imgTimer = imgCtrl ? setTimeout(() => imgCtrl.abort(), 6000) : null;
            try {
                const imgResp = await fetch(coverUrl, { signal: imgCtrl ? imgCtrl.signal : undefined });
                if (imgResp.ok) {
                    coverBytes = new Uint8Array(await imgResp.arrayBuffer());
                    coverMime = (imgResp.headers && imgResp.headers.get('content-type')) || 'image/jpeg';
                }
            } catch (_) {
                coverBytes = null;
                coverMime = '';
            } finally {
                if (imgTimer) clearTimeout(imgTimer);
            }
        }

        return { matched: true, title: matchedTitle, artist: matchedArtist, album, year, genre, coverUrl, coverBytes, coverMime };
    }

    function readSyncSafeInt(b, offset) {
        return ((b[offset] & 0x7f) << 21) | ((b[offset + 1] & 0x7f) << 14) |
            ((b[offset + 2] & 0x7f) << 7) | (b[offset + 3] & 0x7f);
    }

    function readUint32BE(b, offset) {
        return ((b[offset] << 24) >>> 0) | (b[offset + 1] << 16) | (b[offset + 2] << 8) | b[offset + 3];
    }

    function decodeBytes(bytes, encName) {
        try {
            return new TextDecoder(encName).decode(bytes);
        } catch (_) {
            let s = '';
            for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
            return s;
        }
    }

    function decodeId3TextPayload(payload) {
        if (!payload || payload.length === 0) return '';
        const enc = payload[0];
        const raw = payload.subarray(1);
        let text = '';
        if (enc === 0) {
            text = decodeBytes(raw, 'iso-8859-1');
        } else if (enc === 1) {
            if (raw.length >= 2 && raw[0] === 0xFF && raw[1] === 0xFE) {
                text = decodeBytes(raw.subarray(2), 'utf-16le');
            } else if (raw.length >= 2 && raw[0] === 0xFE && raw[1] === 0xFF) {
                text = decodeBytes(raw.subarray(2), 'utf-16be');
            } else {
                text = decodeBytes(raw, 'utf-16le');
            }
        } else if (enc === 2) {
            text = decodeBytes(raw, 'utf-16be');
        } else {
            text = decodeBytes(raw, 'utf-8');
        }
        return text.replace(/\u0000+$/g, '').replace(/\u0000/g, '').trim();
    }

    function parseApicFrame(payload) {
        if (!payload || payload.length < 4) return null;
        const enc = payload[0];
        let p = 1;
        while (p < payload.length && payload[p] !== 0) p++;
        const mime = decodeBytes(payload.subarray(1, p), 'ascii').trim() || 'image/jpeg';
        p += 1; // skip NUL after mime
        if (p >= payload.length) return null;
        p += 1; // skip picture type byte

        if (enc === 1 || enc === 2) {
            while (p + 1 < payload.length) {
                if (payload[p] === 0 && payload[p + 1] === 0) {
                    p += 2;
                    break;
                }
                p += 2;
            }
        } else {
            while (p < payload.length && payload[p] !== 0) p++;
            if (p < payload.length) p += 1;
        }
        if (p >= payload.length) return null;
        return {
            coverMime: mime,
            coverBytes: payload.slice(p)
        };
    }

    function readLocalAudioTags(arrayBuffer) {
        const result = {};
        if (!arrayBuffer || arrayBuffer.byteLength < 10) return result;
        const b = new Uint8Array(arrayBuffer);

        if (b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) {
            return result;
        }
        const major = b[3];
        if (major !== 3 && major !== 4) return result;

        const flags = b[5];
        const tagSize = readSyncSafeInt(b, 6);
        const tagEnd = Math.min(b.length, 10 + tagSize);
        let pos = 10;

        if ((flags & 0x40) !== 0 && pos + 4 <= tagEnd) {
            const extSize = major === 4 ? readSyncSafeInt(b, pos) : (readUint32BE(b, pos) + 4);
            pos = Math.min(tagEnd, pos + Math.max(4, extSize));
        }

        while (pos + 10 <= tagEnd) {
            if (b[pos] === 0) break;
            const id = String.fromCharCode(b[pos], b[pos + 1], b[pos + 2], b[pos + 3]);
            if (!/^[A-Z0-9]{4}$/.test(id)) break;

            const frameSize = major === 4 ? readSyncSafeInt(b, pos + 4) : readUint32BE(b, pos + 4);
            if (frameSize <= 0 || pos + 10 + frameSize > tagEnd) break;

            const payload = b.subarray(pos + 10, pos + 10 + frameSize);
            if (id === 'TIT2') {
                result.title = decodeId3TextPayload(payload);
            } else if (id === 'TPE1') {
                result.artist = decodeId3TextPayload(payload);
            } else if (id === 'TALB') {
                result.album = decodeId3TextPayload(payload);
            } else if (id === 'TYER' || id === 'TDRC') {
                const yrMatch = decodeId3TextPayload(payload).match(/\b(19\d\d|20\d\d)\b/);
                if (yrMatch) result.year = yrMatch[1];
            } else if (id === 'TCON') {
                result.genre = decodeId3TextPayload(payload);
            } else if (id === 'APIC' && !result.coverBytes) {
                const pic = parseApicFrame(payload);
                if (pic && pic.coverBytes && pic.coverBytes.length > 0) {
                    result.coverBytes = pic.coverBytes;
                    result.coverMime = pic.coverMime;
                }
            }

            pos += 10 + frameSize;
        }
        return result;
    }

    async function identifyTrackSlice(leftInt16, rightInt16, sampleRate = 44100, options = {}) {
        const clientKey = options.clientKey || DEFAULT_ACOUSTID_CLIENT_KEY;
        const minScore = typeof options.minScore === 'number' ? options.minScore : MIN_SCORE;
        const { fingerprint, duration } = await computeFingerprint(leftInt16, rightInt16, sampleRate);
        const data = await lookupAcoustId(fingerprint, duration, clientKey);
        const match = pickBestAcoustIdMatch(data, minScore);

        if (!match.matched) {
            return {
                matched: false,
                score: match.score || 0,
                title: '',
                artist: '',
                album: '',
                year: '',
                genre: '',
                coverBytes: null,
                coverMime: '',
                fingerprint,
                duration
            };
        }

        let album = match.album || '';
        let year = '';
        let genre = '';
        let coverBytes = null;
        let coverMime = '';

        if (options.enrichItunes !== false) {
            const extra = await enrichFromItunes(match.title, match.artist);
            if (!album && extra.album) album = extra.album;
            year = extra.year || '';
            genre = extra.genre || '';
            coverBytes = extra.coverBytes || null;
            coverMime = extra.coverMime || '';
        }

        return {
            matched: true,
            score: match.score,
            title: match.title,
            artist: match.artist,
            album,
            year,
            genre,
            coverBytes,
            coverMime,
            fingerprint,
            duration
        };
    }

    global.StudioIdentifyEngine = {
        DEFAULT_ACOUSTID_CLIENT_KEY,
        isGenericTrackTitle,
        computeFingerprint,
        lookupAcoustId,
        pickBestAcoustIdMatch,
        enrichFromItunes,
        readLocalAudioTags,
        identifyTrackSlice
    };
})(typeof window !== 'undefined' ? window : globalThis);
