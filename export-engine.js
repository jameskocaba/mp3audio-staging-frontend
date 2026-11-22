(function (global) {
    'use strict';

    /**
     * StudioExportEngine
     * 100% browser-based WAV/MP3 encoding, ID3v2.3 metadata + APIC cover art embedding,
     * pure-JS ZIP packager, and File System Access API hard-drive export helpers.
     */
    const CDN_FALLBACK_URLS = [
        'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
        'https://unpkg.com/lamejs@1.2.1/lame.min.js'
    ];

    const CRC32_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xffffffff;
        for (let i = 0; i < bytes.length; i++) {
            crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function encodeUtf16LeWithBom(text) {
        const str = String(text || '');
        const out = new Uint8Array(2 + str.length * 2);
        out[0] = 0xff;
        out[1] = 0xfe;
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            out[2 + i * 2] = code & 0xff;
            out[3 + i * 2] = (code >>> 8) & 0xff;
        }
        return out;
    }

    function encodeAscii(str) {
        const s = String(str || '');
        const out = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) {
            out[i] = s.charCodeAt(i) & 0x7f;
        }
        return out;
    }

    function makeId3TextFrame(frameId, value) {
        if (value === undefined || value === null || String(value).trim() === '') return null;
        const idBytes = encodeAscii(frameId);
        const textBytes = encodeUtf16LeWithBom(String(value));
        const payloadLen = 1 + textBytes.length; // 0x01 UTF-16 with BOM
        const frame = new Uint8Array(10 + payloadLen);
        frame.set(idBytes.subarray(0, 4), 0);
        frame[4] = (payloadLen >>> 24) & 0xff;
        frame[5] = (payloadLen >>> 16) & 0xff;
        frame[6] = (payloadLen >>> 8) & 0xff;
        frame[7] = payloadLen & 0xff;
        frame[8] = 0;
        frame[9] = 0;
        frame[10] = 0x01;
        frame.set(textBytes, 11);
        return frame;
    }

    function makeId3ApicFrame(coverBytes, coverMime) {
        if (!coverBytes || !coverBytes.length) return null;
        const mimeBytes = encodeAscii(coverMime || 'image/jpeg');
        const payloadLen = 1 + mimeBytes.length + 1 + 1 + 1 + coverBytes.length;
        const frame = new Uint8Array(10 + payloadLen);
        frame.set(encodeAscii('APIC'), 0);
        frame[4] = (payloadLen >>> 24) & 0xff;
        frame[5] = (payloadLen >>> 16) & 0xff;
        frame[6] = (payloadLen >>> 8) & 0xff;
        frame[7] = payloadLen & 0xff;
        let p = 10;
        frame[p++] = 0x00; // ISO-8859-1 text encoding
        frame.set(mimeBytes, p);
        p += mimeBytes.length;
        frame[p++] = 0x00; // MIME null terminator
        frame[p++] = 0x03; // Cover (front)
        frame[p++] = 0x00; // Empty description null terminator
        frame.set(coverBytes, p);
        return frame;
    }

    function prependId3v2Tags(mp3Uint8Array, meta = {}) {
        const frames = [];
        const addFrame = (f) => { if (f) frames.push(f); };

        addFrame(makeId3TextFrame('TIT2', meta.title));
        addFrame(makeId3TextFrame('TPE1', meta.artist));
        addFrame(makeId3TextFrame('TALB', meta.album));
        addFrame(makeId3TextFrame('TRCK', meta.trackNumber));
        addFrame(makeId3TextFrame('TYER', meta.year));
        addFrame(makeId3TextFrame('TCON', meta.genre));
        if (meta.coverBytes && meta.coverBytes.length) {
            addFrame(makeId3ApicFrame(
                meta.coverBytes instanceof Uint8Array ? meta.coverBytes : new Uint8Array(meta.coverBytes),
                meta.coverMime || 'image/jpeg'
            ));
        }

        if (frames.length === 0) {
            return mp3Uint8Array instanceof Uint8Array ? mp3Uint8Array : new Uint8Array(mp3Uint8Array);
        }

        let tagBodySize = 0;
        for (let i = 0; i < frames.length; i++) {
            tagBodySize += frames[i].length;
        }

        const audioBytes = mp3Uint8Array instanceof Uint8Array ? mp3Uint8Array : new Uint8Array(mp3Uint8Array);
        const out = new Uint8Array(10 + tagBodySize + audioBytes.length);

        // ID3v2.3 header
        out[0] = 0x49; // 'I'
        out[1] = 0x44; // 'D'
        out[2] = 0x33; // '3'
        out[3] = 0x03; // version 2.3
        out[4] = 0x00; // revision 0
        out[5] = 0x00; // flags
        // 28-bit synchsafe integer
        out[6] = (tagBodySize >>> 21) & 0x7f;
        out[7] = (tagBodySize >>> 14) & 0x7f;
        out[8] = (tagBodySize >>> 7) & 0x7f;
        out[9] = tagBodySize & 0x7f;

        let offset = 10;
        for (let i = 0; i < frames.length; i++) {
            out.set(frames[i], offset);
            offset += frames[i].length;
        }
        out.set(audioBytes, offset);
        return out;
    }

    function encodeWavBlob(leftInt16, rightInt16, sampleRate = 44100) {
        const left = leftInt16 instanceof Int16Array ? leftInt16 : new Int16Array(leftInt16 || 0);
        const right = rightInt16 instanceof Int16Array ? rightInt16 : left;
        const numSamples = Math.min(left.length, right.length);
        const numChannels = 2;
        const bitsPerSample = 16;
        const blockAlign = numChannels * (bitsPerSample / 8);
        const byteRate = sampleRate * blockAlign;
        const dataSize = numSamples * blockAlign;

        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        function writeAscii(off, txt) {
            for (let i = 0; i < txt.length; i++) {
                view.setUint8(off + i, txt.charCodeAt(i));
            }
        }

        writeAscii(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeAscii(8, 'WAVE');
        writeAscii(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeAscii(36, 'data');
        view.setUint32(40, dataSize, true);

        const pcmOut = new Int16Array(buffer, 44, numSamples * 2);
        for (let i = 0; i < numSamples; i++) {
            pcmOut[i * 2] = left[i];
            pcmOut[i * 2 + 1] = right[i];
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    function getLameCandidateUrls() {
        const urls = [];
        try {
            if (typeof window !== 'undefined' && window.location && window.location.href) {
                urls.push(new URL('vendor/lame.min.js', window.location.href).href);
            }
        } catch (_) { }
        for (const cdn of CDN_FALLBACK_URLS) {
            if (!urls.includes(cdn)) urls.push(cdn);
        }
        return urls;
    }

    function createMp3WorkerBlobUrl() {
        const workerSource = `
            let lameLoaded = false;
            function loadLame(urls) {
                if (lameLoaded && self.lamejs && self.lamejs.Mp3Encoder) return true;
                for (let i = 0; i < urls.length; i++) {
                    try {
                        importScripts(urls[i]);
                        if (self.lamejs && self.lamejs.Mp3Encoder) {
                            lameLoaded = true;
                            return true;
                        }
                    } catch (err) {
                        // Try next fallback URL
                    }
                }
                return false;
            }

            self.onmessage = function (e) {
                const msg = e.data || {};
                try {
                    const ok = loadLame(msg.lameUrls || []);
                    if (!ok) {
                        self.postMessage({ type: 'error', error: 'Failed to load MP3 encoder (lamejs).' });
                        return;
                    }
                    const left = new Int16Array(msg.leftBuffer);
                    const right = new Int16Array(msg.rightBuffer);
                    const sampleRate = msg.sampleRate || 44100;
                    const kbps = msg.kbps || 192;
                    const encoder = new self.lamejs.Mp3Encoder(2, sampleRate, kbps);

                    const blockSize = 1152;
                    const total = left.length;
                    const chunks = [];
                    let totalBytes = 0;
                    let lastReportedPct = -1;

                    for (let i = 0; i < total; i += blockSize) {
                        const end = Math.min(i + blockSize, total);
                        const lChunk = left.subarray(i, end);
                        const rChunk = right.subarray(i, end);
                        const encoded = encoder.encodeBuffer(lChunk, rChunk);
                        if (encoded && encoded.length > 0) {
                            const u8 = new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength).slice();
                            chunks.push(u8);
                            totalBytes += u8.length;
                        }
                        const pct = total > 0 ? Math.min(99, Math.floor((end / total) * 100)) : 99;
                        if (pct !== lastReportedPct && (pct - lastReportedPct >= 4 || pct === 99)) {
                            lastReportedPct = pct;
                            self.postMessage({ type: 'progress', progress: pct });
                        }
                    }

                    const flushed = encoder.flush();
                    if (flushed && flushed.length > 0) {
                        const u8 = new Uint8Array(flushed.buffer, flushed.byteOffset, flushed.byteLength).slice();
                        chunks.push(u8);
                        totalBytes += u8.length;
                    }

                    const merged = new Uint8Array(totalBytes);
                    let pos = 0;
                    for (let j = 0; j < chunks.length; j++) {
                        merged.set(chunks[j], pos);
                        pos += chunks[j].length;
                    }

                    self.postMessage({ type: 'progress', progress: 100 });
                    self.postMessage({ type: 'done', buffer: merged.buffer }, [merged.buffer]);
                } catch (err) {
                    self.postMessage({ type: 'error', error: (err && err.message) ? err.message : String(err) });
                }
            };
        `;
        return URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }));
    }

    let mainThreadLamePromise = null;
    function loadLameOnMainThread() {
        if (typeof global !== 'undefined' && global.lamejs && global.lamejs.Mp3Encoder) {
            return Promise.resolve(global.lamejs);
        }
        if (mainThreadLamePromise) return mainThreadLamePromise;
        const urls = getLameCandidateUrls();
        mainThreadLamePromise = new Promise((resolve, reject) => {
            let idx = 0;
            function tryNext() {
                if (idx >= urls.length) {
                    mainThreadLamePromise = null;
                    reject(new Error('Failed to load MP3 encoder (lamejs).'));
                    return;
                }
                const s = document.createElement('script');
                s.src = urls[idx++];
                s.onload = () => {
                    if (global.lamejs && global.lamejs.Mp3Encoder) resolve(global.lamejs);
                    else tryNext();
                };
                s.onerror = () => tryNext();
                document.head.appendChild(s);
            }
            tryNext();
        });
        return mainThreadLamePromise;
    }

    async function encodeMp3MainThreadFallback(left, right, sampleRate, kbps, meta, onProgress) {
        const lame = await loadLameOnMainThread();
        const encoder = new lame.Mp3Encoder(2, sampleRate, kbps);
        const blockSize = 1152;
        const total = left.length;
        const chunks = [];
        let totalBytes = 0;
        let lastPct = -1;

        for (let i = 0; i < total; i += blockSize) {
            const end = Math.min(i + blockSize, total);
            const encoded = encoder.encodeBuffer(left.subarray(i, end), right.subarray(i, end));
            if (encoded && encoded.length > 0) {
                const u8 = new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength).slice();
                chunks.push(u8);
                totalBytes += u8.length;
            }
            const pct = total > 0 ? Math.min(99, Math.floor((end / total) * 100)) : 99;
            if (pct !== lastPct && (pct - lastPct >= 10 || pct === 99)) {
                lastPct = pct;
                if (typeof onProgress === 'function') onProgress(pct);
                await new Promise(r => setTimeout(r, 0));
            }
        }
        const flushed = encoder.flush();
        if (flushed && flushed.length > 0) {
            const u8 = new Uint8Array(flushed.buffer, flushed.byteOffset, flushed.byteLength).slice();
            chunks.push(u8);
            totalBytes += u8.length;
        }
        const merged = new Uint8Array(totalBytes);
        let pos = 0;
        for (let j = 0; j < chunks.length; j++) {
            merged.set(chunks[j], pos);
            pos += chunks[j].length;
        }
        if (typeof onProgress === 'function') onProgress(100);
        const taggedMp3 = prependId3v2Tags(merged, meta);
        return new Blob([taggedMp3], { type: 'audio/mpeg' });
    }

    function encodeMp3Blob(leftInt16, rightInt16, sampleRate = 44100, kbps = 192, meta = {}, onProgress = null) {
        return new Promise((resolve, reject) => {
            const left = leftInt16 instanceof Int16Array ? leftInt16 : new Int16Array(leftInt16 || 0);
            const right = rightInt16 instanceof Int16Array ? rightInt16 : left;
            const leftCopy = left.slice();
            const rightCopy = right.slice();

            if (typeof Worker !== 'function') {
                encodeMp3MainThreadFallback(left, right, sampleRate, kbps, meta, onProgress).then(resolve, reject);
                return;
            }

            const workerUrl = createMp3WorkerBlobUrl();
            let worker;
            try {
                worker = new Worker(workerUrl);
            } catch (_) {
                URL.revokeObjectURL(workerUrl);
                encodeMp3MainThreadFallback(left, right, sampleRate, kbps, meta, onProgress).then(resolve, reject);
                return;
            }

            let settled = false;
            let workerResponded = false;
            const cleanup = () => {
                try { worker.terminate(); } catch (_) { }
                try { URL.revokeObjectURL(workerUrl); } catch (_) { }
            };

            const startupTimer = setTimeout(() => {
                if (!workerResponded && !settled) {
                    settled = true;
                    cleanup();
                    encodeMp3MainThreadFallback(left, right, sampleRate, kbps, meta, onProgress).then(resolve, reject);
                }
            }, 3000);

            worker.onmessage = (e) => {
                workerResponded = true;
                clearTimeout(startupTimer);
                if (settled) return;
                const data = e.data || {};
                if (data.type === 'progress') {
                    if (typeof onProgress === 'function') onProgress(data.progress || 0);
                } else if (data.type === 'done') {
                    settled = true;
                    cleanup();
                    const rawMp3 = new Uint8Array(data.buffer);
                    const taggedMp3 = prependId3v2Tags(rawMp3, meta);
                    resolve(new Blob([taggedMp3], { type: 'audio/mpeg' }));
                } else if (data.type === 'error') {
                    settled = true;
                    cleanup();
                    encodeMp3MainThreadFallback(left, right, sampleRate, kbps, meta, onProgress).then(resolve, reject);
                }
            };

            worker.onerror = () => {
                clearTimeout(startupTimer);
                if (settled) return;
                settled = true;
                cleanup();
                encodeMp3MainThreadFallback(left, right, sampleRate, kbps, meta, onProgress).then(resolve, reject);
            };

            worker.postMessage({
                lameUrls: getLameCandidateUrls(),
                leftBuffer: leftCopy.buffer,
                rightBuffer: rightCopy.buffer,
                sampleRate: sampleRate || 44100,
                kbps: kbps || 192
            }, [leftCopy.buffer, rightCopy.buffer]);
        });
    }

    function encodeUtf8(str) {
        return new TextEncoder().encode(String(str || ''));
    }

    function buildZipBlob(files) {
        const list = Array.isArray(files) ? files : [];
        const localParts = [];
        const centralParts = [];
        let offset = 0;

        const now = new Date();
        const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() >> 1) & 0x1f);
        const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const nameBytes = encodeUtf8(item.name || `track_${i + 1}.mp3`);
            const dataBytes = item.bytes instanceof Uint8Array ? item.bytes : new Uint8Array(item.bytes || 0);
            const sum = crc32(dataBytes);
            const size = dataBytes.length;

            // Local file header (30 bytes + name)
            const localHdr = new Uint8Array(30 + nameBytes.length);
            const lv = new DataView(localHdr.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
            lv.setUint16(8, 0, true); // Store
            lv.setUint16(10, dosTime, true);
            lv.setUint16(12, dosDate, true);
            lv.setUint32(14, sum, true);
            lv.setUint32(18, size, true);
            lv.setUint32(22, size, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);
            localHdr.set(nameBytes, 30);

            localParts.push(localHdr, dataBytes);

            // Central directory header (46 bytes + name)
            const centralHdr = new Uint8Array(46 + nameBytes.length);
            const cv = new DataView(centralHdr.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0x0800, true);
            cv.setUint16(10, 0, true);
            cv.setUint16(12, dosTime, true);
            cv.setUint16(14, dosDate, true);
            cv.setUint32(16, sum, true);
            cv.setUint32(20, size, true);
            cv.setUint32(24, size, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);
            cv.setUint16(32, 0, true);
            cv.setUint16(34, 0, true);
            cv.setUint16(36, 0, true);
            cv.setUint32(38, 0, true);
            cv.setUint32(42, offset, true);
            centralHdr.set(nameBytes, 46);

            centralParts.push(centralHdr);
            offset += localHdr.length + dataBytes.length;
        }

        let centralSize = 0;
        for (let i = 0; i < centralParts.length; i++) centralSize += centralParts[i].length;

        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, list.length, true);
        ev.setUint16(10, list.length, true);
        ev.setUint32(12, centralSize, true);
        ev.setUint32(16, offset, true);
        ev.setUint16(20, 0, true);

        return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
    }

    function supportsDirectoryPicker() {
        return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
    }

    function supportsSaveFilePicker() {
        return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
    }

    async function pickSaveDirectory() {
        if (!supportsDirectoryPicker()) {
            throw new Error('Folder picker requires Chrome, Edge, or Opera on desktop. Files will save to your Downloads folder.');
        }
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        return { handle, name: handle.name || 'Selected Folder' };
    }

    function sanitizeFilename(name) {
        return String(name || 'Untitled')
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^\.+|\.+$/g, '')
            .slice(0, 140) || 'Track';
    }

    function buildTrackFilename(track, index, total, ext = 'mp3') {
        const padWidth = total >= 100 ? 3 : 2;
        const num = String((index || 0) + 1).padStart(padWidth, '0');
        const title = sanitizeFilename((track && track.title) || `Track ${index + 1}`);
        const artist = track && track.artist ? sanitizeFilename(track.artist) : '';
        const cleanExt = String(ext || 'mp3').replace(/^\./, '').toLowerCase();
        if (artist) {
            return `${num} - ${artist} - ${title}.${cleanExt}`;
        }
        return `${num} - ${title}.${cleanExt}`;
    }

    async function saveBlobToDirectory(dirHandle, filename, blob) {
        const safeName = sanitizeFilename(filename);
        const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return safeName;
    }

    function triggerAnchorDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            try { a.remove(); } catch (_) { }
            try { URL.revokeObjectURL(url); } catch (_) { }
        }, 1500);
    }

    async function saveBlobWithPickerOrDownload(blob, filename, ext = 'mp3', dirHandle = null) {
        const safeName = sanitizeFilename(filename);
        if (dirHandle) {
            await saveBlobToDirectory(dirHandle, safeName, blob);
            return { method: 'directory', filename: safeName };
        }
        if (supportsSaveFilePicker()) {
            const cleanExt = String(ext || 'mp3').replace(/^\./, '').toLowerCase();
            const acceptMap = cleanExt === 'wav'
                ? { 'audio/wav': ['.wav'] }
                : (cleanExt === 'zip' ? { 'application/zip': ['.zip'] } : { 'audio/mpeg': ['.mp3'] });
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: safeName,
                    types: [{
                        description: cleanExt.toUpperCase() + ' File',
                        accept: acceptMap
                    }]
                });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                return { method: 'picker', filename: fileHandle.name || safeName };
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    return { method: 'cancelled', filename: safeName };
                }
            }
        }
        triggerAnchorDownload(blob, safeName);
        return { method: 'download', filename: safeName };
    }

    function canShareFiles() {
        try {
            if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' ||
                typeof navigator.canShare !== 'function' || typeof File !== 'function') {
                return false;
            }
            const probe = new File([new Uint8Array([0])], 'probe.mp3', { type: 'audio/mpeg' });
            return Boolean(navigator.canShare({ files: [probe] }));
        } catch (_) {
            return false;
        }
    }

    async function shareBlobFile(blob, filename) {
        const safeName = sanitizeFilename(filename);
        if (canShareFiles()) {
            try {
                const file = new File([blob], safeName, { type: (blob && blob.type) || 'audio/mpeg' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: safeName });
                    return { method: 'share', filename: safeName };
                }
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    return { method: 'cancelled', filename: safeName };
                }
            }
        }
        triggerAnchorDownload(blob, safeName);
        return { method: 'download', filename: safeName };
    }

    global.StudioExportEngine = {
        encodeWavBlob,
        prependId3v2Tags,
        encodeMp3Blob,
        buildZipBlob,
        supportsDirectoryPicker,
        supportsSaveFilePicker,
        canShareFiles,
        shareBlobFile,
        pickSaveDirectory,
        sanitizeFilename,
        buildTrackFilename,
        saveBlobToDirectory,
        saveBlobWithPickerOrDownload,
        triggerAnchorDownload
    };
})(typeof window !== 'undefined' ? window : globalThis);
