document.addEventListener('DOMContentLoaded', () => {
    if (window.__MP3AUDIO_ASSISTANT_INIT__) return;
    window.__MP3AUDIO_ASSISTANT_INIT__ = true;
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
        return escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
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
            chatHistory = [];
            assistantMemory.awaitingPlaylistVibe = false;
            assistantMemory.pendingVibeKey = '';
            assistantMemory.pendingTopic = '';
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="chat-date-divider">
                        <span>ENCRYPTED MUSIC MESSENGER &bull; INSTANT MP3 &amp; PLAYLIST DELIVERY</span>
                    </div>
                    <div class="msg-row assistant-row">
                        <div class="msg-avatar">🎧</div>
                        <div class="msg-bubble assistant-bubble welcome-bubble">
                            <div class="msg-sender-name">MP3aud.io Assistant <span class="msg-time">Just now</span></div>
                            <div class="msg-text">
                                <p>Hey! 👋 How's your day going? We can chat about whatever's on your mind, talk about your favorite artists, or whenever you'd like me to put together a playlist or pull up a song, just let me know.</p>
                                <div class="server-wake-notice" style="margin-top: 10px; padding: 9px 12px; background: rgba(59, 130, 246, 0.12); border-left: 3px solid #3b82f6; border-radius: 6px; font-size: 0.82rem; color: #93c5fd; line-height: 1.45;">
                                    ⏱️ <strong>Note:</strong> If the chat bot was asleep, it will wake up in about <strong>60 seconds</strong> on your first message. Once awake, real-time AI conversation and instant track curation are active!
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            if (chatInput) {
                chatInput.value = '';
                chatInput.focus();
            }
        });
    }

    // --- Fast Non-Blocking Network Helpers (Prevents Any Playlist Request from Stalling) ---
    const itunesResultCache = new Map();
    const shownTrackKeys = new Set();
    let lastVibeKey = '';
    let rotationCursor = 0;
    let isBackendAwake = false;
    let serverWakeSecondsRemaining = 55;
    let serverWakeCountdownTimer = null;
    let serverWakePollTimer = null;

    function unlockChatAfterWake() {
        if (isBackendAwake) return;
        isBackendAwake = true;
        if (serverWakeCountdownTimer) clearInterval(serverWakeCountdownTimer);
        if (serverWakePollTimer) clearInterval(serverWakePollTimer);

        const wakeCard = document.getElementById('serverWakeCard');
        const wakeTitle = document.getElementById('serverWakeTitle');
        const wakeSub = document.getElementById('serverWakeSub');
        const chatComposer = document.querySelector('.chat-composer');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendMessageBtn');

        if (wakeCard) {
            wakeCard.classList.add('awake-success');
            if (wakeTitle) wakeTitle.innerHTML = '<span>✅</span> Cloud Server Awake &amp; AI Ready!';
            if (wakeSub) wakeSub.textContent = 'Render cloud backend is online. Instant conversation & audio curation unlocked!';
            setTimeout(() => {
                wakeCard.style.opacity = '0';
                wakeCard.style.transform = 'translateY(-6px)';
                setTimeout(() => {
                    wakeCard.style.display = 'none';
                }, 350);
            }, 1500);
        }

        if (chatComposer) {
            chatComposer.classList.remove('server-sleeping');
        }
        if (chatInput) {
            chatInput.removeAttribute('disabled');
            chatInput.placeholder = 'Text MP3aud.io for any song, artist, playlist vibe, or paste a link...';
        }
        if (sendBtn) {
            sendBtn.removeAttribute('disabled');
        }
        if (assistantStatusText) {
            assistantStatusText.innerHTML = 'Online &bull; AI Personal Assistant &amp; DJ';
        }
    }

    function initServerWakeGate() {
        if (window.__serverWakeGateInitialized) return;
        window.__serverWakeGateInitialized = true;

        const wakeCard = document.getElementById('serverWakeCard');
        const wakeCountdownEl = document.getElementById('serverWakeCountdown');
        const chatComposer = document.querySelector('.chat-composer');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendMessageBtn');

        const probeServer = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);
                const r = await fetch(`${BACKEND_URL}/health`, { cache: 'no-store', signal: controller.signal });
                clearTimeout(timeoutId);
                if (r && r.ok) {
                    unlockChatAfterWake();
                    return true;
                }
            } catch (_) {}
            return false;
        };

        // Check if server is already awake immediately
        probeServer().then(awake => {
            if (awake) return;

            // Only show wake card if server is actually sleeping
            if (!isBackendAwake) {
                if (wakeCard) wakeCard.style.display = 'flex';
                if (chatComposer) chatComposer.classList.add('server-sleeping');
                if (assistantStatusText) {
                    assistantStatusText.innerHTML = '⏱️ Cloud server waking up... (~55s)';
                }
            }

            serverWakeCountdownTimer = setInterval(() => {
                if (serverWakeSecondsRemaining > 1) {
                    serverWakeSecondsRemaining--;
                    if (wakeCountdownEl) {
                        wakeCountdownEl.textContent = `${serverWakeSecondsRemaining}s`;
                    }
                    if (assistantStatusText && !isBackendAwake) {
                        assistantStatusText.innerHTML = `⏱️ Cloud server waking up... (~${serverWakeSecondsRemaining}s remaining)`;
                    }
                } else {
                    if (wakeCountdownEl) wakeCountdownEl.textContent = 'ready!';
                    unlockChatAfterWake();
                }
            }, 1000);

            serverWakePollTimer = setInterval(async () => {
                if (isBackendAwake) {
                    clearInterval(serverWakePollTimer);
                    return;
                }
                const ok = await probeServer();
                if (ok) {
                    clearInterval(serverWakePollTimer);
                }
            }, 2500);
        });
    }

    function initAiKeyConfig() {
        const keyInput = document.getElementById('customAiKeyInput');
        const saveBtn = document.getElementById('saveAiKeyBtn');
        const clearBtn = document.getElementById('clearAiKeyBtn');
        const badge = document.getElementById('aiKeyStatusBadge');
        const successNotice = document.getElementById('aiKeySuccessNotice');

        const updateStatus = () => {
            const saved = (localStorage.getItem('mp3audio_custom_ai_key') || '').trim();
            if (saved) {
                if (keyInput) keyInput.value = saved;
                if (badge) {
                    if (saved.startsWith('gsk_')) {
                        badge.textContent = '⚡ Groq Llama 3.3 70B Active';
                        badge.style.background = 'rgba(16, 185, 129, 0.2)';
                        badge.style.color = '#6ee7b7';
                    } else if (saved.startsWith('sk-or-')) {
                        badge.textContent = '⚡ OpenRouter Active';
                        badge.style.background = 'rgba(16, 185, 129, 0.2)';
                        badge.style.color = '#6ee7b7';
                    } else {
                        badge.textContent = '⚡ OpenAI GPT-4o Active';
                        badge.style.background = 'rgba(16, 185, 129, 0.2)';
                        badge.style.color = '#6ee7b7';
                    }
                }
                if (clearBtn) clearBtn.classList.remove('hidden');
            } else {
                if (keyInput) keyInput.value = '';
                if (badge) {
                    badge.textContent = 'Default Studio AI';
                    badge.style.background = 'rgba(59, 130, 246, 0.2)';
                    badge.style.color = '#93c5fd';
                }
                if (clearBtn) clearBtn.classList.add('hidden');
            }
        };

        if (saveBtn && keyInput) {
            saveBtn.addEventListener('click', () => {
                const val = (keyInput.value || '').trim();
                if (!val) {
                    showToast('Please enter an API key or leave empty for default AI.', 'warning');
                    return;
                }
                try {
                    localStorage.setItem('mp3audio_custom_ai_key', val);
                    updateStatus();
                    if (successNotice) {
                        successNotice.classList.remove('hidden');
                        setTimeout(() => successNotice.classList.add('hidden'), 4000);
                    }
                    showToast('AI Key saved! Live high-speed Llama 3.3 70B inference active.', 'success');
                } catch (e) {
                    console.error('Storage error:', e);
                }
            });
        }

        if (clearBtn && keyInput) {
            clearBtn.addEventListener('click', () => {
                try {
                    localStorage.removeItem('mp3audio_custom_ai_key');
                    updateStatus();
                    showToast('Custom key removed. Restored default AI.', 'info');
                } catch (e) {
                    console.error('Storage error:', e);
                }
            });
        }

        updateStatus();
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 2000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        } finally {
            clearTimeout(timer);
        }
    }

    function itunesSearchJsonp(term, limit = 6, timeoutMs = 2000) {
        return new Promise((resolve) => {
            const cbName = '__mp3audio_itunes_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            const script = document.createElement('script');
            let settled = false;

            const cleanup = () => {
                try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
                if (script.parentNode) script.parentNode.removeChild(script);
            };

            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve([]);
            }, timeoutMs);

            window[cbName] = (data) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cleanup();
                resolve((data && Array.isArray(data.results)) ? data.results : []);
            };

            script.onerror = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cleanup();
                resolve([]);
            };

            script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}&callback=${cbName}`;
            document.head.appendChild(script);
        });
    }

    async function searchItunesFast(term, limit = 8, timeoutMs = 1700) {
        const cacheKey = `${term.toLowerCase().trim()}|${limit}`;
        if (itunesResultCache.has(cacheKey)) {
            return itunesResultCache.get(cacheKey);
        }
        try {
            const resp = await fetchWithTimeout(
                `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`,
                {},
                timeoutMs
            );
            if (resp && resp.ok) {
                const data = await resp.json();
                if (data && Array.isArray(data.results) && data.results.length > 0) {
                    itunesResultCache.set(cacheKey, data.results);
                    return data.results;
                }
            }
        } catch (_) {
            // Fall through to fast JSONP fallback if fetch is rate-limited or CORS-blocked
        }
        const jsonpResults = await itunesSearchJsonp(term, limit, timeoutMs);
        if (jsonpResults.length > 0) {
            itunesResultCache.set(cacheKey, jsonpResults);
        }
        return jsonpResults;
    }

    // --- Built-in Client-Side Curation Engine (12 Vibes x 12 Tracks + Instant Enrichment) ---
    const CLIENT_VIBE_SEEDS = {
        synthwave: {
            title: "Midnight Neon: Chill Synthwave Mix",
            altTitle: "Cyberpunk Horizon: Late-Night Outrun Vol. 2",
            vibe: "Warm analog synths, retro arpeggios & late-night drive energy",
            batchTerm: "synthwave retrowave outrun",
            seeds: [
                { title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", year: "2011", duration: "4:03", duration_sec: 243 },
                { title: "Nightcall", artist: "Kavinsky", album: "OutRun", year: "2010", duration: "4:18", duration_sec: 258 },
                { title: "Sunset", artist: "The Midnight", album: "Endless Summer", year: "2016", duration: "5:26", duration_sec: 326 },
                { title: "Tech Noir", artist: "GUNSHIP", album: "GUNSHIP", year: "2015", duration: "4:57", duration_sec: 297 },
                { title: "After Dark", artist: "Mr.Kitty", album: "Time", year: "2014", duration: "4:19", duration_sec: 259 },
                { title: "Running in the Night", artist: "FM-84", album: "Atlas", year: "2016", duration: "4:30", duration_sec: 270 },
                { title: "Blinding Lights", artist: "The Weeknd", album: "After Hours", year: "2020", duration: "3:20", duration_sec: 200 },
                { title: "Days of Thunder", artist: "The Midnight", album: "Days of Thunder", year: "2014", duration: "5:05", duration_sec: 305 },
                { title: "A Real Hero", artist: "College & Electric Youth", album: "Drive OST", year: "2011", duration: "4:27", duration_sec: 267 },
                { title: "Turbo Killer", artist: "Carpenter Brut", album: "EP III", year: "2015", duration: "3:28", duration_sec: 208 },
                { title: "Pacific Coast Highway", artist: "Kavinsky", album: "OutRun", year: "2013", duration: "6:18", duration_sec: 378 },
                { title: "Los Angeles", artist: "The Midnight", album: "Days of Thunder", year: "2014", duration: "6:29", duration_sec: 389 }
            ]
        },
        workout: {
            title: "High-Octane Gym & Workout Anthems",
            altTitle: "Beast Mode: PR & Heavy Lift Session Vol. 2",
            vibe: "Heavy bass, relentless tempo & peak adrenaline",
            batchTerm: "workout motivation gym hits",
            seeds: [
                { title: "Stronger", artist: "Kanye West", album: "Graduation", year: "2007", duration: "5:11", duration_sec: 311 },
                { title: "Till I Collapse", artist: "Eminem", album: "The Eminem Show", year: "2002", duration: "4:57", duration_sec: 297 },
                { title: "HUMBLE.", artist: "Kendrick Lamar", album: "DAMN.", year: "2017", duration: "2:57", duration_sec: 177 },
                { title: "POWER", artist: "Kanye West", album: "My Beautiful Dark Twisted Fantasy", year: "2010", duration: "4:52", duration_sec: 292 },
                { title: "Eye of the Tiger", artist: "Survivor", album: "Eye of the Tiger", year: "1982", duration: "4:05", duration_sec: 245 },
                { title: "Titanium (feat. Sia)", artist: "David Guetta", album: "Nothing but the Beat", year: "2011", duration: "4:05", duration_sec: 245 },
                { title: "Lose Yourself", artist: "Eminem", album: "8 Mile", year: "2002", duration: "5:26", duration_sec: 326 },
                { title: "DNA.", artist: "Kendrick Lamar", album: "DAMN.", year: "2017", duration: "3:05", duration_sec: 185 },
                { title: "Can't Hold Us", artist: "Macklemore & Ryan Lewis", album: "The Heist", year: "2012", duration: "4:18", duration_sec: 258 },
                { title: "Remember the Name", artist: "Fort Minor", album: "The Rising Tied", year: "2005", duration: "3:50", duration_sec: 230 },
                { title: "SICKO MODE", artist: "Travis Scott", album: "ASTROWORLD", year: "2018", duration: "5:12", duration_sec: 312 },
                { title: "Turn Down for What", artist: "DJ Snake & Lil Jon", album: "Single", year: "2013", duration: "3:33", duration_sec: 213 }
            ]
        },
        "hip hop": {
            title: "Golden Era & Modern Hip-Hop Essentials",
            altTitle: "Boom-Bap & 808 Crown Jewels Vol. 2",
            vibe: "Boom-bap classics, sharp lyricism & iconic 808s",
            batchTerm: "90s hip hop classics rap",
            seeds: [
                { title: "N.Y. State of Mind", artist: "Nas", album: "Illmatic", year: "1994", duration: "4:54", duration_sec: 294 },
                { title: "Shook Ones, Pt. II", artist: "Mobb Deep", album: "The Infamous", year: "1995", duration: "5:25", duration_sec: 325 },
                { title: "C.R.E.A.M.", artist: "Wu-Tang Clan", album: "Enter the Wu-Tang (36 Chambers)", year: "1993", duration: "4:12", duration_sec: 252 },
                { title: "Juicy", artist: "The Notorious B.I.G.", album: "Ready to Die", year: "1994", duration: "5:02", duration_sec: 302 },
                { title: "Still D.R.E.", artist: "Dr. Dre", album: "2001", year: "1999", duration: "4:30", duration_sec: 270 },
                { title: "Money Trees", artist: "Kendrick Lamar", album: "good kid, m.A.A.d city", year: "2012", duration: "6:26", duration_sec: 386 },
                { title: " California Love", artist: "2Pac", album: "All Eyez on Me", year: "1995", duration: "4:44", duration_sec: 284 },
                { title: "Hypnotize", artist: "The Notorious B.I.G.", album: "Life After Death", year: "1997", duration: "3:50", duration_sec: 230 },
                { title: "Ms. Jackson", artist: "OutKast", album: "Stankonia", year: "2000", duration: "4:30", duration_sec: 270 },
                { title: "In Da Club", artist: "50 Cent", album: "Get Rich or Die Tryin'", year: "2003", duration: "3:13", duration_sec: 193 },
                { title: "Flashing Lights", artist: "Kanye West", album: "Graduation", year: "2007", duration: "3:57", duration_sec: 237 },
                { title: "No Role Modelz", artist: "J. Cole", album: "2014 Forest Hills Drive", year: "2014", duration: "4:52", duration_sec: 292 }
            ]
        },
        lofi: {
            title: "Lo-Fi Study & Rainy Window Beats",
            altTitle: "Midnight Desk Lamp: Chillhop & Lo-Fi Vol. 2",
            vibe: "Dusty vinyl crackle, warm Rhodes chords & mellow boom-bap",
            batchTerm: "lofi chill beats study",
            seeds: [
                { title: "Snowman", artist: "WYS", album: "1 Am. Study Session", year: "2019", duration: "3:15", duration_sec: 195 },
                { title: "Feather", artist: "Nujabes", album: "Modal Soul", year: "2005", duration: "2:55", duration_sec: 175 },
                { title: "Coffee", artist: "beabadoobee", album: "Patched Up", year: "2017", duration: "2:06", duration_sec: 126 },
                { title: "Affection", artist: "Jinsang", album: "Life", year: "2016", duration: "1:59", duration_sec: 119 },
                { title: "5:32pm", artist: "The Deli", album: "Vibes 2", year: "2017", duration: "2:12", duration_sec: 132 },
                { title: "Luv(sic) Part 3", artist: "Nujabes", album: "Modal Soul", year: "2005", duration: "5:36", duration_sec: 336 },
                { title: "aruarian dance", artist: "Nujabes", album: "Samurai Champloo", year: "2004", duration: "4:10", duration_sec: 250 },
                { title: "Death Bed (Coffee for Your Head)", artist: "Powfu", album: "Poems of the Past", year: "2020", duration: "2:53", duration_sec: 173 },
                { title: "Can We Kiss Forever?", artist: "Kina", album: "Things I Wanted To Tell You", year: "2018", duration: "3:07", duration_sec: 187 },
                { title: "Sunday Morning", artist: "Mitchum Yacoub", album: "Chill Sessions", year: "2021", duration: "3:02", duration_sec: 182 },
                { title: "Warm Breeze", artist: "Kupla", album: "Kingdom in Blue", year: "2020", duration: "2:34", duration_sec: 154 },
                { title: "controlla", artist: "Idealism", album: "rainy evening", year: "2017", duration: "2:00", duration_sec: 120 }
            ]
        },
        chill: {
            title: "Late-Night Velvet & Sunset Chill Vibes",
            altTitle: "Golden Hour Drift: Indie & Chill Vol. 2",
            vibe: "Smooth grooves, dreamy textures & laid-back atmosphere",
            batchTerm: "chill indie vibes late night",
            seeds: [
                { title: "Redbone", artist: "Childish Gambino", album: "Awaken, My Love!", year: "2016", duration: "5:26", duration_sec: 326 },
                { title: "Pink + White", artist: "Frank Ocean", album: "Blonde", year: "2016", duration: "3:04", duration_sec: 184 },
                { title: "Electric Feel", artist: "MGMT", album: "Oracular Spectacular", year: "2007", duration: "3:49", duration_sec: 229 },
                { title: "Chamber Of Reflection", artist: "Mac DeMarco", album: "Salad Days", year: "2014", duration: "3:51", duration_sec: 231 },
                { title: "Get Lucky", artist: "Daft Punk", album: "Random Access Memories", year: "2013", duration: "4:08", duration_sec: 248 },
                { title: "Best Part (feat. H.E.R.)", artist: "Daniel Caesar", album: "Freudian", year: "2017", duration: "3:29", duration_sec: 209 },
                { title: "The Less I Know the Better", artist: "Tame Impala", album: "Currents", year: "2015", duration: "3:36", duration_sec: 216 },
                { title: "Sunflower", artist: "Post Malone & Swae Lee", album: "Spider-Verse", year: "2018", duration: "2:38", duration_sec: 158 },
                { title: "Heat Waves", artist: "Glass Animals", album: "Dreamland", year: "2020", duration: "3:58", duration_sec: 238 },
                { title: "Space Song", artist: "Beach House", album: "Depression Cherry", year: "2015", duration: "5:20", duration_sec: 320 },
                { title: "Sweater Weather", artist: "The Neighbourhood", album: "I Love You.", year: "2013", duration: "4:00", duration_sec: 240 },
                { title: "Location", artist: "Khalid", album: "American Teen", year: "2017", duration: "3:39", duration_sec: 219 }
            ]
        },
        acoustic: {
            title: "Warm Coffeehouse Acoustic Sessions",
            altTitle: "Fireside Folk & Unplugged Stories Vol. 2",
            vibe: "Intimate fingerpicking, rich vocals & stripped-back storytelling",
            batchTerm: "acoustic coffeehouse folk",
            seeds: [
                { title: "Fast Car", artist: "Tracy Chapman", album: "Tracy Chapman", year: "1988", duration: "4:56", duration_sec: 296 },
                { title: "Banana Pancakes", artist: "Jack Johnson", album: "In Between Dreams", year: "2005", duration: "3:11", duration_sec: 191 },
                { title: "Skinny Love", artist: "Bon Iver", album: "For Emma, Forever Ago", year: "2007", duration: "3:58", duration_sec: 238 },
                { title: "Blackbird", artist: "The Beatles", album: "The Beatles (White Album)", year: "1968", duration: "2:18", duration_sec: 138 },
                { title: "Ho Hey", artist: "The Lumineers", album: "The Lumineers", year: "2012", duration: "2:43", duration_sec: 163 },
                { title: "Photograph", artist: "Ed Sheeran", album: "x", year: "2014", duration: "4:18", duration_sec: 258 },
                { title: "Landslide", artist: "Fleetwood Mac", album: "Fleetwood Mac", year: "1975", duration: "3:19", duration_sec: 199 },
                { title: "Better Together", artist: "Jack Johnson", album: "In Between Dreams", year: "2005", duration: "3:27", duration_sec: 207 },
                { title: "Riptide", artist: "Vance Joy", album: "Dream Your Life Away", year: "2013", duration: "3:24", duration_sec: 204 },
                { title: "Stick Season", artist: "Noah Kahan", album: "Stick Season", year: "2022", duration: "3:02", duration_sec: 182 },
                { title: "The A Team", artist: "Ed Sheeran", album: "+", year: "2011", duration: "4:18", duration_sec: 258 },
                { title: "ophelia", artist: "The Lumineers", album: "Cleopatra", year: "2016", duration: "2:40", duration_sec: 160 }
            ]
        },
        rock: {
            title: "Stadium & Classic Rock Legends",
            altTitle: "Highway Overdrive: Rock Anthems Vol. 2",
            vibe: "Timeless guitar riffs, soaring vocals & driving drums",
            batchTerm: "classic rock anthems hits",
            seeds: [
                { title: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", year: "1975", duration: "5:55", duration_sec: 355 },
                { title: "Dreams", artist: "Fleetwood Mac", album: "Rumours", year: "1977", duration: "4:17", duration_sec: 257 },
                { title: "Hotel California", artist: "Eagles", album: "Hotel California", year: "1976", duration: "6:30", duration_sec: 390 },
                { title: "Smells Like Teen Spirit", artist: "Nirvana", album: "Nevermind", year: "1991", duration: "5:01", duration_sec: 301 },
                { title: "Mr. Brightside", artist: "The Killers", album: "Hot Fuss", year: "2004", duration: "3:42", duration_sec: 222 },
                { title: "Everlong", artist: "Foo Fighters", album: "The Colour and the Shape", year: "1997", duration: "4:10", duration_sec: 250 },
                { title: "Sweet Child O' Mine", artist: "Guns N' Roses", album: "Appetite for Destruction", year: "1987", duration: "5:56", duration_sec: 356 },
                { title: "Back In Black", artist: "AC/DC", album: "Back In Black", year: "1980", duration: "4:15", duration_sec: 255 },
                { title: "Seven Nation Army", artist: "The White Stripes", album: "Elephant", year: "2003", duration: "3:51", duration_sec: 231 },
                { title: "Under the Bridge", artist: "Red Hot Chili Peppers", album: "Blood Sugar Sex Magik", year: "1991", duration: "4:24", duration_sec: 264 },
                { title: "Wonderwall", artist: "Oasis", album: "(What's the Story) Morning Glory?", year: "1995", duration: "4:18", duration_sec: 258 },
                { title: "Don't Stop Believin'", artist: "Journey", album: "Escape", year: "1981", duration: "4:10", duration_sec: 250 }
            ]
        },
        jazz: {
            title: "Midnight Blue Note Jazz Lounge",
            altTitle: "Velvet Sax & Espresso: Late Jazz Vol. 2",
            vibe: "Smoky saxophone, walking upright bass & velvet trumpet",
            batchTerm: "classic jazz miles davis brubeck",
            seeds: [
                { title: "Take Five", artist: "The Dave Brubeck Quartet", album: "Time Out", year: "1959", duration: "5:24", duration_sec: 324 },
                { title: "So What", artist: "Miles Davis", album: "Kind of Blue", year: "1959", duration: "9:22", duration_sec: 562 },
                { title: "My Favorite Things", artist: "John Coltrane", album: "My Favorite Things", year: "1961", duration: "13:41", duration_sec: 821 },
                { title: "Fly Me to the Moon", artist: "Frank Sinatra", album: "It Might as Well Be Swing", year: "1964", duration: "2:27", duration_sec: 147 },
                { title: "Blue in Green", artist: "Miles Davis", album: "Kind of Blue", year: "1959", duration: "5:37", duration_sec: 337 },
                { title: "Almost Blue", artist: "Chet Baker", album: "Let's Get Lost", year: "1988", duration: "5:10", duration_sec: 310 },
                { title: "Autumn Leaves", artist: "Cannonball Adderley", album: "Somethin' Else", year: "1958", duration: "10:55", duration_sec: 655 },
                { title: "What a Wonderful World", artist: "Louis Armstrong", album: "What a Wonderful World", year: "1967", duration: "2:21", duration_sec: 141 },
                { title: "The Girl From Ipanema", artist: "Stan Getz & Joao Gilberto", album: "Getz/Gilberto", year: "1964", duration: "5:17", duration_sec: 317 },
                { title: "Feeling Good", artist: "Nina Simone", album: "I Put a Spell on You", year: "1965", duration: "2:54", duration_sec: 174 },
                { title: "In a Sentimental Mood", artist: "Duke Ellington & John Coltrane", album: "Duke Ellington & John Coltrane", year: "1963", duration: "4:15", duration_sec: 255 },
                { title: "Moanin'", artist: "Art Blakey & The Jazz Messengers", album: "Moanin'", year: "1958", duration: "9:35", duration_sec: 575 }
            ]
        },
        "r&b": {
            title: "Silk & Soul: R&B Slow Jams",
            altTitle: "Late-Night Neo-Soul & R&B Essentials Vol. 2",
            vibe: "Lush harmonies, late-night basslines & timeless soul",
            batchTerm: "r&b soul slow jams hits",
            seeds: [
                { title: "Snooze", artist: "SZA", album: "SOS", year: "2022", duration: "3:21", duration_sec: 201 },
                { title: "Pink + White", artist: "Frank Ocean", album: "Blonde", year: "2016", duration: "3:04", duration_sec: 184 },
                { title: "Redbone", artist: "Childish Gambino", album: "Awaken, My Love!", year: "2016", duration: "5:26", duration_sec: 326 },
                { title: "Best Part", artist: "Daniel Caesar", album: "Freudian", year: "2017", duration: "3:29", duration_sec: 209 },
                { title: "Adorn", artist: "Miguel", album: "Kaleidoscope Dream", year: "2012", duration: "3:13", duration_sec: 193 },
                { title: "Earned It", artist: "The Weeknd", album: "Beauty Behind the Madness", year: "2014", duration: "4:37", duration_sec: 277 },
                { title: "No Scrubs", artist: "TLC", album: "FanMail", year: "1999", duration: "3:34", duration_sec: 214 },
                { title: "Kill Bill", artist: "SZA", album: "SOS", year: "2022", duration: "2:33", duration_sec: 153 },
                { title: "Yeah!", artist: "Usher", album: "Confessions", year: "2004", duration: "4:10", duration_sec: 250 },
                { title: "Crazy in Love", artist: "Beyonce", album: "Dangerously in Love", year: "2003", duration: "3:56", duration_sec: 236 },
                { title: "Exchange", artist: "Bryson Tiller", album: "T R A P S O U L", year: "2015", duration: "3:14", duration_sec: 194 },
                { title: "Die For You", artist: "The Weeknd", album: "Starboy", year: "2016", duration: "4:20", duration_sec: 260 }
            ]
        },
        pop: {
            title: "Pop Supernova: Feel-Good Chart Anthems",
            altTitle: "Electric Pop & Weekend Party Hits Vol. 2",
            vibe: "Infectious hooks, glossy production & high-energy vibes",
            batchTerm: "top pop hits dua lipa weeknd",
            seeds: [
                { title: "Levitating", artist: "Dua Lipa", album: "Future Nostalgia", year: "2020", duration: "3:23", duration_sec: 203 },
                { title: "As It Was", artist: "Harry Styles", album: "Harry's House", year: "2022", duration: "2:47", duration_sec: 167 },
                { title: "Espresso", artist: "Sabrina Carpenter", album: "Short n' Sweet", year: "2024", duration: "2:55", duration_sec: 175 },
                { title: "Cruel Summer", artist: "Taylor Swift", album: "Lover", year: "2019", duration: "2:58", duration_sec: 178 },
                { title: "Starboy", artist: "The Weeknd", album: "Starboy", year: "2016", duration: "3:50", duration_sec: 230 },
                { title: "Don't Start Now", artist: "Dua Lipa", album: "Future Nostalgia", year: "2019", duration: "3:03", duration_sec: 183 },
                { title: "Uptown Funk", artist: "Mark Ronson & Bruno Mars", album: "Uptown Special", year: "2014", duration: "4:30", duration_sec: 270 },
                { title: "24K Magic", artist: "Bruno Mars", album: "24K Magic", year: "2016", duration: "3:46", duration_sec: 226 },
                { title: "Watermelon Sugar", artist: "Harry Styles", album: "Fine Line", year: "2019", duration: "2:54", duration_sec: 174 },
                { title: "Birds of a Feather", artist: "Billie Eilish", album: "HIT ME HARD AND SOFT", year: "2024", duration: "3:30", duration_sec: 210 },
                { title: "Save Your Tears", artist: "The Weeknd", album: "After Hours", year: "2020", duration: "3:35", duration_sec: 215 },
                { title: "Flowers", artist: "Miley Cyrus", album: "Endless Summer Vacation", year: "2023", duration: "3:20", duration_sec: 200 }
            ]
        },
        edm: {
            title: "Festival Mainstage & Electronic Euphoria",
            altTitle: "Afterhours Club & House Grooves Vol. 2",
            vibe: "Massive builds, euphoric synths & club-ready drops",
            batchTerm: "edm house electronic hits",
            seeds: [
                { title: "Levels", artist: "Avicii", album: "Levels", year: "2011", duration: "3:19", duration_sec: 199 },
                { title: "One More Time", artist: "Daft Punk", album: "Discovery", year: "2001", duration: "5:20", duration_sec: 320 },
                { title: "Summer", artist: "Calvin Harris", album: "Motion", year: "2014", duration: "3:42", duration_sec: 222 },
                { title: "Strobe", artist: "deadmau5", album: "For Lack of a Better Name", year: "2009", duration: "10:37", duration_sec: 637 },
                { title: "Clarity", artist: "Zedd", album: "Clarity", year: "2012", duration: "4:31", duration_sec: 271 },
                { title: "Wake Me Up", artist: "Avicii", album: "True", year: "2013", duration: "4:07", duration_sec: 247 },
                { title: "Don't You Worry Child", artist: "Swedish House Mafia", album: "Until Now", year: "2012", duration: "3:32", duration_sec: 212 },
                { title: "Lean On", artist: "Major Lazer & DJ Snake", album: "Peace Is The Mission", year: "2015", duration: "2:56", duration_sec: 176 },
                { title: "Rumble", artist: "Skrillex, Fred again.. & Flowdan", album: "Quest For Fire", year: "2023", duration: "2:26", duration_sec: 146 },
                { title: "Bangarang", artist: "Skrillex", album: "Bangarang", year: "2011", duration: "3:35", duration_sec: 215 },
                { title: "Latch", artist: "Disclosure & Sam Smith", album: "Settle", year: "2012", duration: "4:16", duration_sec: 256 },
                { title: "Innerbloom", artist: "RUFUS DU SOL", album: "Bloom", year: "2016", duration: "9:38", duration_sec: 578 }
            ]
        },
        throwback: {
            title: "80s & 90s Time Machine: Iconic Throwbacks",
            altTitle: "Retro Cassette Gold: 80s & 90s Vol. 2",
            vibe: "Nostalgic sing-alongs, classic synths & timeless hooks",
            batchTerm: "80s 90s throwback hits",
            seeds: [
                { title: "Billie Jean", artist: "Michael Jackson", album: "Thriller", year: "1982", duration: "4:54", duration_sec: 294 },
                { title: "Take On Me", artist: "a-ha", album: "Hunting High and Low", year: "1985", duration: "3:45", duration_sec: 225 },
                { title: "Everybody Wants to Rule the World", artist: "Tears for Fears", album: "Songs from the Big Chair", year: "1985", duration: "4:11", duration_sec: 251 },
                { title: "Africa", artist: "Toto", album: "Toto IV", year: "1982", duration: "4:55", duration_sec: 295 },
                { title: "Sweet Dreams (Are Made of This)", artist: "Eurythmics", album: "Sweet Dreams", year: "1983", duration: "3:36", duration_sec: 216 },
                { title: "September", artist: "Earth, Wind & Fire", album: "The Best of Earth, Wind & Fire", year: "1978", duration: "3:35", duration_sec: 215 },
                { title: "I Wanna Dance with Somebody", artist: "Whitney Houston", album: "Whitney", year: "1987", duration: "4:51", duration_sec: 291 },
                { title: "Livin' on a Prayer", artist: "Bon Jovi", album: "Slippery When Wet", year: "1986", duration: "4:09", duration_sec: 249 },
                { title: "Return of the Mack", artist: "Mark Morrison", album: "Return of the Mack", year: "1996", duration: "3:33", duration_sec: 213 },
                { title: "This Is How We Do It", artist: "Montell Jordan", album: "This Is How We Do It", year: "1995", duration: "3:58", duration_sec: 238 },
                { title: "Careless Whisper", artist: "George Michael", album: "Make It Big", year: "1984", duration: "5:00", duration_sec: 300 },
                { title: "Purple Rain", artist: "Prince", album: "Purple Rain", year: "1984", duration: "8:41", duration_sec: 521 }
            ]
        }
    };

    const VIBE_KEYS_LIST = Object.keys(CLIENT_VIBE_SEEDS);

    function makeStreamingUrls(title, artist = '') {
        const query = `${artist} ${title}`.trim() || title;
        const enc = encodeURIComponent(query);
        return {
            apple_music: `https://music.apple.com/search?term=${enc}`,
            spotify: `https://open.spotify.com/search/${enc}`,
            youtube_music: `https://music.youtube.com/search?q=${enc}`
        };
    }

    function mapItunesResult(item, idx) {
        const title = item.trackName || `Track ${idx}`;
        const artist = item.artistName || 'Artist';
        const album = item.collectionName || 'Single';
        const artwork = (item.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg');
        const durSec = item.trackTimeMillis ? Math.max(1, Math.round(item.trackTimeMillis / 1000)) : 210;
        const yearMatch = (item.releaseDate || '').match(/\b(19\d\d|20\d\d)\b/);
        const stLinks = makeStreamingUrls(title, artist);
        return {
            index: idx,
            title,
            artist,
            album,
            year: yearMatch ? yearMatch[1] : '',
            duration: formatTime(durSec),
            duration_sec: durSec,
            artwork_url: artwork || 'favicon.png',
            preview_url: item.previewUrl || '',
            search_query: `ytsearch1:${artist} - ${title} official audio`,
            apple_music_url: item.trackViewUrl || stLinks.apple_music,
            spotify_url: stLinks.spotify,
            youtube_music_url: stLinks.youtube_music
        };
    }

    function buildSeedTrackObject(seedObj, idx) {
        const title = seedObj.title || String(seedObj);
        const artist = seedObj.artist || 'Featured Artist';
        const album = seedObj.album || 'Curated Mix';
        const year = seedObj.year || '2025';
        const duration = seedObj.duration || '3:30';
        const duration_sec = seedObj.duration_sec || 210;
        const stLinks = makeStreamingUrls(title, artist);
        return {
            index: idx,
            title,
            artist,
            album,
            year,
            duration,
            duration_sec,
            artwork_url: 'favicon.png',
            preview_url: '',
            search_query: `ytsearch1:${artist} - ${title} official audio`,
            apple_music_url: stLinks.apple_music,
            spotify_url: stLinks.spotify,
            youtube_music_url: stLinks.youtube_music
        };
    }

    async function enrichPresetSeedsNonBlocking(selectedSeeds) {
        // Enrich seeds in parallel with a strict 1600ms race cap so a playlist NEVER stalls
        const enrichPromise = Promise.all(selectedSeeds.map(async (seedObj, idx) => {
            const query = `${seedObj.artist || ''} ${seedObj.title || seedObj}`.trim();
            try {
                const items = await searchItunesFast(query, 1, 1400);
                if (items && items[0]) {
                    return mapItunesResult(items[0], idx + 1);
                }
            } catch (_) { }
            return buildSeedTrackObject(seedObj, idx + 1);
        }));

        const fallbackTracks = selectedSeeds.map((s, idx) => buildSeedTrackObject(s, idx + 1));
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(fallbackTracks), 1700));
        return Promise.race([enrichPromise, timeoutPromise]);
    }

    // --- Conversational Memory & AI Personal Assistant State ---
    const assistantMemory = {
        userName: localStorage.getItem('mp3audio_user_name') || '',
        userMood: '',
        userActivity: '',
        likedGenres: [],
        likedArtists: [],
        lastVibeKey: '',
        lastPlaylistTitle: '',
        lastTracks: [],
        lastArtist: '',
        lastConvCategory: '',
        lastGenreDiscussed: '',
        lastArtistDiscussed: '',
        pendingVibeKey: '',
        pendingTopic: '',
        awaitingPlaylistVibe: false,
        lastAssistantQuestion: '',
        turnCount: 0
    };

    function isExplicitPlaylistRequest(lower) {
        // True ONLY when the user specifically asks to create, send, or play a playlist/mix/list of songs
        if (/\b(how|what|why|when|where|who|which)\b/i.test(lower) && /\?$/.test(lower)) return false;
        if (/\b(playlist|playlists|mixtape|tracklist|setlist)\b/i.test(lower)) return true;
        if (/\b(make|build|create|curate|send|give|play|drop|put on|generate)\b.*\b(mix|songs|tracks)\b/i.test(lower)) return true;
        if (/^(a\s+|an\s+|some\s+)?[a-z0-9\s'&/-]+\s+mix$/i.test(lower)) return true;
        if (/^(play|send|give|show)\s+(me\s+)?(top|best)\s+\d*\s*\w+/i.test(lower)) return true;
        if (/\b(make it more upbeat|make it chiller|keep this vibe going|surprise me with a playlist|new playlist|another playlist|fresh playlist)\b/i.test(lower)) return true;
        return false;
    }

    function isExplicitSingleTrackRequest(rawText, lower) {
        // True ONLY when the user specifically asks to play, send, or download a specific song, ringtone, or link
        if (/https?:\/\//i.test(rawText)) return true;
        if (/\b(make|create|send|get|download)\b.*\b(ringtone|m4r|alarm tone|text tone)\b/i.test(lower)) return true;
        if (/^(play|send me|download|stream|put on)\s+(?!some\b|a\s+game\b|with\b|around\b|music\b)[a-z0-9]/i.test(lower) && !/\b(playlist|mix)\b/i.test(lower)) return true;
        if (/\b(download|send me|get me)\b.*\b(mp3|m4r)\b/i.test(lower)) return true;
        return false;
    }

    const HUMAN_VIBE_INTROS = {
        synthwave: [
            "Ooh, late-night synthwave is one of my absolute favorite moods. 🌆 Picture empty highways, neon reflections on wet pavement, and warm analog arpeggios—I pulled **6 essential tracks** for you:",
            "Nothing beats that retro-futuristic analog glow. ⚡ I dug into the synthwave crates and lined up **6 tracks** built for a midnight drive:"
        ],
        workout: [
            "Let's get after it!! 💪 When you need to push through a heavy set or lock into a run, you need relentless drums and zero filler. Here are **6 high-adrenaline anthems** to fuel your session:",
            "Time to turn the intensity all the way up 🔥 I put together **6 heavy-hitting workout tracks** with massive basslines and nonstop momentum:"
        ],
        "hip hop": [
            "Now we're talking. 🎤 From iconic boom-bap drums to razor-sharp lyricism and heavy 808s, I pulled **6 hip-hop essentials** that never miss:",
            "Respect the classics! 🙌 I lined up **6 heavyweight hip-hop tracks** with timeless production and lyrical heat:"
        ],
        lofi: [
            "Let's get you into a calm, effortless flow state. ☕ I picked **6 dusty lo-fi & chillhop beats** with warm Rhodes chords and vinyl texture—perfect for focusing or unwinding:",
            "Cozy vibes incoming 🌧️ Here are **6 mellow, distraction-free lo-fi instrumentals** that feel like a warm cup of coffee by a rainy window:"
        ],
        acoustic: [
            "Sometimes you just want stripped-back guitars, honest storytelling, and warm vocals that feel like they're right in the room with you. 🎸 Here are **6 intimate acoustic sessions**:",
            "Taking it warm and unplugged 🌿 I curated **6 acoustic favorites** with rich fingerpicking and timeless melodies:"
        ],
        rock: [
            "Turn the amplifier up! ⚡ There's nothing quite like soaring vocals, driving drums, and guitar riffs everyone knows by heart. Here are **6 rock legends**:",
            "Pure electricity from start to finish 🎸 I pulled **6 iconic rock anthems** that sound incredible at full volume:"
        ],
        jazz: [
            "Dim the lights and pour a drink 🎷 I put together **6 timeless Blue Note & late-night jazz recordings** with smoky saxophone, velvet trumpet, and walking upright bass:",
            "Pure sophistication. ✨ Here are **6 classic jazz masterpieces** that instantly turn any room into a cozy midnight lounge:"
        ],
        "r&b": [
            "Smooth, lush, and straight from the soul. ✨ Whether you're winding down late at night or just in your feelings, these **6 R&B and neo-soul tracks** set the mood effortlessly:",
            "Pure velvet vocals and deep pocket grooves 🌙 Here are **6 soulful R&B gems** I picked out for you:"
        ],
        edm: [
            "Hands in the air! 🙌 I lined up **6 euphoric electronic & house anthems** with massive builds and unforgettable drops:",
            "Let's bring the club & festival energy right into the chat 🎧 Here are **6 electronic essentials** that hit hard:"
        ],
        throwback: [
            "Hop in the time machine! 📼 These **6 iconic 80s & 90s throwbacks** have hooks so good everyone in the room will be singing along within ten seconds:",
            "Pure nostalgia gold ✨ I pulled **6 timeless retro hits** from the 80s and 90s that still sound fresh today:"
        ],
        pop: [
            "Instant mood-lifters incoming! ✨ I grabbed **6 glossy, feel-good pop anthems** packed with infectious hooks and bright energy:",
            "If you want pure feel-good momentum, this set is undefeated 🎉 Here are **6 chart-topping pop favorites**:"
        ],
        chill: [
            "Let's slow things down and let the room breathe 🌅 I curated **6 dreamy, laid-back tracks** with warm basslines and sunset grooves:",
            "Easygoing, smooth, and zero stress 🌊 Here are **6 chill tracks** that melt the day away:"
        ]
    };

    function detectVibeKeyFromText(lower) {
        if (/synthwave|retrowave|outrun|cyberpunk|neon/.test(lower)) return 'synthwave';
        if (/workout|gym|fitness|cardio|lift|running|run|hype|pump up|energetic/.test(lower)) return 'workout';
        if (/hip hop|hip-hop|rap|boom bap|trap|90s rap/.test(lower)) return 'hip hop';
        if (/lofi|lo-fi|study|homework|focus|coding|reading|concentrate|deep work/.test(lower)) return 'lofi';
        if (/acoustic|coffeehouse|folk|unplugged|campfire| mellow guitar/.test(lower)) return 'acoustic';
        if (/rock|metal|grunge|alternative|indie rock|classic rock/.test(lower)) return 'rock';
        if (/jazz|saxophone|swing|bossa|lounge|blues|dinner party|wine/.test(lower)) return 'jazz';
        if (/r&b|rnb|soul|slow jam|neo soul|romantic|date night/.test(lower)) return 'r&b';
        if (/edm|electronic|house|techno|club|festival|dance|rave/.test(lower)) return 'edm';
        if (/80s|90s|throwback|retro|old school|classic hits|nostalgia/.test(lower)) return 'throwback';
        if (/pop|chart|party|upbeat|feel good|happy|summer|celebrat|friday|weekend/.test(lower)) return 'pop';
        if (/chill|late night|late-night|relax|vibe|sunset|ambient|unwind|decompress|calm/.test(lower)) return 'chill';
        return null;
    }

    function detectHumanLifeMoment(lower) {
        if (/\b(stressed|stress|anxious|anxiety|overwhelmed|long day|exhausted|tired|burnout|burned out|rough day|hard day|can't sleep|insomnia|decompress|unwind)\b/.test(lower)) {
            return {
                vibeKey: 'lofi',
                convCategory: 'work_school',
                chatReply: "Ugh, I feel that—days like that really take it out of you. 🌿 Are you finally off the clock and able to kick back for the rest of the evening, or still pushing through it?",
                chatSuggestions: [
                    "Finally off the clock and relaxing",
                    "Still pushing through work right now",
                    "Yeah, today was non-stop",
                    "Just trying to unwind on the couch"
                ],
                customIntro: "Sounds like it's been a heavy day—take a deep breath and let your shoulders drop. 🌿 Since you asked for a mix to unwind, I put together **6 warm, unhurried tracks** with soft melodies to help quiet the noise:",
                followUp: "How are you holding up? If you want something even softer like acoustic guitar or late-night jazz, just say the word."
            };
        }
        if (/\b(sad|heartbroken|breakup|broke up|lonely|crying|depressed|down|in my feelings|miss her|miss him|missing someone|hurt)\b/.test(lower)) {
            return {
                vibeKey: 'r&b',
                convCategory: 'day_status',
                chatReply: "I'm really sorry you're going through that ❤️ Some days just feel heavy, and you don't have to rush yourself out of it. Do you want to talk about what's on your mind, or distraction-chat about something totally random?",
                chatSuggestions: [
                    "Yeah, let's just talk for a bit",
                    "Distract me with something fun",
                    "Just taking it one hour at a time",
                    "Tell me a random story or fact"
                ],
                customIntro: "I'm really sorry you're going through that ❤️ Here are **6 soulful, heartfelt tracks** I pulled to sit right there with you:",
                followUp: "I'm right here if you want to talk, or if you want more late-night soul or stripped-back acoustic ballads."
            };
        }
        if (/\b(happy|excited|good news|promoted|celebrating|celebrate|friday|weekend|great day|best day|hyped|pumped)\b/.test(lower)) {
            return {
                vibeKey: 'pop',
                convCategory: 'day_status',
                chatReply: "Now THAT is what I love to hear!! 🎉 You love to see a win like that! What happened—what are we celebrating today?",
                chatSuggestions: [
                    "Got some great news at work!",
                    "Finally made it to the weekend!",
                    "Just in a really great mood today",
                    "Hanging out with friends tonight"
                ],
                customIntro: "Now THAT is what I love to hear!! 🎉 Since we're celebrating, I lined up **6 infectious, feel-good anthems** to keep that high energy rolling:",
                followUp: "What are we celebrating?! Tell me if you want to take this into full club/dance territory or throw on some 80s & 90s party classics next!"
            };
        }
        if (/\b(driving|drive|road trip|highway|commute|traffic|car ride|night drive)\b/.test(lower)) {
            const isNight = /night|midnight|late/.test(lower);
            return {
                vibeKey: isNight ? 'synthwave' : 'rock',
                convCategory: 'hobbies',
                chatReply: isNight
                    ? "Nothing beats a late-night drive with empty roads and city lights passing by. 🌃 Heading somewhere fun, or just out clearing your head?"
                    : "Nice! 🛣️ Heading out on a road trip somewhere fun, or just making the daily commute?",
                chatSuggestions: [
                    "Just cruising and clearing my head",
                    "On my way home right now",
                    "Heading out on a road trip!",
                    "Stuck in traffic unfortunately"
                ],
                customIntro: isNight
                    ? "Windows cracked, city lights passing by—nothing beats a late-night drive. 🌃 Here are **6 hypnotic synth & night-drive tracks** built for the open road:"
                    : "Nothing beats a great driving soundtrack with the road ahead of you 🛣️ I pulled **6 timeless road-trip anthems** built for cruising:",
                followUp: "Want to keep cruising on this wavelength, or switch the dial to indie chill or 90s hip-hop?"
            };
        }
        if (/\b(cooking|dinner|kitchen|wine|date night|romantic|candles)\b/.test(lower)) {
            return {
                vibeKey: 'jazz',
                convCategory: 'food_drink',
                chatReply: "Ooh, love that! 🍷 What's on the menu tonight—cooking up a go-to favorite recipe or experimenting with something new?",
                chatSuggestions: [
                    "Making pasta from scratch!",
                    "Just whipping up something quick",
                    "Ordering takeout tonight instead",
                    "Trying out a brand new recipe"
                ],
                customIntro: "Ooh, setting the mood! 🍷 Here are **6 timeless lounge & soul classics** to keep you company in the kitchen:",
                followUp: "What's on the menu tonight? Let me know if you want to blend in some smooth R&B or sunset indie next!"
            };
        }
        if (/\b(bored|idk|don't know|not sure|whatever|nothing much|just chilling|hanging out)\b/.test(lower)) {
            const hour = new Date().getHours();
            const timeVibe = (hour >= 20 || hour < 5) ? 'synthwave' : (hour < 12 ? 'acoustic' : 'chill');
            return {
                vibeKey: timeVibe,
                convCategory: 'relaxing',
                chatReply: "Haha, sometimes doing nothing at all is underrated! 😄 Are you just taking a breather at home, or looking for a fun topic to get into?",
                chatSuggestions: [
                    "Just taking a breather at home",
                    "Tell me a cool music fact",
                    "What kind of music are you into?",
                    "Tell me a music joke"
                ],
                customIntro: `Since you asked for some tracks, I hand-picked **6 of my personal favorite songs** that hit the sweet spot between groove and melody:`,
                followUp: "Tell me which track in this batch catches your ear first, and I'll tailor the next round around it!"
            };
        }
        return null;
    }

    async function curatePresetVibePlaylist(vibeKey, isNewOrMoreRequest = false, customHumanIntro = null, customFollowUp = null) {
        const preset = CLIENT_VIBE_SEEDS[vibeKey] || CLIENT_VIBE_SEEDS.chill;
        lastVibeKey = vibeKey;
        assistantMemory.lastVibeKey = vibeKey;

        // Filter out already-shown tracks so asking for a "new playlist" gives fresh tracks
        const unseenSeeds = preset.seeds.filter(s => {
            const k = `${(s.title || '').toLowerCase()}|${(s.artist || '').toLowerCase()}`;
            return !shownTrackKeys.has(k);
        });

        const chosenSeeds = (unseenSeeds.length >= 6 ? unseenSeeds : preset.seeds).slice(0, 6);
        const usedSecondPage = unseenSeeds.length > 0 && unseenSeeds.length <= 6;

        chosenSeeds.forEach(s => {
            shownTrackKeys.add(`${(s.title || '').toLowerCase()}|${(s.artist || '').toLowerCase()}`);
        });

        const tracks = await enrichPresetSeedsNonBlocking(chosenSeeds);
        tracks.forEach(t => {
            shownTrackKeys.add(`${(t.title || '').toLowerCase()}|${(t.artist || '').toLowerCase()}`);
        });

        const playlistTitle = (usedSecondPage || isNewOrMoreRequest) && preset.altTitle ? preset.altTitle : preset.title;
        assistantMemory.lastPlaylistTitle = playlistTitle;
        assistantMemory.lastTracks = tracks;
        if (tracks[0] && tracks[0].artist) assistantMemory.lastArtist = tracks[0].artist;

        const intros = HUMAN_VIBE_INTROS[vibeKey] || HUMAN_VIBE_INTROS.chill;
        const defaultIntro = isNewOrMoreRequest
            ? `Fresh crate dug! 🎧 I switched things up and curated **${playlistTitle}** for you—6 brand-new tracks starting with **${tracks[0] ? tracks[0].title : 'a classic'}** by **${tracks[0] ? tracks[0].artist : ''}**:`
            : intros[assistantMemory.turnCount % intros.length];

        const followUpNote = customFollowUp || (
            `How does this mix feel? You can tap ▶ on any track to listen right here, or tell me *"make it more upbeat"*, *"something chiller"*, or *"more like ${tracks[0] ? tracks[0].artist : 'this'}"*!`
        );

        assistantMemory.turnCount++;
        return {
            success: true,
            reply: customHumanIntro || defaultIntro,
            follow_up_note: followUpNote,
            suggestions: [
                `🔥 More like ${tracks[0] ? tracks[0].artist : 'this vibe'}`,
                `⚡ Make it more upbeat`,
                `🌙 Dial it back & make it chiller`,
                `🎲 Surprise me with a different genre`
            ],
            mode: 'playlist',
            playlist_title: playlistTitle,
            playlist_vibe: preset.vibe,
            tracks
        };
    }

    // --- Follow-Up Question Resolution & Live Music Knowledge Engine ---
    function resolveReferencedTrack(lower) {
        const tracks = assistantMemory.lastTracks || [];
        if (tracks.length === 0) return null;

        const ordinalMap = [
            { idx: 0, re: /\b(track\s*#?1|song\s*#?1|number\s*1|#1|first\s+(track|song|one)|1st\s+(track|song|one)|the\s+first|opener)\b/i },
            { idx: 1, re: /\b(track\s*#?2|song\s*#?2|number\s*2|#2|second\s+(track|song|one)|2nd\s+(track|song|one)|the\s+second)\b/i },
            { idx: 2, re: /\b(track\s*#?3|song\s*#?3|number\s*3|#3|third\s+(track|song|one)|3rd\s+(track|song|one)|the\s+third)\b/i },
            { idx: 3, re: /\b(track\s*#?4|song\s*#?4|number\s*4|#4|fourth\s+(track|song|one)|4th\s+(track|song|one)|the\s+fourth)\b/i },
            { idx: 4, re: /\b(track\s*#?5|song\s*#?5|number\s*5|#5|fifth\s+(track|song|one)|5th\s+(track|song|one)|the\s+fifth)\b/i },
            { idx: 5, re: /\b(track\s*#?6|song\s*#?6|number\s*6|#6|sixth\s+(track|song|one)|6th\s+(track|song|one)|the\s+sixth)\b/i }
        ];
        for (const item of ordinalMap) {
            if (item.re.test(lower) && tracks[item.idx]) {
                return { track: tracks[item.idx], idx: item.idx };
            }
        }
        if (/\b(last\s+(track|song|one))\b/i.test(lower)) {
            return { track: tracks[tracks.length - 1], idx: tracks.length - 1 };
        }
        for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            const tTitle = (t.title || '').toLowerCase();
            const tArtist = (t.artist || '').toLowerCase();
            if ((tTitle && tTitle.length > 2 && lower.includes(tTitle)) || (tArtist && tArtist.length > 2 && lower.includes(tArtist))) {
                return { track: t, idx: i };
            }
        }
        if (currentQueue && currentQueue[currentQueueIndex] && /\b(this\s+(song|track|one)|playing|current)\b/i.test(lower)) {
            return { track: currentQueue[currentQueueIndex], idx: currentQueueIndex };
        }
        if (tracks.length === 1 || /\b(this\s+(song|track|artist)|that\s+(song|track|artist)|it|they|them|he|she)\b/i.test(lower)) {
            return { track: tracks[0], idx: 0 };
        }
        return null;
    }

    async function fetchWikipediaSummary(subjectQuery) {
        const cleanSubj = (subjectQuery || '').trim();
        if (!cleanSubj) return '';
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanSubj + ' music')}&utf8=1&format=json&origin=*`;
            const sRes = await fetchWithTimeout(searchUrl, {}, 1800);
            if (!sRes || !sRes.ok) return '';
            const sData = await sRes.json();
            const hits = (sData.query && sData.query.search) || [];
            const bestTitle = hits[0] ? hits[0].title : cleanSubj;

            const extUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exsentences=3&redirects=1&titles=${encodeURIComponent(bestTitle)}&format=json&origin=*`;
            const eRes = await fetchWithTimeout(extUrl, {}, 1800);
            if (!eRes || !eRes.ok) return '';
            const eData = await eRes.json();
            const pages = (eData.query && eData.query.pages) || {};
            const firstPage = Object.values(pages)[0];
            if (firstPage && firstPage.extract) {
                return firstPage.extract.trim();
            }
        } catch (_) {}
        return '';
    }

    async function answerFollowUpQuestion(rawText, lower) {
        const tracks = assistantMemory.lastTracks || [];
        const ref = resolveReferencedTrack(lower);

        // 1. Voice / Chat Playback Commands ("play track 2", "play the first song", "pause", "next song")
        if (/^(play|start playing|put on|listen to)\s+(track\s*#?\d|song\s*#?\d|number\s*\d|#\d|the\s+(first|second|third|fourth|fifth|sixth|last)\s*(track|song|one)?|(1st|2nd|3rd|4th|5th|6th)\s*(track|song|one)?)$/i.test(lower) && ref) {
            setTimeout(() => playTrackFromQueue(tracks, ref.idx), 80);
            return {
                success: true,
                mode: 'chat',
                reply: `▶️ Playing **Track #${ref.idx + 1}: ${ref.track.title}** by **${ref.track.artist}** right now in the player below! 🎧\n\nLet me know if you want to know the story behind this track, or if you want me to build a full playlist around **${ref.track.artist}**.`,
                suggestions: [
                    `💬 Tell me about ${ref.track.artist}`,
                    `📅 What year did ${ref.track.title} come out?`,
                    `🔥 Build a playlist around ${ref.track.artist}`,
                    `⏭️ Play the next track`
                ],
                tracks: []
            };
        }

        if (/^(pause|stop|stop playing|pause music)$/i.test(lower)) {
            if (!globalAudio.paused) globalAudio.pause();
            return {
                success: true,
                mode: 'chat',
                reply: `⏸️ Paused playback! Whenever you're ready to jump back in, just say *"resume"* or tell me what vibe you want to explore next.`,
                suggestions: [
                    `▶️ Resume playback`,
                    `🔄 Curate a fresh playlist`,
                    `💬 Tell me about these songs`
                ],
                tracks: []
            };
        }

        if (/^(resume|continue playing|unpause)$/i.test(lower) && tracks.length > 0) {
            setTimeout(() => playTrackFromQueue(tracks, currentQueueIndex || 0), 80);
            return {
                success: true,
                mode: 'chat',
                reply: `▶️ Resuming playback! Enjoy the groove 🎧`,
                suggestions: [
                    `⏭️ Play the next track`,
                    `⚡ Make it more upbeat`,
                    `🌙 Make it chiller`
                ],
                tracks: []
            };
        }

        if (/^(next|next track|next song|skip|skip track)$/i.test(lower) && tracks.length > 0) {
            const nextIdx = ((currentQueueIndex || 0) + 1) % tracks.length;
            setTimeout(() => playTrackFromQueue(tracks, nextIdx), 80);
            const nt = tracks[nextIdx];
            return {
                success: true,
                mode: 'chat',
                reply: `⏭️ Skipping ahead to **Track #${nextIdx + 1}: ${nt.title}** by **${nt.artist}**!`,
                suggestions: [
                    `💬 Tell me about ${nt.artist}`,
                    `📅 When did ${nt.title} come out?`,
                    `🔥 More songs like ${nt.title}`
                ],
                tracks: []
            };
        }

        // 2. Track Swap / Replace Follow-Up ("swap track 3", "replace the second song", "remove track 1")
        if (/\b(swap|replace|remove|change|switch out)\b/i.test(lower) && ref && tracks.length > 1) {
            const preset = CLIENT_VIBE_SEEDS[assistantMemory.lastVibeKey || 'chill'] || CLIENT_VIBE_SEEDS.chill;
            const replacementSeed = preset.seeds.find(s => !shownTrackKeys.has(`${(s.title || '').toLowerCase()}|${(s.artist || '').toLowerCase()}`)) || preset.seeds[preset.seeds.length - 1];
            const enrichedArr = await enrichPresetSeedsNonBlocking([replacementSeed]);
            const newTrack = { ...enrichedArr[0], index: ref.idx + 1 };
            shownTrackKeys.add(`${(newTrack.title || '').toLowerCase()}|${(newTrack.artist || '').toLowerCase()}`);
            const updatedTracks = tracks.map((t, i) => (i === ref.idx ? newTrack : { ...t, index: i + 1 }));
            assistantMemory.lastTracks = updatedTracks;
            return {
                success: true,
                mode: 'playlist',
                playlist_title: assistantMemory.lastPlaylistTitle || 'Updated Curated Mix',
                playlist_vibe: 'Updated Tracklist • 320kbps & ID3 Tagged',
                reply: `Done! 🔄 I swapped out Track #${ref.idx + 1} (*${ref.track.title}*) and replaced it with **${newTrack.title}** by **${newTrack.artist}**:`,
                follow_up_note: `How does **${newTrack.title}** fit the mix? Tell me if you want to swap any other track or ask me anything about these artists!`,
                suggestions: [
                    `▶️ Play track ${ref.idx + 1}`,
                    `💬 Tell me about ${newTrack.artist}`,
                    `⚡ Make it more upbeat`,
                    `🌙 Make it chiller`
                ],
                tracks: updatedTracks
            };
        }

        // 3. Questions about Release Year / Age / Oldest / Newest Song
        if (/\b(what year|when did|when was|release date|released|how old|oldest|newest)\b/i.test(lower)) {
            if (/\b(oldest|newest|earliest|latest)\b/i.test(lower) && tracks.length > 1) {
                const withYears = tracks.filter(t => t.year && /^\d{4}$/.test(String(t.year)));
                if (withYears.length > 0) {
                    const sorted = [...withYears].sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
                    const oldest = sorted[0];
                    const newest = sorted[sorted.length - 1];
                    return {
                        success: true,
                        mode: 'chat',
                        reply: `Looking at your current playlist (**${assistantMemory.lastPlaylistTitle || 'Curated Mix'}**):\n\n• **Oldest track:** **${oldest.title}** by *${oldest.artist}*, released in **${oldest.year}** (on *${oldest.album || 'Single'}*)\n• **Newest track:** **${newest.title}** by *${newest.artist}*, released in **${newest.year}** (on *${newest.album || 'Single'}*)\n\nWant me to build a playlist focused specifically on the **${oldest.year}s** era or more modern releases?`,
                        suggestions: [
                            `📼 Build a ${oldest.year.slice(0, 3)}0s era playlist`,
                            `▶️ Play ${oldest.title}`,
                            `💬 Tell me about ${oldest.artist}`,
                            `🔄 Curate a fresh playlist`
                        ],
                        tracks: []
                    };
                }
            }
            if (ref && ref.track) {
                const t = ref.track;
                let yearStr = t.year;
                let albumStr = t.album;
                if (!yearStr) {
                    const items = await searchItunesFast(`${t.artist} ${t.title}`, 1, 1500);
                    if (items && items[0]) {
                        const ym = (items[0].releaseDate || '').match(/\b(19\d\d|20\d\d)\b/);
                        if (ym) yearStr = ym[1];
                        if (items[0].collectionName) albumStr = items[0].collectionName;
                    }
                }
                const currentYear = new Date().getFullYear();
                const ageNote = yearStr ? ` (${Math.max(1, currentYear - parseInt(yearStr, 10))} years ago)` : '';
                return {
                    success: true,
                    mode: 'chat',
                    reply: `📅 **${t.title}** by **${t.artist}** was released in **${yearStr || 'its original studio run'}**${ageNote} on the album **${albumStr || 'Single'}**!\n\nIt's a standout record from that era. Want to hear more songs from **${yearStr || 'that era'}** or more tracks by **${t.artist}**?`,
                    suggestions: [
                        `▶️ Play track ${ref.idx + 1}`,
                        `🎤 More songs by ${t.artist}`,
                        `💬 Tell me more about ${t.artist}`,
                        `💿 What other albums did ${t.artist} make?`
                    ],
                    tracks: []
                };
            }
            if (tracks.length > 1) {
                const yearList = tracks.map((t, i) => `${i + 1}. **${t.title}** (*${t.artist}*) — **${t.year || 'Classic'}** • *${t.album || 'Single'}*`).join('\n');
                return {
                    success: true,
                    mode: 'chat',
                    reply: `📅 Here is the release year and album breakdown for every track in **${assistantMemory.lastPlaylistTitle || 'your mix'}**:\n\n${yearList}\n\nWhich track or era is your favorite here?`,
                    suggestions: [
                        `▶️ Play track 1`,
                        `💬 Tell me about ${tracks[0].artist}`,
                        `🔥 Keep this vibe going (Vol. 2)`
                    ],
                    tracks: []
                };
            }
        }

        // 4. Questions about Albums ("what album is track 2 on?", "which album is this from?")
        if (/\b(what album|which album|album is|albums are|from what album|record is)\b/i.test(lower)) {
            if (ref && ref.track) {
                const t = ref.track;
                return {
                    success: true,
                    mode: 'chat',
                    reply: `💿 **${t.title}** by **${t.artist}** is from the album **${t.album || 'Single'}**${t.year ? ' (' + t.year + ')' : ''}!\n\nWant me to pull more tracks from **${t.album || t.artist}** or tell you the story behind **${t.artist}**?`,
                    suggestions: [
                        `🎵 More tracks from ${t.album || t.artist}`,
                        `💬 Tell me about ${t.artist}`,
                        `▶️ Play track ${ref.idx + 1}`
                    ],
                    tracks: []
                };
            }
            if (tracks.length > 0) {
                const albumLines = tracks.map((t, i) => `${i + 1}. **${t.title}** — from *${t.album || 'Single'}* (${t.artist}${t.year ? ', ' + t.year : ''})`).join('\n');
                return {
                    success: true,
                    mode: 'chat',
                    reply: `💿 Here are the albums for all ${tracks.length} tracks in your current mix:\n\n${albumLines}`,
                    suggestions: [
                        `▶️ Play track 1`,
                        `💬 Tell me about ${tracks[0].artist}`,
                        `🔥 More like this vibe`
                    ],
                    tracks: []
                };
            }
        }

        // 5. Questions about Playlist Duration / Length / Longest / Shortest Track
        if (/\b(how long is|total time|total duration|longest|shortest|how many songs|how many tracks)\b/i.test(lower) && tracks.length > 0) {
            const totalSec = tracks.reduce((acc, t) => acc + (t.duration_sec || 210), 0);
            const totalMin = Math.round(totalSec / 60);
            const sortedByLen = [...tracks].sort((a, b) => (b.duration_sec || 210) - (a.duration_sec || 210));
            const longest = sortedByLen[0];
            const shortest = sortedByLen[sortedByLen.length - 1];
            return {
                success: true,
                mode: 'chat',
                reply: `⏱️ Your current mix (**${assistantMemory.lastPlaylistTitle || 'Curated Playlist'}**) has **${tracks.length} tracks** with a total runtime of about **${totalMin} minutes**:\n\n• **Longest track:** **${longest.title}** by *${longest.artist}* (${longest.duration || '4:30'})\n• **Shortest track:** **${shortest.title}** by *${shortest.artist}* (${shortest.duration || '2:45'})\n\nWant me to add 6 more tracks for a longer session, or swap any song out?`,
                suggestions: [
                    `🔥 Add 6 more tracks (Vol. 2)`,
                    `▶️ Play ${longest.title}`,
                    `🔄 Swap track 1`
                ],
                tracks: []
            };
        }

        // 6. How-To / Feature / Pricing / Download / Ringtone / Platform Follow-Up Questions
        if (/\b(how do i download|how to download|download all|download zip|where do i download|save mp3|get the zip)\b/i.test(lower)) {
            return {
                success: true,
                mode: 'chat',
                reply: `Downloading is super easy! 📦\n\n• **For a single song:** Just click the **⬇ MP3** button on the right side of any track bubble to extract the full 320kbps MP3 with embedded Apple Music HD cover art.\n• **For the whole playlist:** Click the orange **📦 Download Playlist (.ZIP)** button at the top of the playlist card to bundle all tracks into one 1-click ZIP archive!`,
                suggestions: [
                    `📱 How do I make a phone ringtone?`,
                    `💰 Is this free or how do credits work?`,
                    `🌙 Curate a synthwave playlist`
                ],
                tracks: []
            };
        }

        if (/\b(how do i (make|set|use|put) a? ?ringtone|ringtone on iphone|ringtone on android|m4r|garageband)\b/i.test(lower)) {
            return {
                success: true,
                mode: 'chat',
                reply: `Here's how to set any track as your custom phone ringtone 📱:\n\n1. **Toggle on "📱 Ringtone"** in the top bar (or just tell me *"Make a ringtone of [Song]"*) and click **⬇ Ringtone**.\n2. **On Android:** Open **Settings → Sound & vibration → Phone ringtone → + Add Ringtone** and pick your downloaded `.mp3`!\n3. **On iPhone:** Open your downloaded `.m4r` / `.mp3` in Apple's free **GarageBand** app → long-press the project → **Share → Ringtone → Export**!\n\nWhat song should we turn into a ringtone first?`,
                suggestions: [
                    `📱 Make a ringtone of Blinding Lights`,
                    `📱 Make a ringtone of Track 1`,
                    `🔥 Curate an upbeat playlist`
                ],
                tracks: []
            };
        }

        if (/\b(is this free|how much does it cost|price|pricing|how do credits work|what are credits|subscription)\b/i.test(lower)) {
            return {
                success: true,
                mode: 'chat',
                reply: `Here's the breakdown—it's super friendly! ⚡\n\n• **100% Free Forever:** Chatting with me, curating playlists, listening to audio previews in chat, and downloading **1 to 5 tracks per request** (including embedded 1000px Apple Music cover art & ID3 tags) are completely **FREE** with zero signup!\n• **Pay-As-You-Go Credits ($3.99 for 350 Credits):** If you want large playlist ZIPs (6+ tracks at once), AI 320kbps studio mastering (1 credit/track), or AI lyrics transcription (10 credits/track), you can grab 350 non-expiring credits for $3.99 (~$0.01 per track) by clicking **Sign In / Credits** at the top right.`,
                suggestions: [
                    `🎧 Curate a freeplaylist right now`,
                    `🔊 What audio quality are the MP3s?`,
                    `📱 Can I use this on Telegram?`
                ],
                tracks: []
            };
        }

        if (/\b(what (quality|bitrate|format)|is it 320|id3|album art|metadata|flac|lossless)\b/i.test(lower)) {
            return {
                success: true,
                mode: 'chat',
                reply: `Every track you download is mastered in **high-bitrate MP3 (up to 320kbps CBR)** and automatically tagged with:\n\n• 🎨 **1000×1000px HD Album Artwork** sourced from Apple Music\n• 🏷️ **Complete ID3v2 Metadata** (Track Title, Artist, Album, Release Year & Genre)\n• 📝 **Optional AI Lyrics Transcription** embedded directly into the MP3's ` + '`USLT`' + ` lyrics tag!\n\nYou can toggle **🎨 HD Cover Art**, **⚡ 320kbps**, **📱 Ringtone**, and **📝 Lyrics** right in the top bar.`,
                suggestions: [
                    `🌙 Send me a synthwave playlist`,
                    `🎸 Send me classic rock legends`,
                    `💰 How do credits work?`
                ],
                tracks: []
            };
        }

        // 7. Artist / Song / Genre Biography & Trivia Follow-Up Questions ("who sings track 2?", "who is M83?", "tell me about...", "what other albums...")
        const isExplicitBioOrTrackQuestion =
            (ref && ref.track && /\b(who sings|who made|who is the artist|who performed|by who|who wrote|tell me about|more about)\b/i.test(lower)) ||
            /^(hey|hi|ok|so)?\s*(can you\s+|could you\s+)?(tell me more about|tell me about|who is|who are|what other albums did|what songs did)\s+/i.test(lower);
        const isGeneralSmallTalkOrWeather = /\b(weather|rain|raining|sunny|snow|cold|hot|temperature|forecast|your day|you doing|are you|time is it|old are you|where are you|how is it|how's it)\b/i.test(lower);

        if (isExplicitBioOrTrackQuestion && !isGeneralSmallTalkOrWeather) {
            // Check if asking "who sings / who is the artist on track X"
            if (ref && ref.track && /\b(who sings|who made|who is the artist|who performed|by who|who wrote|tell me about|more about|who is|what is)\b/i.test(lower)) {
                const t = ref.track;
                const wikiBio = await fetchWikipediaSummary(`${t.artist} musician band`);
                const topSongs = await searchItunesFast(t.artist, 5, 1600);
                const otherHits = (topSongs || [])
                    .map(item => item.trackName)
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i && v.toLowerCase() !== t.title.toLowerCase())
                    .slice(0, 3);

                const bioParagraph = wikiBio
                    ? `\n\n📖 **About ${t.artist}:** ${wikiBio}`
                    : `\n\n**${t.artist}** is known for crafting standout records in this lane, and **${t.title}** (${t.album || 'Single'}${t.year ? ', ' + t.year : ''}) is one of their signature tracks.`;
                const hitsLine = otherHits.length > 0
                    ? `\n\n🔥 **Other essential tracks by ${t.artist}:** *${otherHits.join('*, *')}*.`
                    : '';

                return {
                    success: true,
                    mode: 'chat',
                    reply: `🎤 **Track #${ref.idx + 1} (${t.title})** is by **${t.artist}** (from *${t.album || 'Single'}*${t.year ? ', ' + t.year : ''})!${bioParagraph}${hitsLine}\n\nWant me to put together a full 6-track **${t.artist}** spotlight playlist for you?`,
                    suggestions: [
                        `🎵 Build a 6-track ${t.artist} playlist`,
                        `▶️ Play ${t.title}`,
                        `📅 When did ${t.title} come out?`,
                        `🔄 Surprise me with a new playlist`
                    ],
                    tracks: []
                };
            }

            // Explicit artist/band bio question (e.g., "Who is Daft Punk?", "Tell me about Fleetwood Mac")
            const topicMatch = rawText
                .replace(/^(hey|hi|ok|so|well)?\s*(can you\s+|could you\s+)?(tell me more about|tell me about|who is|who are|what other albums did|what songs did)\s+/i, '')
                .replace(/\b(make|sing|release|come from|mean|famous for)\b\??$/i, '')
                .replace(/[?!.]+$/, '')
                .trim();

            const targetSubject = (topicMatch && !/^(this|that|it|they|them|he|she|these|those|you|the weather|weather|today|life)$/i.test(topicMatch))
                ? topicMatch
                : (ref && ref.track ? ref.track.artist : (assistantMemory.lastArtist || ''));

            if (targetSubject && targetSubject.split(/\s+/).length <= 5) {
                const [wikiBio, itunesItems] = await Promise.all([
                    fetchWikipediaSummary(targetSubject),
                    searchItunesFast(targetSubject, 5, 1600)
                ]);

                const topTrackNames = (itunesItems || [])
                    .map(item => item.trackName)
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .slice(0, 4);
                const topAlbums = (itunesItems || [])
                    .map(item => item.collectionName)
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .slice(0, 3);

                let answerText = wikiBio
                    ? `🎧 **${targetSubject}:** ${wikiBio}`
                    : `🎧 **${targetSubject}** has an incredible catalog with timeless production and standout melodies.`;

                if (topTrackNames.length > 0) {
                    answerText += `\n\n🔥 **Standout Tracks:** *${topTrackNames.join('*, *')}*`;
                }
                if (topAlbums.length > 0) {
                    answerText += `\n💿 **Notable Releases:** *${topAlbums.join('*, *')}*`;
                }
                answerText += `\n\n*(If you ever want me to put together a **${targetSubject}** playlist, just ask!)*`;

                return {
                    success: true,
                    mode: 'chat',
                    reply: answerText,
                    suggestions: [
                        `🎵 Play a ${targetSubject} playlist`,
                        `🎲 Tell me a cool music fact`,
                        `💬 Who are your favorite artists?`
                    ],
                    tracks: []
                };
            }
        }

        return null;
    }

    const GENRE_CHAT_RESPONSES = {
        synthwave: {
            reply: "Synthwave has such an unmistakable atmosphere! 🌆 That blend of warm 80s analog Roland synths, gated reverb drums, and cinematic midnight-drive melodies never gets old—artists like **M83**, **Kavinsky**, and **The Midnight** really perfected it.\n\nDo you lean more toward the dreamy, vocal-driven synthwave or the darker cyberpunk instrumentals?",
            chips: [
                "Dreamy vocal synthwave",
                "Darker cyberpunk instrumentals",
                "I love M83 and Kavinsky",
                "Make me a synthwave playlist"
            ]
        },
        workout: {
            reply: "Good workout energy is all about a relentless rhythm that keeps you moving! 💪 When you're exercising, what actually gets you in the zone—heavy hip-hop drums, high-tempo electronic drops, or hard rock?",
            chips: [
                "Heavy hip-hop beats",
                "High-tempo electronic drops",
                "Hard rock & guitar riffs",
                "Make me a workout playlist"
            ]
        },
        "hip hop": {
            reply: "Hip-hop's evolution from 90s boom-bap sample chopping—like **A Tribe Called Quest**, **Nas**, and **Mobb Deep**—to modern production is unmatched. 🎤 Are you more of a golden-era 90s head, or do you prefer 2000s/modern flows?",
            chips: [
                "90s golden-era boom-bap",
                "2000s & modern hip-hop",
                "Melodic & laid-back rap",
                "Make me a hip-hop playlist"
            ]
        },
        lofi: {
            reply: "Lo-fi beats are honestly magic for getting into a flow state or winding down. ☕ Those dusty vinyl crackles, jazz Rhodes chords, and swung J Dilla-style drums make everything feel calmer.\n\nDo you usually put lo-fi on while you're working/studying, or late at night to relax?",
            chips: [
                "While working or studying",
                "Late at night to relax",
                "I love jazzy piano beats",
                "Make me a lo-fi playlist"
            ]
        },
        acoustic: {
            reply: "There's something timeless about stripped-back acoustic guitar and raw, honest songwriting—nowhere to hide behind heavy studio production. 🎸 Do you gravitate more toward classic folk/singer-songwriters or modern indie acoustic?",
            chips: [
                "Classic folk & singer-songwriters",
                "Modern indie acoustic",
                "Warm instrumental guitar",
                "Make me an acoustic playlist"
            ]
        },
        rock: {
            reply: "Rock covers so much iconic ground! ⚡ From 70s legends like **Fleetwood Mac** and **Led Zeppelin** to 90s grunge/alternative and 2000s indie rock like **The Killers** and **Arctic Monkeys**.\n\nWhich era of rock is your sweet spot?",
            chips: [
                "70s & 80s classic rock",
                "90s grunge & alternative",
                "2000s & modern indie rock",
                "Make me a rock playlist"
            ]
        },
        jazz: {
            reply: "Jazz is pure soul and conversation without words. 🎷 Those classic Blue Note recordings with **Miles Davis**, **John Coltrane**, and **Bill Evans** can change the whole feel of a room in seconds.\n\nDo you prefer smooth late-night trumpet/sax ballads or upbeat swing and bossa nova?",
            chips: [
                "Smooth late-night jazz",
                "Upbeat swing & bossa nova",
                "Jazz piano trios",
                "Make me a jazz playlist"
            ]
        },
        "r&b": {
            reply: "R&B and neo-soul have the richest vocal harmonies and pocket grooves in music. ✨ From 90s classics to **SZA**, **Frank Ocean**, and **H.E.R.**, it always hits right in the feelings.\n\nAre you more into 90s/2000s throwback R&B or modern alternative R&B?",
            chips: [
                "90s & 2000s throwback R&B",
                "Modern alternative R&B & neo-soul",
                "Late-night slow jams",
                "Make me an R&B playlist"
            ]
        },
        edm: {
            reply: "Electronic and house music have such contagious energy—especially when a melodic build finally drops! 🎧 Are you more into sunset melodic house like **RÜFÜS DU SOL**, French touch like **Daft Punk**, or big festival anthems?",
            chips: [
                "Melodic house like RÜFÜS DU SOL",
                "Classic French house & Daft Punk",
                "High-energy festival anthems",
                "Make me an electronic playlist"
            ]
        },
        throwback: {
            reply: "80s and 90s throwbacks are undefeated! 📼 The songwriting and hooks from those two decades are so iconic that everyone knows the chorus within three seconds.\n\nIf you had to pick one decade for a road trip—are you going 1980s or 1990s?",
            chips: [
                "Definitely the 1980s!",
                "1990s all the way!",
                "Impossible to choose—both!",
                "Make me an 80s & 90s playlist"
            ]
        },
        pop: {
            reply: "Great pop music is harder to write than people think—a hook that sticks in your head all week is pure craft! ✨ Do you like upbeat dance-pop, retro synth-pop like **The Weeknd** and **Dua Lipa**, or indie pop?",
            chips: [
                "Retro synth-pop",
                "Upbeat feel-good dance pop",
                "Chill indie pop",
                "Make me a pop playlist"
            ]
        },
        chill: {
            reply: "Laid-back, unhurried grooves are the best way to let the day slow down. 🌅 When you want to chill out, do you prefer mellow vocals or pure instrumental beats?",
            chips: [
                "Mellow vocals & warm grooves",
                "Pure instrumental beats",
                "A mix of both",
                "Make me a chill playlist"
            ]
        }
    };

    const MUSIC_TRIVIA_FACTS = [
        "🎲 **Fun Music Fact:** Daft Punk's *\"One More Time\"* vocal hook was recorded in 1998 with Romanthony, and Thomas Bangalter & Guy-Manuel actually kept the track sitting on a shelf for nearly **two years** before releasing it in 2000!",
        "🎲 **Fun Music Fact:** Toto's *\"Africa\"* was almost left off their 1982 album *Toto IV* because the band thought it didn't sound like their other rock tracks—and it ended up becoming their biggest #1 hit!",
        "🎲 **Fun Music Fact:** Michael Jackson's *\"Billie Jean\"* has one of the most recognizable drum intros in history, recorded by drummer Leon 'Ndugu' Chancler in just a couple of takes with a custom plywood cover over the drum kit!",
        "🎲 **Fun Music Fact:** Prince played **all 27 instruments** on his 1978 debut album *For You*—including synths, guitars, bass, drums, and every layer of vocal harmony!"
    ];

    const MUSIC_JOKES = [
        "😂 Why did the synthesizer break up with the acoustic guitar?\n\nBecause they just couldn't find the right *frequency*—and the guitar had way too many *strings* attached! 🎹🎸",
        "😂 How do you know when a drummer is knocking at your front door?\n\nThe knocking speeds up, slows down, and never quite comes in on the one! 🥁",
        "😂 Why are jazz musicians so great at conversation?\n\nBecause even when they make a mistake, they just repeat it twice, smile, and call it *improvisation*! 🎷",
        "😂 Why was the piano having trouble making friends?\n\nBecause it kept being too *key*-pish and couldn't stop *pedaling* rumors! 🎹",
        "😂 Why did the singer climb a ladder on stage?\n\nTo reach the *high notes*! 🎤"
    ];

    async function fetchLiveConversationalAiReply(userText) {
        try {
            const activeTracksContext = (assistantMemory.lastTracks && assistantMemory.lastTracks.length > 0)
                ? ` Current playlist on screen: ${assistantMemory.lastTracks.slice(0, 6).map((t, i) => `#${i + 1} "${t.title}" by ${t.artist} (${t.year || ''})`).join(', ')}.`
                : '';
            const userContext = assistantMemory.userName
                ? ` The user's name is ${assistantMemory.userName}. Address them by name naturally.`
                : '';
            const moodContext = assistantMemory.userMood
                ? ` User mentioned feeling: ${assistantMemory.userMood}.`
                : '';
            const activityContext = assistantMemory.userActivity
                ? ` User current activity: ${assistantMemory.userActivity}.`
                : '';

            const sysMsg =
                `You are MP3aud.io, an empathetic, highly intelligent AI personal assistant for music and daily conversation.` +
                userContext + moodContext + activityContext + activeTracksContext +
                `\nRules:\n` +
                `- Talk naturally and warmly like a personal friend and music concierge texting via messenger.\n` +
                `- Keep responses concise and engaging (1 to 2 short sentences).\n` +
                `- Never use robotic assistant disclaimers, numbered bullet lists, or repetitive scripted greetings.\n` +
                `- Acknowledge what the user said with genuine empathy or enthusiasm, and ALWAYS ask an interactive follow-up question to keep the back-and-forth conversation flowing.\n` +
                `- Do NOT output a playlist of songs unless the user explicitly asks to make, build, or play a playlist.`;

            const recentHistory = chatHistory.slice(-6).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: String(m.content || '').slice(0, 300)
            }));
            if (recentHistory.length === 0 || recentHistory[recentHistory.length - 1].content !== userText) {
                recentHistory.push({ role: 'user', content: userText });
            }

            // Strategy 1: OpenAI-compatible POST
            try {
                const resp = await fetchWithTimeout('https://text.pollinations.ai/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'openai',
                        messages: [{ role: 'system', content: sysMsg }, ...recentHistory],
                        temperature: 0.75
                    })
                }, 3200);

                if (resp && resp.ok) {
                    const data = await resp.json();
                    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
                    if (content && typeof content === 'string' && !content.includes('Free limit reached') && content.trim().length > 2) {
                        return content.trim();
                    }
                }
            } catch (_) {}

            // Strategy 2: GET fallback with query params
            try {
                const encPrompt = encodeURIComponent(userText.slice(0, 160));
                const encSys = encodeURIComponent(sysMsg.slice(0, 220));
                const getResp = await fetchWithTimeout(`https://text.pollinations.ai/${encPrompt}?system=${encSys}`, {
                    method: 'GET'
                }, 2800);
                if (getResp && getResp.ok) {
                    const text = await getResp.text();
                    if (text && !text.includes('Free limit reached') && !text.includes('Please wait') && text.trim().length > 2) {
                        return text.trim();
                    }
                }
            } catch (_) {}
        } catch (_) {}
        return null;
    }

    async function generateConversationalReply(rawText, lower) {
        assistantMemory.turnCount++;

        // 1. Detect and remember user's name if shared
        const nameMatch = rawText.match(/\b(?:my name is|i am|i'm|im|call me)\s+([A-Z][a-z]{1,18}|[a-z]{2,18})\b/i);
        let justIntroducedName = false;
        if (nameMatch && !/^(listening|looking|feeling|doing|tired|here|fine|good|ok|chilling|working|ready|sorry|happy|sad|bored|stressed)$/i.test(nameMatch[1])) {
            const rawName = nameMatch[1];
            assistantMemory.userName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
            try { localStorage.setItem('mp3audio_user_name', assistantMemory.userName); } catch (_) {}
            justIntroducedName = true;
        }
        const userDisplayName = assistantMemory.userName ? ` ${assistantMemory.userName}` : '';

        // 2. Track user mood if expressed
        if (/\b(tired|exhausted|beat|drained|sleepy|worn out|long day)\b/i.test(lower)) {
            assistantMemory.userMood = 'tired';
        } else if (/\b(stressed|anxious|overwhelmed|hectic|crazy day|stressful)\b/i.test(lower)) {
            assistantMemory.userMood = 'stressed';
        } else if (/\b(hyped|excited|pumped|energized|great|amazing|awesome|so good|happy)\b/i.test(lower)) {
            assistantMemory.userMood = 'hyped';
        } else if (/\b(sad|down|bummed|rough|bad day|depressed|heartbroken)\b/i.test(lower)) {
            assistantMemory.userMood = 'down';
        } else if (/\b(bored|nothing to do|boring)\b/i.test(lower)) {
            assistantMemory.userMood = 'bored';
        }

        // 3. Track user activity if expressed
        if (/\b(cook|cooking|dinner|lunch|baking|recipe|food|eating|meal)\b/i.test(lower)) {
            assistantMemory.userActivity = 'cooking';
        } else if (/\b(study|studying|homework|exam|finals|reading|class|lecture)\b/i.test(lower)) {
            assistantMemory.userActivity = 'studying';
        } else if (/\b(gym|workout|working out|running|lift|lifting|cardio|training)\b/i.test(lower)) {
            assistantMemory.userActivity = 'workout';
        } else if (/\b(drive|driving|traffic|road trip|car|commute|commuting)\b/i.test(lower)) {
            assistantMemory.userActivity = 'driving';
        } else if (/\b(work|working|office|job|boss|shift|meeting|desk)\b/i.test(lower)) {
            assistantMemory.userActivity = 'working';
        } else if (/\b(relaxing|chilling|couch|sofa|bed|resting|unwinding|peace)\b/i.test(lower)) {
            assistantMemory.userActivity = 'relaxing';
        }

        // Track genre or mood presets mentioned
        const mentionedVibe = detectVibeKeyFromText(lower);
        if (mentionedVibe) {
            assistantMemory.pendingVibeKey = mentionedVibe;
            assistantMemory.lastGenreDiscussed = mentionedVibe;
        }

        // Try live conversational AI first for dynamic, open-ended intelligence
        const liveAiReply = await fetchLiveConversationalAiReply(rawText);
        if (liveAiReply) {
            return {
                success: true,
                mode: 'chat',
                reply: liveAiReply,
                tracks: []
            };
        }

        // =========================================================================
        // Context-Aware Multi-Turn AI Personal Assistant Synthesizer (Fallback & State Engine)
        // =========================================================================

        // A. Name Introduction
        if (justIntroducedName) {
            return {
                success: true,
                mode: 'chat',
                reply: `Great to meet you, **${assistantMemory.userName}**! 🎧 I'm your AI personal assistant for music. I can curate custom playlists, dig up artist trivia, pull up 320kbps MP3s or custom phone ringtones, or just chat with you about life and music.\n\nWhat kind of sounds are you in the mood for today?`,
                tracks: []
            };
        }

        // B. Assistant Identity & Capabilities ("who are you", "what can you do", "help", "how does this work")
        if (/\b(who are you|what are you|what can you do|how does this work|how do you work|help me|what are your features|commands)\b/i.test(lower)) {
            return {
                success: true,
                mode: 'chat',
                reply: `I'm your **AI Personal Assistant & Music DJ** on MP3aud.io! 🎧 Think of me like a music-obsessed friend who also has instant access to millions of songs. Here's what we can do together:\n\n• **Curate Custom Playlists:** Tell me any vibe, mood, decade, or activity and I'll build you a 6-track mix.\n• **Instant Audio & MP3s:** Preview full audio bubbles right in our chat, or download 320kbps MP3s with HD Apple Music cover art.\n• **Music Discovery & Trivia:** Ask me about any artist, album, release year, or backstories.\n• **Custom Phone Ringtones:** Extract custom iPhone (\`.m4r\`) and Android (\`.mp3\`) ringtones in one click.\n• **Everyday Conversation:** Chat with me about your day, work, cooking, or whatever is on your mind!\n\nWhat would you like to explore today${userDisplayName}?`,
                tracks: []
            };
        }

        // C. Greetings & Check-ins ("hi", "hello", "hey", "sup", "what's up", "good morning")
        if (/^(hi|hey|hello|yo|sup|what's up|whats up|howdy|hiya|good morning|good afternoon|good evening|morning|evening)[!.?\s]*$/i.test(lower)) {
            assistantMemory.lastConvCategory = 'greeting';
            if (assistantMemory.turnCount <= 2) {
                return {
                    success: true,
                    mode: 'chat',
                    reply: `Hey${userDisplayName}! 👋 How's your day going so far? We can chat about whatever's on your mind, explore new music, or whenever you want me to put together a playlist, just let me know.`,
                    tracks: []
                };
            }
            return {
                success: true,
                mode: 'chat',
                reply: `Hey again${userDisplayName}! 🎧 What's on your mind right now—how's the rest of your day shaping up?`,
                tracks: []
            };
        }

        // D. How are you / Status check
        if (/^(hey|hi|hello|yo)?\s*(how are you|how's it going|hows it going|how are things|how do you do|what are you up to|wyd|you good|how's your day|hows your day)[!.?\s]*$/i.test(lower)) {
            assistantMemory.lastConvCategory = 'day_status';
            const recentMix = assistantMemory.lastPlaylistTitle
                ? ` Still vibing to that **${assistantMemory.lastPlaylistTitle}** mix from earlier!`
                : ` Just hanging out in the studio and listening to some records.`;
            return {
                success: true,
                mode: 'chat',
                reply: `I'm doing great, thanks for asking${userDisplayName}! 🎧${recentMix} How has your day been treating you—smooth sailing or pretty busy?`,
                tracks: []
            };
        }

        // E. Gratitude & Compliments
        if (/^(thanks|thank you|thx|ty|appreciate it|love it|love this|this is fire|fire|awesome|amazing|great picks|so good|dope|nice|cool|perfect|you're the best|you rock|haha|lol|lmao|that's funny|thats funny)[!.?\s]*$/i.test(lower)) {
            const lastMix = assistantMemory.lastPlaylistTitle;
            return {
                success: true,
                mode: 'chat',
                reply: lastMix
                    ? `Anytime${userDisplayName}! 🙌 Really glad you're enjoying **${lastMix}**. Which track on that list hits best for you, or what else are you up to today?`
                    : `Haha anytime${userDisplayName}! 🙌 Always fun hanging out and chatting with you. What else is going on with your day?`,
                tracks: []
            };
        }

        // F. User Moods & Emotional Support
        if (assistantMemory.userMood === 'tired') {
            return {
                success: true,
                mode: 'chat',
                reply: `I feel that—some days really drain the battery${userDisplayName}. 🛋️ Make sure to give yourself some downtime today. Are you able to kick back and rest for a bit, or do you still have more to get through?`,
                tracks: []
            };
        }
        if (assistantMemory.userMood === 'stressed') {
            return {
                success: true,
                mode: 'chat',
                reply: `Take a deep breath${userDisplayName}—you're doing the best you can, and things will smooth out. 💙 Do you want to vent for a second, or would you rather put on some calming, ambient music to quiet the noise?`,
                tracks: []
            };
        }
        if (assistantMemory.userMood === 'hyped') {
            return {
                success: true,
                mode: 'chat',
                reply: `Love that energy${userDisplayName}! 🔥 Always an amazing feeling when things are rolling along smoothly. What's bringing the good vibes today?`,
                tracks: []
            };
        }
        if (assistantMemory.userMood === 'down') {
            return {
                success: true,
                mode: 'chat',
                reply: `I'm really sorry you're feeling down today${userDisplayName}. Sending you warm vibes. 🤍 Do you want to talk about what's going on, or would some gentle acoustic songs be a comforting companion right now?`,
                tracks: []
            };
        }
        if (assistantMemory.userMood === 'bored') {
            return {
                success: true,
                mode: 'chat',
                reply: `Boredom is just an open invitation for discovering something new! 🎲 Want me to hit you with a mind-blowing music trivia fact, play a music guessing game, or put together a surprise mix for you?`,
                tracks: []
            };
        }

        // G. User Activities
        if (assistantMemory.userActivity === 'cooking') {
            return {
                success: true,
                mode: 'chat',
                reply: `Cooking is an art form! 🍝 What are you whipping up in the kitchen? I find that cooking with great background jazz or warm acoustic tunes makes everything taste better.`,
                tracks: []
            };
        }
        if (assistantMemory.userActivity === 'studying') {
            return {
                success: true,
                mode: 'chat',
                reply: `Lock in${userDisplayName}! 📚 Deep work takes focus. What subject or project are you tackling? If you want background focus beats with zero distracting vocals, just say the word.`,
                tracks: []
            };
        }
        if (assistantMemory.userActivity === 'workout') {
            return {
                success: true,
                mode: 'chat',
                reply: `Get after it!! 💪 Consistent effort always pays off. What are you training today—heavy lifting, cardio, or a full-body session?`,
                tracks: []
            };
        }
        if (assistantMemory.userActivity === 'driving') {
            return {
                success: true,
                mode: 'chat',
                reply: `Nothing beats the open road with great sound! 🚗 Where are you driving to—a long road trip or just running errands around town?`,
                tracks: []
            };
        }
        if (assistantMemory.userActivity === 'working') {
            return {
                success: true,
                mode: 'chat',
                reply: `I hear you—staying locked in on work takes real energy! 💯 What kind of projects are you tackling today, or are you counting down the hours until you can wrap up?`,
                tracks: []
            };
        }
        if (assistantMemory.userActivity === 'relaxing') {
            return {
                success: true,
                mode: 'chat',
                reply: `Honestly, taking a real breather and slowing the pace down is undefeated. ☕✨ Are you having a quiet night in, or got plans for later?`,
                tracks: []
            };
        }

        // H. Weather Conversation
        if (/\b(weather|rain|raining|rainy|sunny|sun|snow|snowing|forecast|temperature|degrees|windy|cloudy|storm|chilly|cold outside|hot outside|warm outside|humid|breezy)\b/i.test(lower)) {
            assistantMemory.lastConvCategory = 'weather';
            if (/\b(rain|raining|rainy|storm|cloudy|gray|gloomy|overcast)\b/i.test(lower)) {
                return {
                    success: true,
                    mode: 'chat',
                    reply: `Honestly, rainy days have a whole cozy vibe of their own 🌧️ It's the best excuse to stay inside, grab something warm to drink, and take it slow. Do you get to stay in and relax today, or do you have to head out in it?`,
                    tracks: []
                };
            }
            if (/\b(cold|chilly|freezing|snow|snowing|windy)\b/i.test(lower)) {
                return {
                    success: true,
                    mode: 'chat',
                    reply: `Brr, definitely a stay-warm-indoors kind of day! ❄️ Hopefully you don't have to be out in the cold too long. What are you up to today—working or taking it easy?`,
                    tracks: []
                };
            }
            return {
                success: true,
                mode: 'chat',
                reply: `You can't beat nice weather like that! ☀️ It's a comfortable 72° inside the studio booth. Are you getting a chance to get outside and enjoy it today, or stuck indoors?`,
                tracks: []
            };
        }

        // I. Music Recommendations & "What should I listen to?"
        if (/\b(what should i listen to|recommend|recommend me|what to listen to|give me a recommendation|who should i listen to|need some music|want some music)\b/i.test(lower)) {
            assistantMemory.lastConvCategory = 'recommendation';
            return {
                success: true,
                mode: 'chat',
                reply: `I'd love to help you discover something great${userDisplayName}! 🎶 To point you in the right direction: are you looking for 1) **High-energy beats** to pump you up, 2) **Chill, atmospheric grooves** to relax, or 3) **Classic, lyrical storytelling**? Let me know which direction calls to you!`,
                tracks: []
            };
        }

        // J. Music Trivia & Facts
        if (/\b(fact|trivia|did you know|something interesting|random fact|story|distract me)\b/i.test(lower)) {
            const fact = MUSIC_TRIVIA_FACTS[assistantMemory.turnCount % MUSIC_TRIVIA_FACTS.length];
            return {
                success: true,
                mode: 'chat',
                reply: `${fact}\n\nCrazy how many iconic songs almost didn't happen, right? Did you know that one already, or was it new to you?`,
                tracks: []
            };
        }

        // K. Music Jokes
        if (/\b(joke|funny|make me laugh|humor)\b/i.test(lower)) {
            const joke = MUSIC_JOKES[assistantMemory.turnCount % MUSIC_JOKES.length];
            return {
                success: true,
                mode: 'chat',
                reply: `${joke}\n\nBe honest—solid dad-level music joke or terrible? 😄`,
                tracks: []
            };
        }

        // L. Assistant's Own Taste & Opinions
        if (/\b(your favorite|what do you like|what kind of music do you|what music are you|what music have you|who is your favorite|what's your favorite|best song|best artist|favorite album)\b/i.test(lower)) {
            assistantMemory.lastConvCategory = 'genre_chat';
            return {
                success: true,
                mode: 'chat',
                reply: `Ooh, I love talking shop! 🎧 Lately I've had **Daft Punk** (*Discovery*), **Fleetwood Mac** (*Rumours*), **M83** for late-night synthwave, and **A Tribe Called Quest** on heavy rotation.\n\nWhat about you—what genres or artists do you find yourself coming back to the most?`,
                tracks: []
            };
        }

        // M. Check if user mentioned an artist/band name during conversation
        const explicitArtistMention =
            /^(i really like|i love|i like|i'm a fan of|im a fan of|have you heard of|do you like|what do you think of|my favorite artist is|my favorite band is)\s+([a-z0-9\s'&.-]{2,30})[?!.]*$/i.exec(rawText) ||
            ((assistantMemory.lastConvCategory === 'genre_chat' || assistantMemory.lastConvCategory === 'era_chat') &&
                rawText.split(/\s+/).length <= 3 &&
                !/\b(yes|no|yeah|nah|ok|okay|sure|good|fine|why|how|what|when|where|who|chat|talking|week|day|work|home)\b/i.test(lower)
                ? [null, '', rawText.replace(/[?!.]+$/, '').trim()]
                : null);

        if (explicitArtistMention && explicitArtistMention[2]) {
            const candidateArtist = explicitArtistMention[2].trim();
            const [wikiBio, itunesItems] = await Promise.all([
                fetchWikipediaSummary(`${candidateArtist} musician`),
                searchItunesFast(candidateArtist, 4, 1500)
            ]);
            if (wikiBio || (itunesItems && itunesItems.length > 0)) {
                const topArtist = (itunesItems && itunesItems[0] && itunesItems[0].artistName) ? itunesItems[0].artistName : candidateArtist;
                const topAlbums = (itunesItems || [])
                    .map(it => it.collectionName)
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .slice(0, 2);

                assistantMemory.pendingTopic = topArtist;
                assistantMemory.lastArtist = topArtist;
                assistantMemory.lastArtistDiscussed = topArtist;
                assistantMemory.lastConvCategory = 'artist_chat';

                let chatText = wikiBio
                    ? `Ooh, great taste! 🎶 **${topArtist}** — ${wikiBio}`
                    : `Ooh, great choice! 🎶 **${topArtist}** has such an iconic sound and catalog.`;
                if (topAlbums.length > 0) {
                    chatText += `\n\nReleases like *${topAlbums.join('* and *')}* are standout records. What's your personal favorite song or album by **${topArtist}**?`;
                } else {
                    chatText += `\n\nWhat's your personal favorite song or album by **${topArtist}**?`;
                }

                return {
                    success: true,
                    mode: 'chat',
                    reply: chatText,
                    tracks: []
                };
            }
        }

        // N. General Back-and-Forth Fallback (Rotates naturally so it never repeats the same canned response)
        const generalReplies = [
            `I hear you${userDisplayName}! 😊 Honestly, it's nice just catching up and chatting. How has the rest of your week been treating you so far—pretty smooth or super busy?`,
            `Totally get that${userDisplayName}! 🙌 When you get some free time to yourself, what do you usually like to get into—music, movies, gaming, or getting outside?`,
            `That's awesome${userDisplayName}! 😄 By the way, if you were going on a long road trip today and could only bring three albums or artists for the drive, who's making the cut?`,
            `I'm right there with you${userDisplayName}. 🎧 Having good conversation makes any day better. What kind of music usually sets the tone for your evenings?`
        ];
        const chosenGeneral = generalReplies[assistantMemory.turnCount % generalReplies.length];
        return {
            success: true,
            mode: 'chat',
            reply: chosenGeneral,
            tracks: []
        };
    }

    function isConversationalOnlyMessage(lower) {
        // Detect playlist steering and explanation commands
        if (/\b(why did you pick|tell me about these|about this playlist|explain these songs|what makes this good)\b/i.test(lower)) return 'explain_picks';
        if (/\b(make it more upbeat|more upbeat|faster|more energy|higher energy|pump it up|too slow|wake me up)\b/i.test(lower)) return 'steer_upbeat';
        if (/\b(make it chiller|more chill|slower|softer|mellower|dial it back|too loud|too fast|calmer)\b/i.test(lower)) return 'steer_chill';
        if (/^(keep going|more like this|volume 2|vol 2|part 2|same vibe|more of this)[!.?\s]*$/i.test(lower)) return 'continue_vibe';
        return null;
    }

    async function clientSideCurateFallback(messageText) {
        const rawText = (messageText || '').trim();
        const lower = rawText.toLowerCase();
        const isRingtone = /ringtone|m4r|alarm tone|text tone/.test(lower);
        const isAskingForNewOrAnother = /\b(new|another|different|fresh|random|more|next|surprise|other|else|switch|change|again)\b/i.test(lower);

        // 0. Check playlist-steering intents (upbeat, chill, continue vibe, explain picks)
        const convIntent = isConversationalOnlyMessage(lower);
        if (convIntent === 'explain_picks') {
            if (assistantMemory.lastTracks && assistantMemory.lastTracks.length > 0) {
                const sample = assistantMemory.lastTracks.slice(0, 3).map(t => `**${t.title}** by *${t.artist}* (${t.year || 'Classic'})`).join(', ');
                return {
                    success: true,
                    mode: 'chat',
                    reply: `Great question! 🎧 When I built **${assistantMemory.lastPlaylistTitle || 'your mix'}**, I wanted a natural arc where each song flows into the next without jarring tempo jumps. Tracks like ${sample} share warm harmonic textures and a cohesive groove so you can hit **Play All** and stay in the zone from start to finish.\n\nYou can also ask me about any specific track (like *"When did track 2 come out?"* or *"Swap track 3"*)!`,
                    suggestions: [
                        `📅 What year did these songs come out?`,
                        `💬 Tell me about ${assistantMemory.lastArtist || 'the lead artist'}`,
                        `🔥 Give me 6 more in this style`,
                        `🎲 Show me a different genre`
                    ],
                    tracks: []
                };
            }
        }
        if (convIntent === 'steer_upbeat') {
            const upbeatKeys = ['pop', 'edm', 'workout', 'throwback'];
            const nextKey = upbeatKeys[rotationCursor++ % upbeatKeys.length];
            return await curatePresetVibePlaylist(
                nextKey,
                true,
                `Got you—let's pick up the tempo and bring the energy way up! ⚡ I swapped out the slower grooves for **6 punchy, high-BPM tracks** that hit right away:`,
                `How's that tempo feeling now? Say the word if you want to go even harder (full gym/festival energy) or ask me anything about these tracks!`
            );
        }
        if (convIntent === 'steer_chill') {
            const chillKeys = ['chill', 'lofi', 'acoustic', 'r&b', 'jazz'];
            const nextKey = chillKeys[rotationCursor++ % chillKeys.length];
            return await curatePresetVibePlaylist(
                nextKey,
                true,
                `Say less—dialing it back to something much smoother, warmer, and more laid-back 🌙 Here are **6 mellow tracks** to let the room breathe:`,
                `Better? Let me know if you want pure instrumental beats (no vocals) or warm acoustic guitar next.`
            );
        }
        if (convIntent === 'continue_vibe' && assistantMemory.lastVibeKey) {
            return await curatePresetVibePlaylist(
                assistantMemory.lastVibeKey,
                true,
                `Keeping that exact wave going! 🌊 Here is **Volume 2** with **6 fresh tracks** in the same lane so the vibe never drops:`,
                `Still locked in! Tap ▶ Play All in Chat to queue these up right behind the first batch.`
            );
        }

        // 0.25 Check Follow-Up Questions (about tracks, release years, albums, artists, playback, swapping tracks, or how-to)
        const followUpAnswer = await answerFollowUpQuestion(rawText, lower);
        if (followUpAnswer) {
            return followUpAnswer;
        }

        // 0.3 Determine whether the user SPECIFICALLY asked for a playlist or a single track/ringtone!
        const wasAwaitingVibe = Boolean(assistantMemory.awaitingPlaylistVibe);
        if (wasAwaitingVibe) {
            assistantMemory.awaitingPlaylistVibe = false;
        }
        const wantsPlaylist = wasAwaitingVibe || isExplicitPlaylistRequest(lower);
        const wantsSingleTrack = !wasAwaitingVibe && isExplicitSingleTrackRequest(rawText, lower);

        // If the user did NOT specifically ask for a playlist or a track, just have a natural human conversation!
        if (!wantsPlaylist && !wantsSingleTrack) {
            return await generateConversationalReply(rawText, lower);
        }

        // 0.5 User explicitly asked for a playlist matching a real-life moment or mood
        const lifeMoment = detectHumanLifeMoment(lower);
        if (lifeMoment && wantsPlaylist && !isRingtone) {
            return await curatePresetVibePlaylist(lifeMoment.vibeKey, isAskingForNewOrAnother, lifeMoment.customIntro, lifeMoment.followUp);
        }

        // 1. User explicitly asked for a playlist matching a specific genre/vibe preset
        const matchedVibeKey = detectVibeKeyFromText(lower);
        if (matchedVibeKey && wantsPlaylist && !isRingtone) {
            return await curatePresetVibePlaylist(matchedVibeKey, isAskingForNewOrAnother);
        }

        // 2. Clean conversational filler & "new/another/different playlist" modifiers
        let cleanQ = rawText
            .replace(/^(hey|hi|hello|yo|please|can you|could you|send me|play|find|get me|make me|create|give me|i want|i need|text me|build me|curate|generate|drop|how about|show me|put on|listen to|download|stream)\s+/i, '')
            .replace(/\b(a new|another|a different|a fresh|a random|new|different|fresh|random|surprise|more|next|other)\s+(playlist|mix|songs|tracks|music|vibe|list)\b/gi, ' ')
            .replace(/\b(a playlist of|a playlist for|playlist around|playlist|songs by|tracks by|music by|songs like|tracks like|music like|more like|ringtone of|ringtone for|ringtone|mp3|audio|song|track|mix)\b/gi, ' ')
            .replace(/^(a|an|some|the|me|for me|please|now|of|by)\b\s*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        const isSurpriseOrAnother = /\b(surprise|random|another|different|fresh|more|next|anything|whatever you want|you pick|dealers choice|dealer's choice)\b/i.test(lower);
        const isGenericNewPlaylistRequest = !cleanQ || /^(new|another|different|fresh|random|more|next|surprise|surprise me|something new|something else|anything|music|songs|tracks|vibe|vibes|good music|your favorite)$/i.test(cleanQ);

        // 3. If user asked generically for a playlist ("make me a playlist") without specifying a vibe yet:
        //    - If we already discussed a vibe/topic in the conversation, use that context!
        //    - If they didn't ask for a surprise/another mix, ask them conversationally what mood/genre they're feeling first!
        if (wantsPlaylist && isGenericNewPlaylistRequest && !isRingtone) {
            if (!isSurpriseOrAnother && !wasAwaitingVibe) {
                if (assistantMemory.pendingVibeKey) {
                    const pendingKey = assistantMemory.pendingVibeKey;
                    assistantMemory.pendingVibeKey = null;
                    return await curatePresetVibePlaylist(pendingKey, true);
                }
                if (assistantMemory.pendingTopic) {
                    cleanQ = assistantMemory.pendingTopic;
                    assistantMemory.pendingTopic = null;
                } else {
                    assistantMemory.awaitingPlaylistVibe = true;
                    return {
                        success: true,
                        mode: 'chat',
                        reply: `I'd love to put a playlist together for you! What kind of mood, genre, or artist are you feeling right now? (Or just say "surprise me" if you want me to pick!)`,
                        tracks: []
                    };
                }
            } else {
                let nextKey = VIBE_KEYS_LIST[rotationCursor % VIBE_KEYS_LIST.length];
                rotationCursor++;
                if (nextKey === lastVibeKey) {
                    nextKey = VIBE_KEYS_LIST[rotationCursor % VIBE_KEYS_LIST.length];
                    rotationCursor++;
                }
                return await curatePresetVibePlaylist(nextKey, true);
            }
        }

        if (!cleanQ) cleanQ = rawText;

        const limit = (isRingtone || !wantsPlaylist) ? 1 : 6;

        try {
            const results = await searchItunesFast(cleanQ, limit * 3, 1800);
            const seen = new Set();
            const tracks = [];
            for (const pass of [1, 2]) {
                for (const item of (results || [])) {
                    const k = `${(item.trackName || '').toLowerCase()}|${(item.artistName || '').toLowerCase()}`;
                    if (!item.trackName || seen.has(k)) continue;
                    if (pass === 1 && isAskingForNewOrAnother && shownTrackKeys.has(k)) continue;
                    seen.add(k);
                    shownTrackKeys.add(k);
                    tracks.push(mapItunesResult(item, tracks.length + 1));
                    if (tracks.length >= limit) break;
                }
                if (tracks.length >= limit) break;
            }

            if (tracks.length > 0) {
                assistantMemory.lastTracks = tracks;
                assistantMemory.lastArtist = tracks[0].artist || cleanQ;
                assistantMemory.lastPlaylistTitle = tracks.length === 1 ? `${tracks[0].title} — ${tracks[0].artist}` : `${cleanQ} — Curated Mix`;
                assistantMemory.turnCount++;

                if (tracks.length === 1 || isRingtone) {
                    const t = tracks[0];
                    return {
                        success: true,
                        reply: isRingtone
                            ? `Great pick for a ringtone! 📱 I pulled **${t.title}** by **${t.artist}**. Tap play below to preview it, or click **⬇ Ringtone** to get your custom iPhone (.M4R) & Android (.MP3) files:`
                            : `Love that track! 🔥 Here is **${t.title}** by **${t.artist}** (${t.album || 'Single'}${t.year ? ', ' + t.year : ''}). Tap ▶ in the bubble below to listen right now, or grab the full 320kbps MP3:`,
                        follow_up_note: `Want me to build a full 6-track playlist around **${t.artist}**, or pull more songs with this exact energy?`,
                        suggestions: [
                            `🎵 Build a 6-track ${t.artist} playlist`,
                            `🔥 More songs like ${t.title}`,
                            `📱 Make a ringtone of ${t.title}`,
                            `🎲 Surprise me with a new playlist`
                        ],
                        mode: isRingtone ? 'ringtone' : 'single',
                        playlist_title: `${t.title} — ${t.artist}`,
                        playlist_vibe: `${t.album} ${t.year ? '(' + t.year + ')' : ''}`,
                        tracks: [t]
                    };
                }
                return {
                    success: true,
                    reply: `Ooh, great taste! 🎧 I hand-picked **${tracks.length} standout tracks** for **${cleanQ}**—kicking off with **${tracks[0].title}** by **${tracks[0].artist}**. Tap ▶ on any bubble to listen right in our chat, or grab the full Playlist ZIP:`,
                    follow_up_note: `What do you think of this lineup? Tell me if you want deeper cuts from **${tracks[0].artist}**, something faster, or a fresh vibe!`,
                    suggestions: [
                        `🔥 More tracks by ${tracks[0].artist}`,
                        `⚡ Make it more upbeat`,
                        `🌙 Make it chiller`,
                        `🔄 Curate another playlist`
                    ],
                    mode: 'playlist',
                    playlist_title: `${cleanQ} — Curated Mix`,
                    playlist_vibe: `Personal DJ Selection • 320kbps & ID3 Tagged`,
                    tracks
                };
            }
        } catch (err) {
            console.warn('iTunes fallback search error:', err);
        }

        // If custom search timed out and user wanted a playlist, never stall — serve a fresh rotated playlist!
        if (wantsPlaylist && !isRingtone) {
            const fallbackKey = VIBE_KEYS_LIST[rotationCursor++ % VIBE_KEYS_LIST.length];
            return await curatePresetVibePlaylist(fallbackKey, true);
        }

        // If the user was just having a normal conversation, return conversational reply rather than treating text as a track
        if (!wantsPlaylist && !wantsSingleTrack) {
            return await generateConversationalReply(rawText, lower);
        }

        return {
            success: true,
            reply: `I lined up **${cleanQ}** for you! 🎵 Click **⬇ MP3** below to extract and tag the full 320kbps studio audio track:`,
            follow_up_note: `Want me to put together a full playlist around **${cleanQ}** next?`,
            suggestions: [
                `🎵 Build a playlist around ${cleanQ}`,
                `🔄 Surprise me with a new playlist`
            ],
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

    async function playTrackFromQueue(queue, index) {
        if (!queue || index < 0 || index >= queue.length) return;
        currentQueue = queue;
        currentQueueIndex = index;
        const track = currentQueue[currentQueueIndex];

        // Lazy on-demand preview resolution if track was rendered via instant seed fallback
        if (!track.preview_url) {
            try {
                const items = await searchItunesFast(`${track.artist || ''} ${track.title || ''}`.trim(), 1, 1800);
                if (items && items[0] && items[0].previewUrl) {
                    track.preview_url = items[0].previewUrl;
                    if (items[0].artworkUrl100) {
                        track.artwork_url = items[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
                        const artEl = document.querySelector(`.track-audio-bubble[data-bubble-id="${track.bubbleId}"] .track-cover-img`);
                        if (artEl) artEl.src = track.artwork_url;
                    }
                }
            } catch (_) { }
        }

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
        const hasTracks = tracks.length > 0;
        const isPlaylist = tracks.length > 1;
        const playlistTitle = payload.playlist_title || 'Curated Selection';
        const playlistVibe = payload.playlist_vibe || '320kbps Studio Audio • Auto ID3 Tagged';
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const row = document.createElement('div');
        row.className = 'msg-row assistant-row';

        let playlistHeaderHtml = '';
        if (isPlaylist) {
            const plLinks = makeStreamingUrls(playlistTitle);
            const amPl = (payload.streaming_links && payload.streaming_links.apple_music) || plLinks.apple_music;
            const spPl = (payload.streaming_links && payload.streaming_links.spotify) || plLinks.spotify;
            const ytPl = (payload.streaming_links && payload.streaming_links.youtube_music) || plLinks.youtube_music;
            playlistHeaderHtml = `
                <div class="playlist-header-card">
                    <div class="playlist-header-meta">
                        <span class="playlist-badge-eyebrow">✨ AI CURATED PLAYLIST &bull; ${tracks.length} TRACKS</span>
                        <h3>${escapeHtml(playlistTitle)}</h3>
                        <span>${escapeHtml(playlistVibe)}</span>
                    </div>
                    <div class="playlist-header-actions">
                        <button type="button" class="btn-play-all-chat">▶ Play All in Chat</button>
                        <button type="button" class="btn-new-playlist-chat" title="Curate a fresh playlist">🔄 New Playlist</button>
                        <button type="button" class="btn-download-playlist-zip">📦 Download Playlist (.ZIP)</button>
                    </div>
                    <div class="playlist-streaming-links">
                        <span class="streaming-label">Stream in:</span>
                        <a href="${escapeHtml(amPl)}" target="_blank" rel="noopener" class="stream-pill apple-pill" title="Open playlist in Apple Music">🍎 Apple Music</a>
                        <a href="${escapeHtml(spPl)}" target="_blank" rel="noopener" class="stream-pill spotify-pill" title="Open playlist in Spotify">🟢 Spotify</a>
                        <a href="${escapeHtml(ytPl)}" target="_blank" rel="noopener" class="stream-pill ytmusic-pill" title="Open playlist in YouTube Music">🔴 YouTube Music</a>
                    </div>
                </div>
            `;
        }

        const tracksHtml = hasTracks ? tracks.map((t, idx) => {
            const art = t.artwork_url || 'favicon.png';
            const subMeta = [t.artist, t.album, t.year].filter(Boolean).join(' • ');
            const isRingtoneMode = (payload.mode === 'ringtone') || (videoToMp3Input && videoToMp3Input.checked);
            const tLinks = makeStreamingUrls(t.title, t.artist);
            const amUrl = t.apple_music_url || tLinks.apple_music;
            const spUrl = t.spotify_url || tLinks.spotify;
            const ytUrl = t.youtube_music_url || tLinks.youtube_music;
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
                        <div class="track-streaming-btns">
                            <a href="${escapeHtml(amUrl)}" target="_blank" rel="noopener" class="track-stream-link" title="Open in Apple Music">🍎</a>
                            <a href="${escapeHtml(spUrl)}" target="_blank" rel="noopener" class="track-stream-link" title="Open in Spotify">🟢</a>
                            <a href="${escapeHtml(ytUrl)}" target="_blank" rel="noopener" class="track-stream-link" title="Open in YouTube Music">🔴</a>
                        </div>
                        <button type="button" class="btn-track-mp3" data-idx="${idx}">
                            ${isRingtoneMode ? '⬇ Ringtone' : '⬇ MP3'}
                        </button>
                    </div>
                </div>
            `;
        }).join('') : '';

        const followUpHtml = payload.follow_up_note
            ? `<div class="msg-text" style="margin-top: 10px; font-size: 0.86rem; color: #cbd5e1;"><p>${formatMarkdownBold(payload.follow_up_note)}</p></div>`
            : '';

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
                ${hasTracks ? `<div class="tracks-bubble-stack">${tracksHtml}</div>` : ''}
                ${followUpHtml}
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

        // Wire up Playlist-level Play All, New Playlist & Download ZIP buttons
        const playAllBtn = bubbleEl.querySelector('.btn-play-all-chat');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => {
                playTrackFromQueue(tracks, 0);
            });
        }

        const newPlaylistBtn = bubbleEl.querySelector('.btn-new-playlist-chat');
        if (newPlaylistBtn) {
            newPlaylistBtn.addEventListener('click', () => {
                sendUserMessage('Send me a new playlist');
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
        if (!isBackendAwake) {
            const probe = await fetch(`${BACKEND_URL}/health`, { cache: 'no-store' }).then(r => r.ok).catch(() => false);
            if (probe) {
                unlockChatAfterWake();
            } else {
                showToast(`Cloud server is still spinning up (~${Math.max(1, serverWakeSecondsRemaining)}s). Chat will unlock automatically!`, 'info');
                return;
            }
        }

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
        const lowerText = text.toLowerCase();
        const isAskingForNew = /\b(new|another|different|fresh|random|more|next|surprise|other|else|switch|change|again)\b/i.test(text);
        const isGenericMakePlaylist = /^(hey|hi|hello|yo|please|can you|could you|will you|would you|i want you to|i'd like you to)?\s*(make|build|create|curate|put together|give|send)\s+(me\s+)?(a\s+)?(good\s+|cool\s+|nice\s+)?(playlist|mix|mixtape)\s*[?.!]*$/i.test(lowerText);
        const isExplicitMusicReq = isExplicitPlaylistRequest(lowerText) || isExplicitSingleTrackRequest(text, lowerText);
        const isPureConvOrLifeMoment = Boolean(assistantMemory.awaitingPlaylistVibe || isGenericMakePlaylist || !isExplicitMusicReq || isConversationalOnlyMessage(lowerText));
        const looksLikeQuestion = /\?$/.test(text) || /^(who|what|when|where|why|how|which|tell me|can you tell|do you know|explain|swap|replace|pause|resume|next|skip)\b/i.test(lowerText);

        if (assistantStatusText) {
            assistantStatusText.textContent = (isPureConvOrLifeMoment || looksLikeQuestion)
                ? 'typing a reply...'
                : 'digging through crates & curating tracks...';
        }

        try {
            let result = null;

            // 1. Check if this is an explicit playback control command (pause, resume, skip, swap)
            const followUpAns = await answerFollowUpQuestion(text, lowerText);
            if (followUpAns) {
                await new Promise(r => setTimeout(r, 320));
                result = followUpAns;
            }

            // 2. ALWAYS query the backend LLM assistant API first for genuine, context-aware AI conversation & music curation
            if (!result) {
                const waitTimeoutMs = 15000;
                try {
                    const customAiKey = (localStorage.getItem('mp3audio_custom_ai_key') || '').trim();
                    const reqHeaders = { 'Content-Type': 'application/json' };
                    if (customAiKey) {
                        reqHeaders['X-AI-Key'] = customAiKey;
                    }

                    const backendCall = (async () => {
                        const resp = await fetchWithTimeout(`${BACKEND_URL}/api/assistant/chat`, {
                            method: 'POST',
                            headers: reqHeaders,
                            body: JSON.stringify({
                                message: text,
                                history: chatHistory.slice(-8),
                                current_tracks: (assistantMemory.lastTracks || []).slice(0, 6),
                                options: {
                                    auto_add_album_art: autoAddAlbumArtInput ? autoAddAlbumArtInput.checked : true,
                                    increase_quality: increaseQualityInput ? increaseQualityInput.checked : false,
                                    is_ringtone: videoToMp3Input ? videoToMp3Input.checked : false,
                                    transcribe_audio: attachLyricsInput ? attachLyricsInput.checked : false
                                }
                            })
                        }, waitTimeoutMs - 2000);
                        if (resp && resp.ok) {
                            return await resp.json();
                        }
                        return null;
                    })();

                    const raceTimeout = new Promise(resolve => setTimeout(() => resolve(null), waitTimeoutMs));
                    result = await Promise.race([backendCall, raceTimeout]);
                    if (result && result.success) {
                        isBackendAwake = true;
                    }
                } catch (networkErr) {
                    console.info('Backend assistant offline or timed out, using client fallback:', networkErr);
                }

                let shouldUseClientCuration = !result || !result.success;
                if (!shouldUseClientCuration && isAskingForNew && Array.isArray(result.tracks) && result.tracks.length > 0) {
                    const allAlreadyShown = result.tracks.every(t =>
                        shownTrackKeys.has(`${(t.title || '').toLowerCase()}|${(t.artist || '').toLowerCase()}`)
                    );
                    const looksLikeLiteralNewQuery = /\b(a new|new|another|different)\s+—\s+curated mix/i.test(result.playlist_title || '');
                    if (allAlreadyShown || looksLikeLiteralNewQuery) {
                        shouldUseClientCuration = true;
                    }
                }

                if (shouldUseClientCuration) {
                    result = await clientSideCurateFallback(text);
                } else if (Array.isArray(result.tracks) && result.tracks.length > 0) {
                    result.tracks.forEach(t => {
                        shownTrackKeys.add(`${(t.title || '').toLowerCase()}|${(t.artist || '').toLowerCase()}`);
                    });
                    assistantMemory.lastTracks = result.tracks;
                    assistantMemory.lastPlaylistTitle = result.playlist_title || text;
                    if (result.tracks[0] && result.tracks[0].artist) assistantMemory.lastArtist = result.tracks[0].artist;
                }
            }

            if (typingRow && typingRow.parentNode) typingRow.remove();
            appendAssistantMusicBubble(result);
            chatHistory.push({ role: 'assistant', content: result.reply || '' });
        } catch (err) {
            console.error('Chat message error, recovering with fallback:', err);
            if (typingRow && typingRow.parentNode) typingRow.remove();
            try {
                const fallbackResult = await clientSideCurateFallback(text);
                appendAssistantMusicBubble(fallbackResult);
            } catch (_) {
                showToast('Something went wrong processing your message.', 'error');
            }
        } finally {
            if (wakeTimer) clearInterval(wakeTimer);
            if (typingRow && typingRow.parentNode) typingRow.remove();
            if (assistantStatusText) {
                assistantStatusText.innerHTML = 'Online &bull; AI Personal Assistant &amp; DJ';
            }
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

    // --- Mobile Web App, WhatsApp & Telegram Bot Info & QR Code Hub ---
    const currentOrigin = (window.location && window.location.origin) ? window.location.origin : 'https://mp3aud.io';
    window.currentWebAppUrl = `${currentOrigin}/?q=chill%20late-night%20synthwave%20playlist`;
    window.currentTelegramBotUrl = 'https://t.me/MP3audioBot?start=welcome';
    window.currentWhatsappBotUrl = 'https://wa.me/?text=Send%20me%20a%20chill%20late-night%20synthwave%20playlist';

    window.copyBotLink = function(platform) {
        let link = window.currentWebAppUrl;
        let name = 'Web App Link';
        if (platform === 'telegram') {
            link = window.currentTelegramBotUrl;
            name = 'Telegram Bot';
        } else if (platform === 'whatsapp') {
            link = window.currentWhatsappBotUrl;
            name = 'WhatsApp Assistant';
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => {
                showToast(`Copied ${name} to clipboard!`, 'success');
            }).catch(() => {
                prompt(`Copy ${name}:`, link);
            });
        } else {
            prompt(`Copy ${name}:`, link);
        }
    };

    window.setModalStarterVibe = function(vibeKey, promptText, btnEl) {
        document.querySelectorAll('.modal-vibe-chip').forEach(c => c.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');

        const origin = (window.location && window.location.origin) ? window.location.origin : 'https://mp3aud.io';

        // 1. Update Instant Mobile Web App deep-link & QR code
        const webAppVibeUrl = `${origin}/?q=${encodeURIComponent(promptText)}`;
        window.currentWebAppUrl = webAppVibeUrl;

        const mWeb = document.getElementById('modalWebAppBtn');
        const qWeb = document.getElementById('webAppQrImage');
        const thumbWeb = document.getElementById('sidebarWebQrThumb');
        const sWeb = document.getElementById('sidebarWebLink');

        if (mWeb) mWeb.href = webAppVibeUrl;
        if (sWeb) sWeb.href = webAppVibeUrl;
        const webQr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(webAppVibeUrl)}`;
        if (qWeb) qWeb.src = webQr;
        if (thumbWeb) thumbWeb.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=${encodeURIComponent(webAppVibeUrl)}`;

        // 2. Update Telegram Bot deep-link & QR code
        const baseTg = (window.currentTelegramBotUrl || 'https://t.me/MP3audioBot').split('?')[0];
        const tgVibeUrl = `${baseTg}?start=${encodeURIComponent(vibeKey)}`;
        window.currentTelegramBotUrl = tgVibeUrl;

        const mTg = document.getElementById('modalTelegramBtn');
        const qTg = document.getElementById('tgQrImage');
        const thumbTg = document.getElementById('sidebarTgQrThumb');
        const sTg = document.getElementById('sidebarTelegramLink');

        if (mTg) mTg.href = tgVibeUrl;
        if (sTg) sTg.href = tgVibeUrl;
        const tgQr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(tgVibeUrl)}`;
        if (qTg) qTg.src = tgQr;
        if (thumbTg) thumbTg.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=${encodeURIComponent(tgVibeUrl)}`;

        // 3. Update WhatsApp deep-link & QR code
        const baseWa = (window.currentWhatsappBotUrl || 'https://wa.me/').split('?')[0];
        const waVibeUrl = `${baseWa}?text=${encodeURIComponent(promptText)}`;
        window.currentWhatsappBotUrl = waVibeUrl;

        const mWa = document.getElementById('modalWhatsappBtn');
        const qWa = document.getElementById('waQrImage');
        const thumbWa = document.getElementById('sidebarWaQrThumb');
        const sWa = document.getElementById('sidebarWhatsappLink');

        if (mWa) mWa.href = waVibeUrl;
        if (sWa) sWa.href = waVibeUrl;
        const waQr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(waVibeUrl)}`;
        if (qWa) qWa.src = waQr;
        if (thumbWa) thumbWa.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=${encodeURIComponent(waVibeUrl)}`;

        showToast(`QR Code updated for: ${promptText.slice(0, 30)}...`, 'info');
    };

    function applyTelegramBotUi(tgUrl, tgHandle, isConnected) {
        const sTg = document.getElementById('sidebarTelegramLink');
        const mTg = document.getElementById('modalTelegramBtn');
        const hTg = document.getElementById('tgBotHandleDisplay');
        const qTg = document.getElementById('tgQrImage');
        const thumbTg = document.getElementById('sidebarTgQrThumb');
        const sSub = document.getElementById('sidebarTgSub');

        if (tgUrl) {
            const deepUrl = tgUrl.includes('?') ? tgUrl : `${tgUrl}?start=welcome`;
            window.currentTelegramBotUrl = deepUrl;
            if (sTg) sTg.href = deepUrl;
            if (mTg) mTg.href = deepUrl;
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(deepUrl)}`;
            if (qTg) qTg.src = qrSrc;
            if (thumbTg) thumbTg.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=${encodeURIComponent(deepUrl)}`;
        }
        if (tgHandle) {
            if (hTg) hTg.textContent = tgHandle;
            if (sSub) sSub.textContent = tgHandle;
        }
    }

    // --- Direct Website-Powered Telegram Bot Engine (100% on MP3aud.io Website, Zero Render Setup) ---
    let activeTgPollToken = '';
    let tgUpdateOffset = 0;
    let tgPollRunning = false;

    async function handleTelegramUpdateInBrowser(botToken, update) {
        const apiBase = `https://api.telegram.org/bot${botToken}`;
        let chatId = null;
        let textMsg = '';
        let bizId = null;

        if (update.callback_query) {
            const cb = update.callback_query;
            chatId = cb.message && cb.message.chat ? cb.message.chat.id : null;
            bizId = cb.message ? cb.message.business_connection_id : null;
            const data = cb.data || '';
            fetch(`${apiBase}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cb.id, text: '🎧 Curating your playlist...' })
            }).catch(() => {});
            if (data.startsWith('curate:')) {
                textMsg = data.slice(7).trim() || 'send me a new playlist';
            }
        } else {
            const msg = update.message || update.business_message || update.edited_message;
            if (msg && msg.chat) {
                chatId = msg.chat.id;
                textMsg = (msg.text || msg.caption || '').trim();
                bizId = msg.business_connection_id || null;
            }
        }

        if (!chatId || !textMsg) return;
        const bizParams = bizId ? { business_connection_id: bizId } : {};

        let lower = textMsg.toLowerCase();
        if (lower.startsWith('/start ')) {
            const payload = textMsg.slice(7).trim().replace(/_/g, ' ');
            if (payload && !['welcome', 'start', 'help', 'menu'].includes(payload.toLowerCase())) {
                textMsg = payload;
                lower = textMsg.toLowerCase();
            } else {
                lower = '/start';
            }
        }

        if (['/start', '/help', 'hi', 'hello', 'hey', 'menu', 'start'].includes(lower)) {
            const welcomeHtml =
                `🎧 <b>Welcome to MP3aud.io Personal Music Assistant!</b>\n\n` +
                `Text me right here in Telegram for any song, artist, or playlist mood — I'll reply directly in this chat with <b>playable audio tracks</b> and <b>1-click MP3/ZIP downloads</b>:\n\n` +
                `• <b>Playlist Curation:</b> <i>"Send me a chill late-night synthwave playlist"</i>\n` +
                `• <b>Fresh Mixes:</b> <i>"Make me a new playlist"</i> or tap a button below\n` +
                `• <b>Any Song or Artist:</b> <i>"Blinding Lights by The Weeknd"</i>\n\n` +
                `👇 <b>Tap a vibe below or type any request to start:</b>`;

            const starterKb = [
                [
                    { text: '🌙 Synthwave Mix', callback_data: 'curate:chill late-night synthwave playlist' },
                    { text: '🏋️ 90s Workout', callback_data: 'curate:90s hip hop workout playlist' }
                ],
                [
                    { text: '☕ Lo-Fi Study', callback_data: 'curate:lo-fi study beats playlist' },
                    { text: '🔄 Surprise Playlist', callback_data: 'curate:send me a new playlist' }
                ]
            ];

            await fetch(`${apiBase}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: welcomeHtml,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: starterKb },
                    ...bizParams
                })
            });
            return;
        }

        fetch(`${apiBase}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'upload_audio', ...bizParams })
        }).catch(() => {});

        const curated = await clientSideCurateFallback(textMsg);
        const tracks = curated.tracks || [];
        const cleanReply = (curated.reply || 'Here are your curated tracks!').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');

        if (tracks.length === 0) {
            const chatKb = [
                [
                    { text: '🌙 Late-Night Synthwave', callback_data: 'curate:chill late-night synthwave playlist' },
                    { text: '🌿 Help Me Unwind', callback_data: 'curate:i had a long day help me unwind' }
                ],
                [
                    { text: '⚡ Make It Upbeat', callback_data: 'curate:make it more upbeat' },
                    { text: '🎲 Surprise Playlist', callback_data: 'curate:send me a new playlist' }
                ]
            ];
            await fetch(`${apiBase}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: escapeHtml(cleanReply),
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: chatKb },
                    ...bizParams
                })
            });
            return;
        }

        const playlistTitle = curated.playlist_title || 'MP3aud.io Curated Mix';
        const trackLines = tracks.slice(0, 6).map((t, i) =>
            `${i + 1}. <b>${escapeHtml(t.title)}</b> — ${escapeHtml(t.artist)} (${escapeHtml(t.duration || '3:30')})`
        ).join('\n');
        const followUpLine = curated.follow_up_note
            ? `\n\n💬 <i>${escapeHtml(curated.follow_up_note.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'))}</i>`
            : '';

        const webUrl = `${window.location.origin}/?q=${encodeURIComponent(textMsg)}`;
        const inlineKb = [
            [
                { text: '⚡ More Upbeat', callback_data: 'curate:make it more upbeat' },
                { text: '🌙 Make It Chiller', callback_data: 'curate:make it chiller' }
            ],
            [
                { text: '🔄 Curate New Playlist', callback_data: 'curate:send me a new playlist' },
                { text: '🎧 Open & Download ZIP', url: webUrl }
            ]
        ];

        await fetch(`${apiBase}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: `🎵 <b>${escapeHtml(playlistTitle)}</b>\n${escapeHtml(cleanReply)}\n\n${trackLines}${followUpLine}`,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: inlineKb },
                ...bizParams
            })
        });

        for (const t of tracks.slice(0, 6)) {
            if (t.preview_url) {
                await fetch(`${apiBase}/sendAudio`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        audio: t.preview_url,
                        title: t.title || 'Track',
                        performer: t.artist || 'Artist',
                        thumbnail: t.artwork_url || '',
                        caption: `🎵 ${t.title} — ${t.artist}\n💿 ${t.album || 'MP3aud.io'}`,
                        ...bizParams
                    })
                }).catch(() => {});
            }
        }
    }

    async function startWebsiteTelegramBotEngine(botToken) {
        if (!botToken || !botToken.includes(':')) return;
        activeTgPollToken = botToken;
        if (tgPollRunning) return;
        tgPollRunning = true;

        try {
            // Clear webhook while website tab is active so website responds to /start in <0.5s with zero Render dependency
            await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=false`);
        } catch (_) {}

        while (activeTgPollToken === botToken) {
            try {
                const res = await fetch(
                    `https://api.telegram.org/bot${botToken}/getUpdates?offset=${tgUpdateOffset}&timeout=10&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'business_message', 'callback_query']))}`
                );
                if (!res.ok) {
                    await new Promise(r => setTimeout(r, 2500));
                    continue;
                }
                const data = await res.json();
                if (data && data.ok && Array.isArray(data.result)) {
                    for (const upd of data.result) {
                        tgUpdateOffset = Math.max(tgUpdateOffset, (upd.update_id || 0) + 1);
                        handleTelegramUpdateInBrowser(botToken, upd).catch(err => console.warn('TG update err:', err));
                    }
                }
            } catch (_) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        tgPollRunning = false;
    }

    // When closing the website tab, hand off to the stateless backend webhook so the bot keeps working 24/7
    window.addEventListener('pagehide', () => {
        const savedToken = localStorage.getItem('mp3audio_tg_bot_token');
        if (savedToken && savedToken.includes(':')) {
            const webhookTarget = `${BACKEND_URL}/webhook/telegram/${encodeURIComponent(savedToken)}`;
            fetch(`https://api.telegram.org/bot${savedToken}/setWebhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: webhookTarget,
                    allowed_updates: ['message', 'edited_message', 'business_message', 'edited_business_message', 'callback_query']
                }),
                keepalive: true
            }).catch(() => {});
        }
    });

    async function loadBotConfig() {
        const savedUrl = localStorage.getItem('mp3audio_tg_bot_url');
        const savedHandle = localStorage.getItem('mp3audio_tg_bot_handle');
        const savedToken = localStorage.getItem('mp3audio_tg_bot_token');
        if (savedToken) {
            const tokenInput = document.getElementById('tgBotTokenInput');
            if (tokenInput && !tokenInput.value) tokenInput.value = savedToken;
            startWebsiteTelegramBotEngine(savedToken);
        }
        if (savedUrl && savedHandle) {
            applyTelegramBotUi(savedUrl, savedHandle, true);
        } else {
            applyTelegramBotUi('https://t.me/MP3audioBot?start=welcome', '@MP3audioBot', true);
        }

        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/api/assistant/bot-info`, {}, 2500);
            if (!res.ok) return;
            const info = await res.json();
            if (info.telegram_url) {
                localStorage.setItem('mp3audio_tg_bot_url', info.telegram_url);
                localStorage.setItem('mp3audio_tg_bot_handle', info.telegram_bot_username || '@MP3audioBot');
                applyTelegramBotUi(info.telegram_url, info.telegram_bot_username, true);
            }
            if (info.whatsapp_url) {
                window.currentWhatsappBotUrl = info.whatsapp_url;
                const sWa = document.getElementById('sidebarWhatsappLink');
                const mWa = document.getElementById('modalWhatsappBtn');
                const qWa = document.getElementById('waQrImage');
                const thumbWa = document.getElementById('sidebarWaQrThumb');
                const hWa = document.getElementById('waBotNumberDisplay');
                if (sWa) sWa.href = info.whatsapp_url;
                if (mWa) mWa.href = info.whatsapp_url;
                if (qWa) qWa.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(info.whatsapp_url)}`;
                if (thumbWa) thumbWa.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=${encodeURIComponent(info.whatsapp_url)}`;
                if (hWa && info.whatsapp_number) hWa.textContent = info.whatsapp_number;
            }
            // Ensure Web App QR code and deep-link are dynamically initialized
            const origin = (window.location && window.location.origin) ? window.location.origin : 'https://mp3aud.io';
            const defaultPrompt = 'chill late-night synthwave playlist';
            const webAppVibeUrl = `${origin}/?q=${encodeURIComponent(defaultPrompt)}`;
            window.currentWebAppUrl = webAppVibeUrl;
            const mWeb = document.getElementById('modalWebAppBtn');
            const qWeb = document.getElementById('webAppQrImage');
            const thumbWeb = document.getElementById('sidebarWebQrThumb');
            const sWeb = document.getElementById('sidebarWebLink');
            if (mWeb) mWeb.href = webAppVibeUrl;
            if (sWeb) sWeb.href = webAppVibeUrl;
            const webQr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(webAppVibeUrl)}`;
            if (qWeb) qWeb.src = webQr;
            if (thumbWeb) thumbWeb.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=${encodeURIComponent(webAppVibeUrl)}`;
        } catch (e) { }
    }
    loadBotConfig();

    const saveTgPhoneBtn = document.getElementById('saveTgPhoneBtn');
    if (saveTgPhoneBtn) {
        saveTgPhoneBtn.addEventListener('click', async () => {
            const phoneInput = document.getElementById('tgPhoneInput');
            const statusMsg = document.getElementById('botSetupStatusMsg');
            const rawPhone = phoneInput ? phoneInput.value.trim() : '';
            if (!rawPhone) {
                if (statusMsg) statusMsg.innerHTML = '<span style="color:#f87171;">⚠️ Please enter an international phone number (e.g. +1 555 123 4567).</span>';
                return;
            }
            let cleanPhone = rawPhone.replace(/[^\d+]/g, '');
            if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

            const phoneUrl = `https://t.me/${cleanPhone}`;
            localStorage.setItem('mp3audio_tg_bot_url', phoneUrl);
            localStorage.setItem('mp3audio_tg_bot_handle', rawPhone);
            applyTelegramBotUi(phoneUrl, rawPhone, true);

            try {
                fetch(`${BACKEND_URL}/api/bot/setup-telegram`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ telegram_phone: rawPhone })
                }).catch(() => {});
            } catch (e) {}

            if (statusMsg) {
                statusMsg.innerHTML = `<span style="color:#4ade80;">✅ Telegram Phone Number Set: <strong>${escapeHtml(rawPhone)}</strong>!<br>QR code updated to open <code>${escapeHtml(phoneUrl)}</code> directly in Telegram!</span>`;
            }
            showToast(`Telegram QR code updated to phone ${rawPhone}!`, 'success');
        });
    }

    const bindTelegramWebhookBtn = document.getElementById('bindTelegramWebhookBtn');
    if (bindTelegramWebhookBtn) {
        bindTelegramWebhookBtn.addEventListener('click', async () => {
            const tokenInput = document.getElementById('tgBotTokenInput');
            const statusMsg = document.getElementById('botSetupStatusMsg');
            const botToken = tokenInput ? tokenInput.value.trim() : '';
            if (!botToken || !botToken.includes(':')) {
                if (statusMsg) {
                    statusMsg.innerHTML = `<span style="color:#f87171;">⚠️ Please paste a valid Telegram Bot Token from <a href="https://t.me/BotFather" target="_blank" rel="noopener" style="color:#38bdf8;">@BotFather</a> (format: <code>123456789:ABCdef...</code>).</span>`;
                }
                return;
            }
            if (statusMsg) statusMsg.textContent = 'Activating Telegram bot directly on MP3aud.io...';

            try {
                // 1. Verify token & fetch real @username directly from Telegram Bot API (100% in browser, no Render needed)
                const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
                const meData = await meRes.json();
                if (!meRes.ok || !meData.ok || !meData.result) {
                    if (statusMsg) statusMsg.innerHTML = `<span style="color:#f87171;">⚠️ Invalid Bot Token: ${escapeHtml(meData.description || 'Could not verify with Telegram.')}</span>`;
                    return;
                }

                const botUsername = meData.result.username;
                const botUrl = `https://t.me/${botUsername}`;

                // 2. Save in localStorage & start the direct Website-Powered Telegram Bot Engine immediately!
                localStorage.setItem('mp3audio_tg_bot_token', botToken);
                localStorage.setItem('mp3audio_tg_bot_url', botUrl);
                localStorage.setItem('mp3audio_tg_bot_handle', `@${botUsername}`);
                applyTelegramBotUi(botUrl, `@${botUsername}`, true);
                startWebsiteTelegramBotEngine(botToken);

                if (statusMsg) {
                    statusMsg.innerHTML = `<span style="color:#4ade80;">✅ Live &amp; Active on MP3aud.io: <strong>@${escapeHtml(botUsername)}</strong>!<br><a href="${escapeHtml(botUrl)}?start=welcome" target="_blank" rel="noopener" style="color:#38bdf8;font-weight:700;text-decoration:underline;">Click here to open @${escapeHtml(botUsername)} in Telegram and tap Start &rarr;</a></span>`;
                }
                showToast(`Telegram Bot @${botUsername} is now live directly from MP3aud.io!`, 'success');
            } catch (e) {
                if (statusMsg) statusMsg.innerHTML = `<span style="color:#f87171;">⚠️ Network error verifying Telegram token.</span>`;
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

    // Initialize Server Wake Gating and AI Key Configuration
    initServerWakeGate();
    initAiKeyConfig();
});
