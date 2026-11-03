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
            sendUserMessage('Send me a fresh surprise playlist');
        });
    }

    // --- Fast Non-Blocking Network Helpers (Prevents Any Playlist Request from Stalling) ---
    const itunesResultCache = new Map();
    const shownTrackKeys = new Set();
    let lastVibeKey = '';
    let rotationCursor = 0;

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
            artwork_url: artwork || 'favicon.png',
            preview_url: item.previewUrl || '',
            search_query: `ytsearch1:${artist} - ${title} official audio`
        };
    }

    function buildSeedTrackObject(seedObj, idx) {
        const title = seedObj.title || String(seedObj);
        const artist = seedObj.artist || 'Featured Artist';
        const album = seedObj.album || 'Curated Mix';
        const year = seedObj.year || '2025';
        const duration = seedObj.duration || '3:30';
        const duration_sec = seedObj.duration_sec || 210;
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
            search_query: `ytsearch1:${artist} - ${title} official audio`
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

    function detectVibeKeyFromText(lower) {
        if (/synthwave|retrowave|outrun|cyberpunk|neon/.test(lower)) return 'synthwave';
        if (/workout|gym|fitness|cardio|lift|running|run|hype/.test(lower)) return 'workout';
        if (/hip hop|hip-hop|rap|boom bap|trap|90s rap/.test(lower)) return 'hip hop';
        if (/lofi|lo-fi|study|homework|focus|coding|reading/.test(lower)) return 'lofi';
        if (/acoustic|coffeehouse|folk|unplugged|guitar/.test(lower)) return 'acoustic';
        if (/rock|metal|grunge|alternative|indie rock|guitar/.test(lower)) return 'rock';
        if (/jazz|saxophone|swing|bossa|lounge|blues/.test(lower)) return 'jazz';
        if (/r&b|rnb|soul|slow jam|neo soul/.test(lower)) return 'r&b';
        if (/edm|electronic|house|techno|club|festival|dance|rave/.test(lower)) return 'edm';
        if (/80s|90s|throwback|retro|old school|classic hits|nostalgia/.test(lower)) return 'throwback';
        if (/pop|chart|party|upbeat|feel good|happy|summer/.test(lower)) return 'pop';
        if (/chill|late night|late-night|relax|vibe|sunset|ambient/.test(lower)) return 'chill';
        return null;
    }

    async function curatePresetVibePlaylist(vibeKey, isNewOrMoreRequest = false) {
        const preset = CLIENT_VIBE_SEEDS[vibeKey] || CLIENT_VIBE_SEEDS.chill;
        lastVibeKey = vibeKey;

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
        return {
            success: true,
            reply: `Here is your **${playlistTitle}** (${tracks.length} tracks)! Tap play on any audio bubble to listen right in the chat, download individual 320kbps MP3s, or grab the full playlist ZIP.`,
            mode: 'playlist',
            playlist_title: playlistTitle,
            playlist_vibe: preset.vibe,
            tracks
        };
    }

    async function clientSideCurateFallback(messageText) {
        const lower = (messageText || '').toLowerCase().trim();
        const isRingtone = /ringtone|m4r|alarm tone|text tone/.test(lower);
        const isAskingForNewOrAnother = /\b(new|another|different|fresh|random|more|next|surprise|other|else|switch|change|again)\b/i.test(lower);

        // 1. Check if user matched a specific genre/vibe preset
        const matchedVibeKey = detectVibeKeyFromText(lower);
        if (matchedVibeKey && !isRingtone) {
            return await curatePresetVibePlaylist(matchedVibeKey, isAskingForNewOrAnother);
        }

        // 2. Clean conversational filler & "new/another/different playlist" modifiers
        let cleanQ = messageText
            .replace(/^(hey|hi|hello|yo|please|can you|could you|send me|play|find|get me|make me|create|give me|i want|i need|text me|build me|curate|generate|drop)\s+/i, '')
            .replace(/\b(a new|another|a different|a fresh|a random|new|different|fresh|random|surprise|more|next|other)\s+(playlist|mix|songs|tracks|music|vibe|list)\b/gi, ' ')
            .replace(/\b(a playlist of|a playlist for|playlist|songs by|tracks by|music by|ringtone of|ringtone for|ringtone|mp3|audio|song|track|mix)\b/gi, ' ')
            .replace(/^(a|an|some|the|me|for me|please|now)\b\s*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        const isGenericNewPlaylistRequest = !cleanQ || /^(new|another|different|fresh|random|more|next|surprise|surprise me|something new|something else|anything|music|songs|tracks|vibe|vibes|good music)$/i.test(cleanQ);

        // 3. If user asked for a generic "new playlist" / "another playlist" / "surprise me", rotate to a fresh curated vibe!
        if (isGenericNewPlaylistRequest && !isRingtone) {
            let nextKey = VIBE_KEYS_LIST[rotationCursor % VIBE_KEYS_LIST.length];
            rotationCursor++;
            if (nextKey === lastVibeKey) {
                nextKey = VIBE_KEYS_LIST[rotationCursor % VIBE_KEYS_LIST.length];
                rotationCursor++;
            }
            return await curatePresetVibePlaylist(nextKey, true);
        }

        if (!cleanQ) cleanQ = messageText.trim();

        const wantsPlaylist = /playlist|mix|songs|tracks|vibe|mood|workout|chill|study|party|top |best |new |another |more /i.test(lower);
        const limit = isRingtone ? 1 : (wantsPlaylist ? 6 : 4);

        try {
            const results = await searchItunesFast(cleanQ, limit * 3, 1800);
            const seen = new Set();
            const tracks = [];
            // Prefer tracks not yet shown if user asked for "new" / "more"
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

        // If custom search timed out and user wanted a playlist, never stall — serve a fresh rotated playlist!
        if (wantsPlaylist && !isRingtone) {
            const fallbackKey = VIBE_KEYS_LIST[rotationCursor++ % VIBE_KEYS_LIST.length];
            return await curatePresetVibePlaylist(fallbackKey, true);
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
                        <button type="button" class="btn-new-playlist-chat" title="Curate a fresh playlist">🔄 New Playlist</button>
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
        const isAskingForNew = /\b(new|another|different|fresh|random|more|next|surprise|other|else|switch|change|again)\b/i.test(text);

        try {
            let result = null;

            // Only wait up to 2.1s for backend so chat never stalls on cold starts or rate limits
            try {
                const backendCall = (async () => {
                    const resp = await fetchWithTimeout(`${BACKEND_URL}/api/assistant/chat`, {
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
                    }, 2100);
                    if (resp && resp.ok) {
                        return await resp.json();
                    }
                    return null;
                })();

                const raceTimeout = new Promise(resolve => setTimeout(() => resolve(null), 2200));
                result = await Promise.race([backendCall, raceTimeout]);
            } catch (networkErr) {
                console.info('Using instant client curation:', networkErr);
            }

            // Check if backend result is missing, empty, or returned duplicate tracks when user asked for a NEW playlist
            let shouldUseClientCuration = !result || !result.success || !Array.isArray(result.tracks) || result.tracks.length === 0;
            if (!shouldUseClientCuration && isAskingForNew) {
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
            } else if (Array.isArray(result.tracks)) {
                result.tracks.forEach(t => {
                    shownTrackKeys.add(`${(t.title || '').toLowerCase()}|${(t.artist || '').toLowerCase()}`);
                });
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
            if (typingRow && typingRow.parentNode) typingRow.remove();
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
    let isTelegramBotConnected = Boolean(localStorage.getItem('mp3audio_tg_bot_url'));

    function applyTelegramBotUi(tgUrl, tgHandle, isConnected) {
        isTelegramBotConnected = Boolean(isConnected);
        const sTg = document.getElementById('sidebarTelegramLink');
        const mTg = document.getElementById('modalTelegramBtn');
        const hTg = document.getElementById('tgBotHandleDisplay');
        const qTg = document.getElementById('tgQrImage');
        const sSub = sTg ? sTg.querySelector('.channel-pill-text span') : null;

        if (tgUrl) {
            const deepUrl = tgUrl.includes('?') ? tgUrl : `${tgUrl}?start=welcome`;
            if (sTg) sTg.href = deepUrl;
            if (mTg) mTg.href = deepUrl;
            if (qTg) qTg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(deepUrl)}`;
        }
        if (tgHandle) {
            if (hTg) hTg.textContent = tgHandle;
            if (sSub) sSub.textContent = isConnected ? tgHandle : 'Tap to Connect Bot';
        }
    }

    // Intercept clicks on Telegram buttons if no BotFather token has been linked yet
    ['sidebarTelegramLink', 'modalTelegramBtn'].forEach(btnId => {
        const el = document.getElementById(btnId);
        if (el) {
            el.addEventListener('click', (e) => {
                if (!isTelegramBotConnected) {
                    e.preventDefault();
                    if (typeof openModal === 'function') openModal('botConnectModal');
                    const detailsEl = document.querySelector('.bot-webhook-details');
                    if (detailsEl) detailsEl.open = true;
                    const tokenInput = document.getElementById('tgBotTokenInput');
                    if (tokenInput) setTimeout(() => tokenInput.focus(), 120);
                    const statusMsg = document.getElementById('botSetupStatusMsg');
                    if (statusMsg) {
                        statusMsg.innerHTML = `<span style="color:#fbbf24;">⚡ Step 1: Open <a href="https://t.me/BotFather" target="_blank" rel="noopener" style="color:#38bdf8;text-decoration:underline;">@BotFather in Telegram</a> and send <code>/newbot</code>.<br>Step 2: Paste your Bot Token above and click <strong>Activate Telegram Webhook</strong> so the <strong>Start</strong> button in Telegram connects to your assistant!</span>`;
                    }
                    showToast('Paste your free @BotFather token to activate your Telegram bot!', 'info');
                }
            });
        }
    });

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
        const playlistTitle = curated.playlist_title || 'MP3aud.io Curated Mix';
        const cleanReply = (curated.reply || 'Here are your curated tracks!').replace(/\*\*(.+?)\*\*/g, '$1');

        const trackLines = tracks.slice(0, 6).map((t, i) =>
            `${i + 1}. <b>${escapeHtml(t.title)}</b> — ${escapeHtml(t.artist)} (${escapeHtml(t.duration || '3:30')})`
        ).join('\n');

        const webUrl = `${window.location.origin}/?q=${encodeURIComponent(textMsg)}`;
        const inlineKb = [
            [
                { text: '🔄 Curate New Playlist', callback_data: 'curate:send me a new playlist' },
                { text: '🎧 Open & Download ZIP', url: webUrl }
            ],
            [
                { text: '🌙 Synthwave', callback_data: 'curate:synthwave playlist' },
                { text: '🏋️ Workout', callback_data: 'curate:workout playlist' },
                { text: '☕ Lo-Fi', callback_data: 'curate:lofi playlist' }
            ]
        ];

        await fetch(`${apiBase}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: `🎵 <b>${escapeHtml(playlistTitle)}</b>\n${escapeHtml(cleanReply)}\n\n${trackLines}`,
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
            applyTelegramBotUi('https://t.me/BotFather', 'Tap to Connect Bot', false);
        }

        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/api/assistant/bot-info`, {}, 2500);
            if (!res.ok) return;
            const info = await res.json();
            if (info.telegram_configured && info.telegram_url) {
                localStorage.setItem('mp3audio_tg_bot_url', info.telegram_url);
                localStorage.setItem('mp3audio_tg_bot_handle', info.telegram_bot_username || '@MP3audioBot');
                applyTelegramBotUi(info.telegram_url, info.telegram_bot_username, true);
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
});
