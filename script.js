document.addEventListener('DOMContentLoaded', () => {
    // Prevent default browser file drop behavior outside handler
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com';

    // Inject Authorization Bearer token for cross-origin session persistence
    const originalFetch = window.fetch;
    window.fetch = function (input, init = {}) {
        let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
        if (url && url.startsWith(BACKEND_URL) && typeof input === 'string') {
            init = init || {};
            init.headers = init.headers || {};
            const token = localStorage.getItem('session_token');
            if (token) {
                if (init.headers instanceof Headers) {
                    if (!init.headers.has('Authorization')) init.headers.set('Authorization', `Bearer ${token}`);
                } else {
                    if (!init.headers['Authorization']) init.headers['Authorization'] = `Bearer ${token}`;
                }
            }
            init.credentials = 'include';
        }
        return originalFetch(input, init);
    };

    // --- DOM Elements ---
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatComposerForm = document.getElementById('chatComposerForm');
    const attachFileBtn = document.getElementById('attachFileBtn');
    const fileInput = document.getElementById('fileInput');
    const attachedFilesPreview = document.getElementById('attachedFilesPreview');
    const attachedFilesLabel = document.getElementById('attachedFilesLabel');
    const clearAttachedFilesBtn = document.getElementById('clearAttachedFilesBtn');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const dragDropOverlay = document.getElementById('dragDropOverlay');

    // Sidebar & Navigation
    const assistantSidebar = document.getElementById('assistantSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const openSidebarBtn = document.getElementById('openSidebarBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const recentHistoryList = document.getElementById('recentHistoryList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // Option Toggles
    const autoAddAlbumArtInput = document.getElementById('autoAddAlbumArt');
    const increaseQualityInput = document.getElementById('increaseQuality');
    const videoToMp3Input = document.getElementById('videoToMp3');
    const attachLyricsInput = document.getElementById('attachLyrics');

    // Account & Billing Elements
    const userDashboard = document.getElementById('userDashboard');
    const guestPricingGrid = document.getElementById('guestPricingGrid');
    const loginEmail = document.getElementById('loginEmail');
    const sendLinkBtn = document.getElementById('sendLinkBtn');
    const authMessage = document.getElementById('authMessage');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const paidCreditsDisplay = document.getElementById('paidCreditsDisplay');
    const headerPaidCreditsDisplay = document.getElementById('headerPaidCreditsDisplay');
    const sidebarAccountLabel = document.getElementById('sidebarAccountLabel');
    const sidebarAccountSub = document.getElementById('sidebarAccountSub');
    const headerAccountBtnText = document.getElementById('headerAccountBtnText');
    const logoutBtn = document.getElementById('logoutBtn');
    const buyCreditsBtn = document.getElementById('buyCreditsBtn');

    // Mini Player Elements
    const miniPlayerBar = document.getElementById('miniPlayerBar');
    const miniPlayerArt = document.getElementById('miniPlayerArt');
    const miniPlayerTitle = document.getElementById('miniPlayerTitle');
    const miniPlayerArtist = document.getElementById('miniPlayerArtist');
    const miniPrevBtn = document.getElementById('miniPrevBtn');
    const miniPlayPauseBtn = document.getElementById('miniPlayPauseBtn');
    const miniPlayIcon = document.getElementById('miniPlayIcon');
    const miniNextBtn = document.getElementById('miniNextBtn');
    const miniCurrentTime = document.getElementById('miniCurrentTime');
    const miniTotalTime = document.getElementById('miniTotalTime');
    const miniSeekSlider = document.getElementById('miniSeekSlider');
    const miniDownloadMp3Btn = document.getElementById('miniDownloadMp3Btn');
    const miniCloseBtn = document.getElementById('miniCloseBtn');

    // State
    let chatHistory = [];
    let pendingFiles = [];
    let recentPrompts = JSON.parse(localStorage.getItem('mp3audio_recent_prompts') || '[]');

    // Audio Player Queue State
    const globalAudio = new Audio();
    globalAudio.crossOrigin = 'anonymous';
    let currentQueue = [];
    let currentQueueIndex = -1;
    let activeBubbleId = null;

    // --- Toast Notification Helper ---
    function showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : '🎧');
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    // --- Format Time Helper ---
    function formatTime(sec) {
        if (!sec || isNaN(sec) || sec < 0) return '0:00';
        const s = Math.floor(sec);
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return `${m}:${rem < 10 ? '0' : ''}${rem}`;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatMarkdownBold(text) {
        return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    // --- Mobile Sidebar Toggle ---
    function toggleSidebar(open) {
        if (!assistantSidebar || !sidebarBackdrop) return;
        if (open) {
            assistantSidebar.classList.add('open');
            sidebarBackdrop.classList.remove('hidden');
        } else {
            assistantSidebar.classList.remove('open');
            sidebarBackdrop.classList.add('hidden');
        }
    }

    if (openSidebarBtn) openSidebarBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

    // --- Recent Prompts Sidebar List ---
    function saveRecentPrompt(promptText) {
        const clean = promptText.trim();
        if (!clean) return;
        recentPrompts = [clean, ...recentPrompts.filter(p => p.toLowerCase() !== clean.toLowerCase())].slice(0, 12);
        localStorage.setItem('mp3audio_recent_prompts', JSON.stringify(recentPrompts));
        renderRecentPrompts();
    }

    function renderRecentPrompts() {
        if (!recentHistoryList) return;
        if (recentPrompts.length === 0) {
            recentHistoryList.innerHTML = `<div style="font-size:0.74rem; color:#667781; padding: 4px 6px;">Your recent music requests will appear here.</div>`;
            return;
        }
        recentHistoryList.innerHTML = '';
        recentPrompts.forEach(p => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'history-item-btn';
            btn.innerHTML = `<span>🎵</span><span>${escapeHtml(p)}</span>`;
            btn.addEventListener('click', () => {
                toggleSidebar(false);
                sendUserMessage(p);
            });
            recentHistoryList.appendChild(btn);
        });
    }
    renderRecentPrompts();

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            recentPrompts = [];
            localStorage.removeItem('mp3audio_recent_prompts');
            renderRecentPrompts();
            showToast('Recent history cleared');
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            toggleSidebar(false);
            if (chatInput) {
                chatInput.value = '';
                chatInput.focus();
            }
            showToast('Ready for your next music or playlist request!');
        });
    }

    // --- Built-in Client-Side Curation Fallback (Uses iTunes Search API if backend is still deploying) ---
    const CLIENT_VIBE_SEEDS = {
        synthwave: {
            title: "Midnight Neon: Chill Synthwave Mix",
            vibe: "Warm analog synths, retro arpeggios & late-night drive energy",
            seeds: ["M83 Midnight City", "Kavinsky Nightcall", "The Midnight Sunset", "GUNSHIP Tech Noir", "Mr.Kitty After Dark", "FM-84 Running in the Night"]
        },
        workout: {
            title: "High-Octane Gym & Workout Anthems",
            vibe: "Heavy bass, relentless tempo & peak adrenaline",
            seeds: ["Kanye West Stronger", "Eminem Till I Collapse", "Kendrick Lamar HUMBLE", "Kanye West POWER", "Survivor Eye of the Tiger", "David Guetta Titanium"]
        },
        "hip hop": {
            title: "Golden Era & Modern Hip-Hop Essentials",
            vibe: "Boom-bap classics, sharp lyricism & iconic 808s",
            seeds: ["Nas N.Y. State of Mind", "Mobb Deep Shook Ones Pt II", "Wu-Tang Clan C.R.E.A.M.", "Notorious B.I.G. Juicy", "Dr. Dre Still D.R.E.", "Kendrick Lamar Money Trees"]
        },
        lofi: {
            title: "Lo-Fi Study & Rainy Window Beats",
            vibe: "Dusty vinyl crackle, warm Rhodes chords & mellow boom-bap",
            seeds: ["WYS Snowman", "Nujabes Feather", "beabadoobee Coffee", "Jinsang Affection", "The Deli 5:32pm", "Nujabes Luv sic"]
        },
        acoustic: {
            title: "Warm Coffeehouse Acoustic Sessions",
            vibe: "Intimate fingerpicking, rich vocals & stripped-back storytelling",
            seeds: ["Tracy Chapman Fast Car", "Jack Johnson Banana Pancakes", "Bon Iver Skinny Love", "The Beatles Blackbird", "The Lumineers Ho Hey", "Ed Sheeran Photograph"]
        },
        rock: {
            title: "Stadium & Classic Rock Legends",
            vibe: "Timeless guitar riffs, soaring vocals & driving drums",
            seeds: ["Queen Bohemian Rhapsody", "Fleetwood Mac Dreams", "Eagles Hotel California", "Nirvana Smells Like Teen Spirit", "The Killers Mr. Brightside", "Foo Fighters Everlong"]
        },
        jazz: {
            title: "Midnight Blue Note Jazz Lounge",
            vibe: "Smoky saxophone, walking upright bass & velvet trumpet",
            seeds: ["Dave Brubeck Take Five", "Miles Davis So What", "John Coltrane My Favorite Things", "Frank Sinatra Fly Me to the Moon", "Miles Davis Blue in Green", "Chet Baker Almost Blue"]
        },
        "r&b": {
            title: "Silk & Soul: R&B Slow Jams",
            vibe: "Lush harmonies, late-night basslines & timeless soul",
            seeds: ["SZA Snooze", "Frank Ocean Pink + White", "Childish Gambino Redbone", "Daniel Caesar Best Part", "Miguel Adorn", "The Weeknd Earned It"]
        }
    };

    function mapItunesResult(item, idx) {
        const title = item.trackName || `Track ${idx}`;
        const artist = item.artistName || 'Artist';
        const album = item.collectionName || 'Single';
        const artwork = (item.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg');
        const durSec = item.trackTimeMillis ? Math.max(1, Math.round(item.trackTimeMillis / 1000)) : 210;
        const yearMatch = (item.releaseDate || '').match(/\b(19\d\d|20\d\d)\b/);
        return {
            index: idx,
            title,
            artist,
            album,
            year: yearMatch ? yearMatch[1] : '',
            duration: formatTime(durSec),
            duration_sec: durSec,
            artwork_url: artwork,
            preview_url: item.previewUrl || '',
            search_query: `ytsearch1:${artist} - ${title} official audio`
        };
    }

    async function clientSideCurateFallback(messageText) {
        const lower = messageText.toLowerCase();
        const isRingtone = /ringtone|m4r|alarm tone/.test(lower);

        for (const [key, preset] of Object.entries(CLIENT_VIBE_SEEDS)) {
            if (lower.includes(key) || (key === 'lofi' && lower.includes('lo-fi'))) {
                const tracks = await Promise.all(preset.seeds.map(async (seed, idx) => {
                    try {
                        const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(seed)}&media=music&entity=song&limit=1`);
                        const d = await r.json();
                        if (d.results && d.results[0]) return mapItunesResult(d.results[0], idx + 1);
                    } catch (e) { }
                    return {
                        index: idx + 1,
                        title: seed,
                        artist: 'Featured Artist',
                        album: 'Curated Mix',
                        year: '2025',
                        duration: '3:30',
                        duration_sec: 210,
                        artwork_url: 'favicon.png',
                        preview_url: '',
                        search_query: `ytsearch1:${seed} official audio`
                    };
                }));
                return {
                    success: true,
                    reply: `Here is your **${preset.title}**! Tap play on any audio bubble to listen right in the chat, download individual 320kbps MP3s, or grab the full playlist ZIP.`,
                    mode: 'playlist',
                    playlist_title: preset.title,
                    playlist_vibe: preset.vibe,
                    tracks
                };
            }
        }

        // Clean conversational filler
        let cleanQ = messageText
            .replace(/^(hey|hi|hello|yo|please|can you|could you|send me|play|find|get me|make me|create|give me|i want|i need|text me)\s+/i, '')
            .replace(/\b(a playlist of|a playlist for|playlist|songs by|tracks by|music by|ringtone of|ringtone for|ringtone|mp3|audio|song|track)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim() || messageText;

        const wantsPlaylist = /playlist|mix|songs|tracks|vibe|mood|workout|chill|study|party|top |best /i.test(lower);
        const limit = isRingtone ? 1 : (wantsPlaylist ? 6 : 4);

        try {
            const resp = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=song&limit=${limit * 2}`);
            const data = await resp.json();
            const seen = new Set();
            const tracks = [];
            for (const item of (data.results || [])) {
                const k = `${(item.trackName || '').toLowerCase()}|${(item.artistName || '').toLowerCase()}`;
                if (!seen.has(k) && item.trackName) {
                    seen.add(k);
                    tracks.push(mapItunesResult(item, tracks.length + 1));
                    if (tracks.length >= limit) break;
                }
            }
            if (tracks.length > 0) {
                if (tracks.length === 1 || isRingtone) {
                    const t = tracks[0];
                    return {
                        success: true,
                        reply: `Here is **${t.title}** by **${t.artist}**! Tap play in the bubble below to listen immediately, or click **Download MP3** for the full tagged file.`,
                        mode: isRingtone ? 'ringtone' : 'single',
                        playlist_title: `${t.title} — ${t.artist}`,
                        playlist_vibe: `${t.album} ${t.year ? '(' + t.year + ')' : ''}`,
                        tracks: [t]
                    };
                }
                return {
                    success: true,
                    reply: `I curated **${tracks.length} tracks** for **${cleanQ}**! Tap play on any audio bubble to listen in the chat, download individual MP3s, or grab the full Playlist ZIP.`,
                    mode: 'playlist',
                    playlist_title: `${cleanQ} — Curated Mix`,
                    playlist_vibe: `AI Curated Selection • 320kbps & ID3 Tagged`,
                    tracks
                };
            }
        } catch (err) {
            console.warn('iTunes fallback search error:', err);
        }

        return {
            success: true,
            reply: `I found **${cleanQ}** for you! Click **Download MP3** below to extract and tag the full 320kbps audio track.`,
            mode: 'single',
            playlist_title: cleanQ,
            playlist_vibe: 'Direct Audio Extraction',
            tracks: [{
                index: 1,
                title: cleanQ,
                artist: 'MP3aud.io Search',
                album: 'Single',
                year: '2026',
                duration: '3:30',
                duration_sec: 210,
                artwork_url: 'favicon.png',
                preview_url: '',
                search_query: cleanQ.startsWith('http') ? cleanQ : `ytsearch1:${cleanQ} official audio`
            }]
        };
    }

    // --- Audio Playback Engine for Chat Bubbles & Mini Player ---
    function updateAllBubblePlayStates() {
        document.querySelectorAll('.track-audio-bubble').forEach(el => {
            const bid = el.getAttribute('data-bubble-id');
            const btn = el.querySelector('.track-play-btn');
            const isThisActive = (bid === activeBubbleId);
            el.classList.toggle('is-playing', isThisActive && !globalAudio.paused);
            if (btn) {
                btn.innerHTML = (isThisActive && !globalAudio.paused) ? '⏸' : '▶';
            }
            if (!isThisActive) {
                const fill = el.querySelector('.track-scrub-fill');
                if (fill) fill.style.width = '0%';
            }
        });
        if (miniPlayIcon) {
            miniPlayIcon.textContent = globalAudio.paused ? '▶' : '⏸';
        }
    }

    function playTrackFromQueue(queue, index) {
        if (!queue || index < 0 || index >= queue.length) return;
        currentQueue = queue;
        currentQueueIndex = index;
        const track = currentQueue[currentQueueIndex];

        if (!track.preview_url) {
            showToast('No instant preview stream for this track — click "⬇ MP3" to extract the full audio!', 'info');
            return;
        }

        if (activeBubbleId === track.bubbleId && globalAudio.src === track.preview_url) {
            if (globalAudio.paused) {
                globalAudio.play().catch(() => { });
            } else {
                globalAudio.pause();
            }
            updateAllBubblePlayStates();
            return;
        }

        activeBubbleId = track.bubbleId;
        globalAudio.src = track.preview_url;
        globalAudio.currentTime = 0;
        globalAudio.play().catch(err => {
            console.warn('Audio playback blocked or failed:', err);
            showToast('Could not play stream preview. Try clicking Download MP3.', 'error');
        });

        if (miniPlayerBar) {
            miniPlayerBar.classList.remove('hidden');
            if (miniPlayerArt) miniPlayerArt.src = track.artwork_url || 'favicon.png';
            if (miniPlayerTitle) miniPlayerTitle.textContent = track.title || 'Track';
            if (miniPlayerArtist) miniPlayerArtist.textContent = track.artist || 'Artist';
            if (miniDownloadMp3Btn) {
                miniDownloadMp3Btn.onclick = () => {
                    const bubbleEl = document.querySelector(`.track-audio-bubble[data-bubble-id="${track.bubbleId}"]`);
                    const statusContainer = bubbleEl ? bubbleEl.closest('.assistant-bubble').querySelector('.bubble-conversion-container') : null;
                    triggerTrackOrPlaylistDownload([track], `${track.artist} - ${track.title}`, statusContainer);
                };
            }
        }
        updateAllBubblePlayStates();
    }

    globalAudio.addEventListener('play', updateAllBubblePlayStates);
    globalAudio.addEventListener('pause', updateAllBubblePlayStates);
    globalAudio.addEventListener('timeupdate', () => {
        const dur = globalAudio.duration || 30;
        const cur = globalAudio.currentTime || 0;
        const pct = Math.min(100, (cur / dur) * 100);

        if (miniCurrentTime) miniCurrentTime.textContent = formatTime(cur);
        if (miniTotalTime) miniTotalTime.textContent = formatTime(dur);
        if (miniSeekSlider) miniSeekSlider.value = pct;

        if (activeBubbleId) {
            const activeEl = document.querySelector(`.track-audio-bubble[data-bubble-id="${activeBubbleId}"]`);
            if (activeEl) {
                const fill = activeEl.querySelector('.track-scrub-fill');
                const durBadge = activeEl.querySelector('.track-duration-badge');
                if (fill) fill.style.width = `${pct}%`;
                if (durBadge) durBadge.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
            }
        }
    });

    globalAudio.addEventListener('ended', () => {
        if (currentQueue && currentQueueIndex + 1 < currentQueue.length) {
            playTrackFromQueue(currentQueue, currentQueueIndex + 1);
        } else {
            updateAllBubblePlayStates();
        }
    });

    if (miniPlayPauseBtn) {
        miniPlayPauseBtn.addEventListener('click', () => {
            if (!globalAudio.src) return;
            if (globalAudio.paused) globalAudio.play();
            else globalAudio.pause();
        });
    }
    if (miniPrevBtn) {
        miniPrevBtn.addEventListener('click', () => {
            if (currentQueueIndex > 0) playTrackFromQueue(currentQueue, currentQueueIndex - 1);
            else globalAudio.currentTime = 0;
        });
    }
    if (miniNextBtn) {
        miniNextBtn.addEventListener('click', () => {
            if (currentQueue && currentQueueIndex + 1 < currentQueue.length) {
                playTrackFromQueue(currentQueue, currentQueueIndex + 1);
            }
        });
    }
    if (miniSeekSlider) {
        miniSeekSlider.addEventListener('input', () => {
            if (globalAudio.duration) {
                globalAudio.currentTime = (parseFloat(miniSeekSlider.value) / 100) * globalAudio.duration;
            }
        });
    }
    if (miniCloseBtn) {
        miniCloseBtn.addEventListener('click', () => {
            globalAudio.pause();
            if (miniPlayerBar) miniPlayerBar.classList.add('hidden');
        });
    }

    // --- 1-Click MP3 & Playlist ZIP Download Engine inside Chat Thread ---
    async function triggerTrackOrPlaylistDownload(tracksList, playlistTitle, statusContainer) {
        if (!tracksList || tracksList.length === 0) return;

        const isSingle = tracksList.length === 1;
        const increaseQuality = increaseQualityInput ? increaseQualityInput.checked : false;
        const autoAddAlbumArt = autoAddAlbumArtInput ? autoAddAlbumArtInput.checked : true;
        const transcribeAudio = attachLyricsInput ? attachLyricsInput.checked : false;
        const isRingtone = videoToMp3Input ? videoToMp3Input.checked : false;

        let box = null;
        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="bubble-conversion-box">
                    <div class="bubble-conversion-header">
                        <span class="conv-status-label">⚡ Initializing ${isSingle ? 'MP3 track' : `playlist (${tracksList.length} tracks)`}...</span>
                        <span class="conv-pct-label">0%</span>
                    </div>
                    <div class="bubble-progress-track">
                        <div class="bubble-progress-fill" style="width: 10%;"></div>
                    </div>
                    <div class="conv-action-slot"></div>
                </div>
            `;
            box = statusContainer.querySelector('.bubble-conversion-box');
        } else {
            showToast(`Preparing ${isSingle ? tracksList[0].title : playlistTitle}...`, 'info');
        }

        const updateBox = (label, pct, readyUrl = null, readyLabel = null) => {
            if (!box) return;
            const lbl = box.querySelector('.conv-status-label');
            const pctEl = box.querySelector('.conv-pct-label');
            const fill = box.querySelector('.bubble-progress-fill');
            const slot = box.querySelector('.conv-action-slot');
            if (lbl) lbl.textContent = label;
            if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
            if (fill) fill.style.width = `${Math.max(5, Math.min(100, pct))}%`;
            if (readyUrl && slot) {
                slot.innerHTML = `<a href="${readyUrl}" class="bubble-ready-download-link" target="_blank" download>✅ ${readyLabel || 'Click to Save File'}</a>`;
            }
        };

        try {
            const sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('sess_' + Date.now());
            let resp = await fetch(`${BACKEND_URL}/api/assistant/prepare_download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    tracks: tracksList,
                    playlist_title: playlistTitle,
                    increase_quality: increaseQuality,
                    auto_add_album_art: autoAddAlbumArt,
                    transcribe_audio: transcribeAudio,
                    is_ringtone: isRingtone
                })
            });

            // Fallback to /start_conversion if /api/assistant/prepare_download is not yet live on remote server
            if (resp.status === 404) {
                const firstQuery = tracksList[0].search_query || `ytsearch1:${tracksList[0].artist} - ${tracksList[0].title} official audio`;
                resp = await fetch(`${BACKEND_URL}/start_conversion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        url: firstQuery,
                        increase_quality: increaseQuality,
                        auto_add_album_art: autoAddAlbumArt,
                        transcribe_audio: transcribeAudio,
                        video_to_mp3: isRingtone,
                        is_ringtone: isRingtone
                    })
                });
            }

            const data = await resp.json();
            if (!resp.ok) {
                if (data.requires_payment) {
                    updateBox(`⚠️ ${data.error}`, 0);
                    openModal('accountModal');
                    return;
                }
                throw new Error(data.error || 'Failed to queue download');
            }

            pollConversionJobInChat(sessionId, isSingle, isRingtone, tracksList[0], updateBox);
            checkAuthStatus();
        } catch (err) {
            console.warn('Backend conversion queue error:', err);
            // Direct preview stream download fallback if backend is unreachable
            if (isSingle && tracksList[0].preview_url) {
                updateBox(
                    `✅ Instant Audio Stream Ready: ${tracksList[0].artist} - ${tracksList[0].title}`,
                    100,
                    tracksList[0].preview_url,
                    `Download Audio (${tracksList[0].title})`
                );
            } else {
                updateBox(`⚠️ Could not reach audio conversion server: ${err.message}`, 0);
            }
        }
    }

    function pollConversionJobInChat(sessionId, isSingle, isRingtone, firstTrack, updateBox) {
        const poll = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/status/${sessionId}`);
                if (!res.ok) throw new Error('Status check failed');
                const statusData = await res.json();

                if (statusData.status === 'queued') {
                    updateBox(`⏳ Queued (Position #${statusData.queue_position || 1})...`, 12);
                    setTimeout(poll, 1800);
                } else if (statusData.status === 'processing') {
                    const total = Math.max(1, statusData.total || 1);
                    const done = statusData.completed || 0;
                    const sub = statusData.sub_progress || 0;
                    const pct = Math.min(95, ((done + sub / 100) / total) * 100);
                    const stepText = statusData.current_status || `Processing track ${statusData.current_track || 1} of ${total}...`;
                    updateBox(`🎧 ${stepText}`, pct);
                    setTimeout(poll, 1500);
                } else if (statusData.status === 'completed') {
                    const ext = isRingtone ? 'm4r' : 'mp3';
                    const dlUrl = isSingle
                        ? `${BACKEND_URL}/download_mp3/${sessionId}?ext=${ext}`
                        : `${BACKEND_URL}${statusData.zip_path || `/download/${sessionId}/playlist_backup.zip`}`;
                    const label = isSingle
                        ? `Download ${ext.toUpperCase()} (${firstTrack ? firstTrack.title : 'Track'})`
                        : `Download Full Playlist (.ZIP)`;

                    updateBox(`🎉 Ready! High-res ID3 tags & cover art embedded.`, 100, dlUrl, label);
                    showToast('Your download is ready!', 'success');

                    // Trigger automatic download
                    const a = document.createElement('a');
                    a.href = dlUrl;
                    a.download = '';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } else {
                    updateBox(`⚠️ Error: ${statusData.error || 'Conversion interrupted'}`, 0);
                }
            } catch (e) {
                updateBox(`⚠️ Connection lost while checking status.`, 0);
            }
        };
        poll();
    }

    // --- Render User & Assistant Message Bubbles ---
    function scrollToBottom() {
        if (!chatMessages) return;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendUserBubble(text) {
        const row = document.createElement('div');
        row.className = 'msg-row user-row';
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        row.innerHTML = `
            <div class="msg-bubble user-bubble">
                <div class="msg-text"><p>${escapeHtml(text)}</p></div>
                <span class="msg-time">${nowStr} ✓✓</span>
            </div>
        `;
        chatMessages.appendChild(row);
        scrollToBottom();
    }

    function appendTypingBubble() {
        const row = document.createElement('div');
        row.className = 'msg-row assistant-row typing-row';
        row.innerHTML = `
            <div class="msg-avatar">🎧</div>
            <div class="msg-bubble assistant-bubble" style="max-width: 110px;">
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        `;
        chatMessages.appendChild(row);
        scrollToBottom();
        return row;
    }

    function appendAssistantMusicBubble(payload) {
        const tracks = (payload.tracks || []).map((t, i) => ({
            ...t,
            bubbleId: `b_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`
        }));
        const isPlaylist = tracks.length > 1;
        const playlistTitle = payload.playlist_title || 'Curated Selection';
        const playlistVibe = payload.playlist_vibe || '320kbps Studio Audio • Auto ID3 Tagged';
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const row = document.createElement('div');
        row.className = 'msg-row assistant-row';

        let playlistHeaderHtml = '';
        if (isPlaylist) {
            playlistHeaderHtml = `
                <div class="playlist-header-card">
                    <div class="playlist-header-meta">
                        <span class="playlist-badge-eyebrow">✨ AI CURATED PLAYLIST &bull; ${tracks.length} TRACKS</span>
                        <h3>${escapeHtml(playlistTitle)}</h3>
                        <span>${escapeHtml(playlistVibe)}</span>
                    </div>
                    <div class="playlist-header-actions">
                        <button type="button" class="btn-play-all-chat">▶ Play All in Chat</button>
                        <button type="button" class="btn-download-playlist-zip">📦 Download Playlist (.ZIP)</button>
                    </div>
                </div>
            `;
        }

        const tracksHtml = tracks.map((t, idx) => {
            const art = t.artwork_url || 'favicon.png';
            const subMeta = [t.artist, t.album, t.year].filter(Boolean).join(' • ');
            const isRingtoneMode = (payload.mode === 'ringtone') || (videoToMp3Input && videoToMp3Input.checked);
            return `
                <div class="track-audio-bubble" data-bubble-id="${t.bubbleId}" data-track-idx="${idx}">
                    <div class="track-cover-wrap">
                        <img src="${escapeHtml(art)}" alt="${escapeHtml(t.title)}" class="track-cover-img" loading="lazy" onerror="this.src='favicon.png'">
                    </div>
                    <button type="button" class="track-play-btn" title="Play track in chat" aria-label="Play ${escapeHtml(t.title)}">▶</button>
                    <div class="track-bubble-center">
                        <div class="track-title-line">
                            <span class="track-title-text">${escapeHtml(t.title)}</span>
                            <span class="track-duration-badge">${escapeHtml(t.duration || '3:30')}</span>
                        </div>
                        <div class="track-sub-line">
                            <span class="track-quality-pill">320k ID3</span>
                            <span>${escapeHtml(subMeta)}</span>
                        </div>
                        <div class="track-waveform-row">
                            <div class="track-scrub-bar" title="Click to seek">
                                <div class="track-scrub-fill"></div>
                            </div>
                        </div>
                    </div>
                    <div class="track-dl-actions">
                        <button type="button" class="btn-track-mp3" data-idx="${idx}">
                            ${isRingtoneMode ? '⬇ Ringtone' : '⬇ MP3'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        row.innerHTML = `
            <div class="msg-avatar">🎧</div>
            <div class="msg-bubble assistant-bubble">
                <div class="msg-sender-name">
                    <span>MP3aud.io Assistant</span>
                    <span class="msg-time">${nowStr}</span>
                </div>
                <div class="msg-text">
                    <p>${formatMarkdownBold(payload.reply || 'Here are your tracks!')}</p>
                </div>
                ${playlistHeaderHtml}
                <div class="tracks-bubble-stack">
                    ${tracksHtml}
                </div>
                <div class="bubble-conversion-container"></div>
            </div>
        `;

        chatMessages.appendChild(row);
        scrollToBottom();

        const bubbleEl = row.querySelector('.assistant-bubble');
        const statusContainer = bubbleEl.querySelector('.bubble-conversion-container');

        // Wire up Play buttons & Scrubbing on each track bubble
        bubbleEl.querySelectorAll('.track-audio-bubble').forEach(trackEl => {
            const idx = parseInt(trackEl.getAttribute('data-track-idx'), 10);
            const playBtn = trackEl.querySelector('.track-play-btn');
            const scrubBar = trackEl.querySelector('.track-scrub-bar');
            const dlBtn = trackEl.querySelector('.btn-track-mp3');

            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    playTrackFromQueue(tracks, idx);
                });
            }
            if (scrubBar) {
                scrubBar.addEventListener('click', (e) => {
                    const rect = scrubBar.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    if (activeBubbleId !== tracks[idx].bubbleId) {
                        playTrackFromQueue(tracks, idx);
                    } else if (globalAudio.duration) {
                        globalAudio.currentTime = ratio * globalAudio.duration;
                    }
                });
            }
            if (dlBtn) {
                dlBtn.addEventListener('click', () => {
                    triggerTrackOrPlaylistDownload([tracks[idx]], `${tracks[idx].artist} - ${tracks[idx].title}`, statusContainer);
                });
            }
        });

        // Wire up Playlist-level Play All & Download ZIP buttons
        const playAllBtn = bubbleEl.querySelector('.btn-play-all-chat');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => {
                playTrackFromQueue(tracks, 0);
            });
        }

        const zipBtn = bubbleEl.querySelector('.btn-download-playlist-zip');
        if (zipBtn) {
            zipBtn.addEventListener('click', () => {
                triggerTrackOrPlaylistDownload(tracks, playlistTitle, statusContainer);
            });
        }
    }

    // --- Send Message Handler (Text Request or Attached Local Files) ---
    async function sendUserMessage(customText = null) {
        if (pendingFiles.length > 0 && !customText) {
            await handleSendLocalFilesInChat();
            return;
        }

        const text = (customText !== null ? customText : (chatInput ? chatInput.value : '')).trim();
        if (!text) return;

        if (customText === null && chatInput) {
            chatInput.value = '';
            chatInput.style.height = 'auto';
        }

        appendUserBubble(text);
        saveRecentPrompt(text);
        chatHistory.push({ role: 'user', content: text });

        const typingRow = appendTypingBubble();

        try {
            let result = null;
            try {
                const resp = await fetch(`${BACKEND_URL}/api/assistant/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: text,
                        history: chatHistory.slice(-6),
                        options: {
                            auto_add_album_art: autoAddAlbumArtInput ? autoAddAlbumArtInput.checked : true,
                            increase_quality: increaseQualityInput ? increaseQualityInput.checked : false,
                            is_ringtone: videoToMp3Input ? videoToMp3Input.checked : false,
                            transcribe_audio: attachLyricsInput ? attachLyricsInput.checked : false
                        }
                    })
                });
                if (resp.ok) {
                    result = await resp.json();
                }
            } catch (networkErr) {
                console.info('Using direct client curation fallback:', networkErr);
            }

            if (!result || !result.success) {
                result = await clientSideCurateFallback(text);
            }

            typingRow.remove();
            appendAssistantMusicBubble(result);
            chatHistory.push({ role: 'assistant', content: result.reply || '' });
        } catch (err) {
            typingRow.remove();
            showToast('Something went wrong processing your message.', 'error');
        }
    }

    // --- Local File Upload in Chat ---
    function setPendingFiles(fileList) {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;
        const MAX_SIZE = 50 * 1024 * 1024;
        if (files.some(f => f.size > MAX_SIZE)) {
            showToast('One or more files exceed the 50MB per-track limit.', 'error');
            return;
        }
        pendingFiles = files;
        if (attachedFilesPreview && attachedFilesLabel) {
            attachedFilesLabel.textContent = files.length === 1
                ? `📎 ${files[0].name}`
                : `📎 ${files.length} media files attached`;
            attachedFilesPreview.classList.remove('hidden');
        }
    }

    async function handleSendLocalFilesInChat() {
        const files = [...pendingFiles];
        pendingFiles = [];
        if (fileInput) fileInput.value = '';
        if (attachedFilesPreview) attachedFilesPreview.classList.add('hidden');

        const userText = (chatInput && chatInput.value.trim())
            ? chatInput.value.trim()
            : `Enhance & tag ${files.length === 1 ? files[0].name : `${files.length} media files`}`;
        if (chatInput) chatInput.value = '';

        appendUserBubble(`📎 ${userText}`);

        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const row = document.createElement('div');
        row.className = 'msg-row assistant-row';
        row.innerHTML = `
            <div class="msg-avatar">🎧</div>
            <div class="msg-bubble assistant-bubble">
                <div class="msg-sender-name">
                    <span>MP3aud.io Assistant</span>
                    <span class="msg-time">${nowStr}</span>
                </div>
                <div class="msg-text">
                    <p>I received your <strong>${files.length} media ${files.length === 1 ? 'file' : 'files'}</strong>! Processing with your selected audio &amp; metadata enhancements now:</p>
                </div>
                <div class="bubble-conversion-container">
                    <div class="bubble-conversion-box">
                        <div class="bubble-conversion-header">
                            <span class="conv-status-label">📤 Uploading media files...</span>
                            <span class="conv-pct-label">10%</span>
                        </div>
                        <div class="bubble-progress-track">
                            <div class="bubble-progress-fill" style="width: 10%;"></div>
                        </div>
                        <div class="conv-action-slot"></div>
                    </div>
                </div>
            </div>
        `;
        chatMessages.appendChild(row);
        scrollToBottom();

        const box = row.querySelector('.bubble-conversion-box');
        const updateBox = (label, pct, readyUrl = null, readyLabel = null) => {
            const lbl = box.querySelector('.conv-status-label');
            const pctEl = box.querySelector('.conv-pct-label');
            const fill = box.querySelector('.bubble-progress-fill');
            const slot = box.querySelector('.conv-action-slot');
            if (lbl) lbl.textContent = label;
            if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
            if (fill) fill.style.width = `${Math.max(5, Math.min(100, pct))}%`;
            if (readyUrl && slot) {
                slot.innerHTML = `<a href="${readyUrl}" class="bubble-ready-download-link" target="_blank" download>✅ ${readyLabel || 'Download Processed Files'}</a>`;
            }
        };

        try {
            const sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('sess_' + Date.now());
            const formData = new FormData();
            formData.append('session_id', sessionId);
            files.forEach(f => formData.append('files', f));
            formData.append('auto_add_album_art', autoAddAlbumArtInput ? String(autoAddAlbumArtInput.checked) : 'true');
            formData.append('increase_quality', increaseQualityInput ? String(increaseQualityInput.checked) : 'false');
            formData.append('video_to_mp3', videoToMp3Input ? String(videoToMp3Input.checked) : 'false');
            formData.append('attach_lyrics', attachLyricsInput ? String(attachLyricsInput.checked) : 'false');

            const resp = await fetch(`${BACKEND_URL}/process_local_files`, {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();
            if (!resp.ok) {
                if (data.requires_payment) {
                    updateBox(`⚠️ ${data.error}`, 0);
                    openModal('accountModal');
                    return;
                }
                throw new Error(data.error || 'Upload failed');
            }
            pollConversionJobInChat(sessionId, files.length === 1, videoToMp3Input && videoToMp3Input.checked, { title: files[0].name }, updateBox);
            checkAuthStatus();
        } catch (err) {
            updateBox(`⚠️ Upload error: ${err.message}`, 0);
        }
    }

    if (attachFileBtn && fileInput) {
        attachFileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => setPendingFiles(fileInput.files));
    }
    if (clearAttachedFilesBtn) {
        clearAttachedFilesBtn.addEventListener('click', () => {
            pendingFiles = [];
            if (fileInput) fileInput.value = '';
            if (attachedFilesPreview) attachedFilesPreview.classList.add('hidden');
        });
    }

    // Drag and drop files anywhere into window
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
            dragCounter++;
            if (dragDropOverlay) dragDropOverlay.classList.remove('hidden');
        }
    });
    window.addEventListener('dragleave', () => {
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0 && dragDropOverlay) dragDropOverlay.classList.add('hidden');
    });
    window.addEventListener('drop', (e) => {
        dragCounter = 0;
        if (dragDropOverlay) dragDropOverlay.classList.add('hidden');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setPendingFiles(e.dataTransfer.files);
            handleSendLocalFilesInChat();
        }
    });

    // --- Composer Input & Quick Prompt Wiring ---
    if (chatComposerForm) {
        chatComposerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendUserMessage();
        });
    }
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendUserMessage();
            }
        });
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(110, chatInput.scrollHeight) + 'px';
        });
    }

    document.querySelectorAll('[data-prompt]').forEach(btn => {
        btn.addEventListener('click', () => {
            const promptText = btn.getAttribute('data-prompt');
            toggleSidebar(false);
            sendUserMessage(promptText);
        });
    });

    // --- Voice Input (Web Speech API) ---
    if (voiceInputBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;

            recognition.onstart = () => {
                voiceInputBtn.classList.add('recording');
                showToast('Listening... speak a song, artist, or playlist vibe!');
            };
            recognition.onend = () => {
                voiceInputBtn.classList.remove('recording');
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) {
                    if (chatInput) chatInput.value = transcript;
                    sendUserMessage(transcript);
                }
            };
            voiceInputBtn.addEventListener('click', () => {
                try { recognition.start(); } catch (e) { recognition.stop(); }
            });
        } else {
            voiceInputBtn.addEventListener('click', () => {
                showToast('Voice dictation is not supported in this browser.', 'info');
            });
        }
    }

    // --- WhatsApp & Telegram Bot Info & Webhook Binding ---
    async function loadBotConfig() {
        try {
            const res = await fetch(`${BACKEND_URL}/api/assistant/bot-info`);
            if (!res.ok) return;
            const info = await res.json();
            if (info.telegram_url) {
                const sTg = document.getElementById('sidebarTelegramLink');
                const mTg = document.getElementById('modalTelegramBtn');
                const hTg = document.getElementById('tgBotHandleDisplay');
                const qTg = document.getElementById('tgQrImage');
                if (sTg) sTg.href = info.telegram_url;
                if (mTg) mTg.href = info.telegram_url;
                if (hTg && info.telegram_bot_username) hTg.textContent = info.telegram_bot_username;
                if (qTg) qTg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(info.telegram_url)}`;
            }
            if (info.whatsapp_url) {
                const sWa = document.getElementById('sidebarWhatsappLink');
                const mWa = document.getElementById('modalWhatsappBtn');
                const qWa = document.getElementById('waQrImage');
                if (sWa) sWa.href = info.whatsapp_url;
                if (mWa) mWa.href = info.whatsapp_url;
                if (qWa) qWa.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(info.whatsapp_url)}`;
            }
        } catch (e) { }
    }
    loadBotConfig();

    const bindTelegramWebhookBtn = document.getElementById('bindTelegramWebhookBtn');
    if (bindTelegramWebhookBtn) {
        bindTelegramWebhookBtn.addEventListener('click', async () => {
            const tokenInput = document.getElementById('tgBotTokenInput');
            const statusMsg = document.getElementById('botSetupStatusMsg');
            const botToken = tokenInput ? tokenInput.value.trim() : '';
            if (statusMsg) statusMsg.textContent = 'Registering Telegram webhook...';
            try {
                const res = await fetch(`${BACKEND_URL}/api/bot/setup-telegram`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bot_token: botToken })
                });
                const data = await res.json();
                if (res.ok && data.ok) {
                    if (statusMsg) statusMsg.innerHTML = `<span style="color:#4ade80;">✅ Telegram Webhook bound! Message your bot now.</span>`;
                } else {
                    if (statusMsg) statusMsg.innerHTML = `<span style="color:#f87171;">⚠️ ${escapeHtml(data.description || data.error || 'Failed to bind webhook')}</span>`;
                }
            } catch (e) {
                if (statusMsg) statusMsg.innerHTML = `<span style="color:#f87171;">⚠️ Could not reach backend webhook endpoint.</span>`;
            }
        });
    }

    // --- Authentication, Magic Link & Stripe Checkout Integration ---
    async function checkAuthStatus() {
        try {
            const res = await fetch(`${BACKEND_URL}/auth/me`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.token) localStorage.setItem('session_token', data.token);

            const credits = data.paid_track_credits || 0;
            if (paidCreditsDisplay) paidCreditsDisplay.textContent = credits;
            if (headerPaidCreditsDisplay) headerPaidCreditsDisplay.textContent = credits;

            if (data.authenticated && data.email) {
                if (userDashboard) userDashboard.classList.remove('hidden');
                if (guestPricingGrid) guestPricingGrid.classList.add('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = data.email;
                if (sidebarAccountLabel) sidebarAccountLabel.textContent = data.email;
                if (sidebarAccountSub) sidebarAccountSub.textContent = `Logged In • Priority Queue Active`;
                if (headerAccountBtnText) headerAccountBtnText.textContent = `${credits} Credits`;
            } else {
                if (userDashboard) userDashboard.classList.add('hidden');
                if (guestPricingGrid) guestPricingGrid.classList.remove('hidden');
                if (sidebarAccountLabel) sidebarAccountLabel.textContent = 'Free Guest Pass';
                if (sidebarAccountSub) sidebarAccountSub.textContent = '5 Free Tracks/Req • Tap for Credits';
                if (headerAccountBtnText) headerAccountBtnText.textContent = 'Sign In / Credits';
            }
        } catch (e) { }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const magicToken = urlParams.get('token');
    if (magicToken) {
        fetch(`${BACKEND_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: magicToken })
        })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.token) {
                    localStorage.setItem('session_token', data.token);
                    showToast('Logged in! Your credits are ready.', 'success');
                    checkAuthStatus();
                } else {
                    showToast(data.error || 'Login link expired.', 'error');
                }
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(() => { });
    } else {
        checkAuthStatus();
    }

    if (urlParams.get('success')) {
        showToast('Payment successful! +350 Track Credits added.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
        checkAuthStatus();
    } else if (urlParams.get('canceled')) {
        showToast('Checkout canceled.', 'info');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Handle deep-linked query (?q= or ?url=) from WhatsApp / Telegram / Share links
    const initialQuery = urlParams.get('q') || urlParams.get('url');
    if (initialQuery) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => sendUserMessage(initialQuery), 300);
    }

    if (sendLinkBtn && loginEmail) {
        sendLinkBtn.addEventListener('click', async () => {
            const email = loginEmail.value.trim();
            if (!email) {
                if (authMessage) authMessage.innerHTML = `<span style="color:#f87171; font-size:0.78rem;">Please enter your email address.</span>`;
                return;
            }
            sendLinkBtn.disabled = true;
            sendLinkBtn.textContent = 'Sending...';
            try {
                const res = await fetch(`${BACKEND_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (authMessage) authMessage.innerHTML = `<span style="color:#4ade80; font-size:0.78rem;">✅ Magic login link sent! Check your email inbox.</span>`;
                } else {
                    if (authMessage) authMessage.innerHTML = `<span style="color:#f87171; font-size:0.78rem;">⚠️ ${escapeHtml(data.error || 'Failed to send link')}</span>`;
                }
            } catch (e) {
                if (authMessage) authMessage.innerHTML = `<span style="color:#f87171; font-size:0.78rem;">⚠️ Network error sending login link.</span>`;
            } finally {
                sendLinkBtn.disabled = false;
                sendLinkBtn.textContent = 'Send Login Link';
            }
        });
    }

    if (buyCreditsBtn) {
        buyCreditsBtn.addEventListener('click', async () => {
            buyCreditsBtn.disabled = true;
            buyCreditsBtn.textContent = 'Redirecting to Stripe...';
            try {
                const res = await fetch(`${BACKEND_URL}/create-checkout-session`, { method: 'POST' });
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    showToast(data.error || 'Please sign in first.', 'error');
                    buyCreditsBtn.disabled = false;
                    buyCreditsBtn.textContent = 'Buy 350 Credits ($3.99)';
                }
            } catch (e) {
                showToast('Could not start checkout.', 'error');
                buyCreditsBtn.disabled = false;
                buyCreditsBtn.textContent = 'Buy 350 Credits ($3.99)';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            localStorage.removeItem('session_token');
            try { await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST' }); } catch (e) { }
            checkAuthStatus();
            showToast('Signed out.');
        });
    }
});
