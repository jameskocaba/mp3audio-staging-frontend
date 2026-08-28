document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL DRAG PREVENT DEFAULT ---
    // This prevents the browser from accidentally opening dropped files if dropped outside the target zone
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);

    // 1. User Dashboard & Auth UI Elements
    const userDashboard = document.getElementById('userDashboard');
    const loginFormContainer = document.getElementById('loginFormContainer');
    const conversionToolContainer = document.getElementById('conversionToolContainer');
    const loginEmail = document.getElementById('loginEmail');
    const sendLinkBtn = document.getElementById('sendLinkBtn');
    const authMessage = document.getElementById('authMessage');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const paidCreditsDisplay = document.getElementById('paidCreditsDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const buyCreditsBtn = document.getElementById('buyCreditsBtn');
    const subscribeBtn = document.getElementById('subscribeBtn');
    const billingMessage = document.getElementById('billingMessage');
    const urlMessage = document.getElementById('urlMessage');
    const workspacePricingContainer = document.getElementById('workspacePricingContainer');
    const subscriptionBadge = document.getElementById('subscriptionBadge');

    // 2. Conversion Tool UI Elements
    const urlInput = document.getElementById('urlInput');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const transcribeInput = document.getElementById('transcribeAudio');
    const fileInput = document.getElementById('fileInput');
    const increaseQualityInput = document.getElementById('increaseQuality');
    const attachLyricsInput = document.getElementById('attachLyrics');
    const autoAddAlbumArtInput = document.getElementById('autoAddAlbumArt');
    const fileInputText = document.getElementById('fileInputText');
    const thumbnailContainer = document.getElementById('thumbnailContainer');
    const currentThumbnail = document.getElementById('currentThumbnail');
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const actionGroup = document.getElementById('actionGroup');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');
    const conversionSummary = document.getElementById('conversionSummary');

    // Point this to your PRODUCTION backend URL
    // Ensure this EXACTLY matches your Render PROD web service URL
    const BACKEND_URL = 'https://mp3audio-staging.onrender.com';

    // Intercept fetch calls to inject the Authorization header for cookie-blocked environments (e.g. mobile Safari)
    const originalFetch = window.fetch;
    window.fetch = function (input, init = {}) {
        let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
        if (url && url.startsWith(BACKEND_URL)) {
            if (typeof input === 'string') {
                init = init || {};
                init.headers = init.headers || {};
                const token = localStorage.getItem('session_token');
                if (token) {
                    if (init.headers instanceof Headers) {
                        if (!init.headers.has('Authorization')) {
                            init.headers.set('Authorization', `Bearer ${token}`);
                        }
                    } else {
                        if (!init.headers['Authorization']) {
                            init.headers['Authorization'] = `Bearer ${token}`;
                        }
                    }
                }
                init.credentials = 'include';
            }
        }
        return originalFetch(input, init);
    };

    let currentSessionId = null;
    let pollTimeout = null;
    let isGuestUser = true;

    // --- TOAST NOTIFICATION SYSTEM ---
    const showToast = (message, type = 'info') => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        let icon = '';
        if (type === 'success') icon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        else if (type === 'error') icon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        else icon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // --- RESTORE URL FROM SESSION STORAGE ---
    if (urlInput) {
        const savedUrl = sessionStorage.getItem('savedUrl');
        if (savedUrl) urlInput.value = savedUrl;

        urlInput.addEventListener('input', (e) => {
            sessionStorage.setItem('savedUrl', e.target.value);
        });
    }

    const urlParams = new URLSearchParams(window.location.search);

    // --- POPULATE URL FROM QUERY PARAMETER ---
    const queryUrl = urlParams.get('url');
    if (queryUrl) {
        if (urlInput) {
            urlInput.value = queryUrl;
            sessionStorage.setItem('savedUrl', queryUrl);
        }
        if (autoAddAlbumArtInput) {
            autoAddAlbumArtInput.checked = true;
        }
    }

    // --- STRIPE CHECKOUT REDIRECT HANDLER ---
    const successParam = urlParams.get('success');
    const canceledParam = urlParams.get('canceled');
    if (successParam) {
        showToast('Payment successful! Your account has been updated.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceledParam) {
        showToast('Payment was canceled.', 'info');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // --- CUSTOM FILE INPUT UI ---
    if (fileInput && fileInputText) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                // Enforce maximum file size limit instantly on selection
                const MAX_PER_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
                const oversizedFiles = Array.from(fileInput.files).filter(file => file.size > MAX_PER_FILE_SIZE);

                if (oversizedFiles.length > 0) {
                    showToast('One or more files exceed the 50MB limit per track. Please select smaller files.', 'error');
                    fileInput.value = ''; // Instantly clear the invalid selection
                    fileInputText.textContent = 'Click to select files, or drag & drop here...';
                    fileInputText.style.fontWeight = 'normal';
                    fileInputText.style.color = '#64748b';
                    return;
                }

                const fileCount = fileInput.files.length;

                // Calculate total size
                let totalBytes = 0;
                for (let i = 0; i < fileCount; i++) {
                    totalBytes += fileInput.files[i].size;
                }

                const formatSize = (bytes) => {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                };

                const sizeText = formatSize(totalBytes);

                // Check if a directory was selected by inspecting the path of the first file
                const isDirectory = fileInput.files[0].webkitRelativePath !== "";
                if (isDirectory && fileCount > 1) {
                    fileInputText.textContent = `Folder with ${fileCount} files selected (${sizeText})`;
                } else if (fileCount === 1) {
                    fileInputText.textContent = `${fileInput.files[0].name} (${sizeText})`;
                } else {
                    fileInputText.textContent = `${fileCount} files selected (${sizeText})`;
                }
                fileInputText.style.fontWeight = '600';
                fileInputText.style.color = '#1e293b';
            } else {
                // This case handles when the user opens the file dialog and cancels it.
                fileInputText.textContent = 'Click to select files, or drag & drop here...';
                fileInputText.style.fontWeight = 'normal';
                fileInputText.style.color = '#64748b';
            }
        });
    }

    // --- DRAG AND DROP ZONE LOGIC ---
    const dropZone = document.getElementById('dropZone');
    if (dropZone && fileInput && fileInputText) {
        // Add dragover and dragenter highlights
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.style.borderColor = '#2980b9';
                dropZone.style.backgroundColor = 'rgba(41, 128, 185, 0.05)';
            }, false);
        });

        // Remove highlight on leave
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.style.borderColor = '';
                dropZone.style.backgroundColor = '';
            }, false);
        });

        // Process dropped items
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const items = e.dataTransfer.items;
            const dtFiles = e.dataTransfer.files;
            if (!items && !dtFiles) return;

            fileInputText.textContent = "Scanning dropped files...";
            const files = [];
            const queue = [];

            // Valid audio and video extensions/mime types to accept
            const isValidMedia = (file) => {
                if (!file || !file.name) return false;
                if (file.name.startsWith('._')) return false; // Ignore macOS metadata files
                if (file.type && typeof file.type === 'string' && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) return true;
                // Fallback for files without a recognized mime type
                const ext = file.name.split('.').pop().toLowerCase();
                const validExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'm4b', 'm4r', 'm4v', 'wma', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'ts', 'aiff', 'alac'];
                return validExts.includes(ext);
            };

            // Helper to recursively read files and folders
            const readEntry = (entry) => {
                return new Promise((resolve, reject) => {
                    if (entry.isFile) {
                        entry.file(f => {
                            if (isValidMedia(f)) files.push(f);
                            resolve();
                        }, err => reject(err));
                    } else if (entry.isDirectory) {
                        const reader = entry.createReader();
                        reader.readEntries(async (entries) => {
                            const promises = entries.map(e => readEntry(e).catch(() => { }));
                            await Promise.all(promises);
                            resolve();
                        }, err => reject(err));
                    } else {
                        resolve();
                    }
                });
            };

            if (items && items.length > 0) {
                // Scan all dropped items
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];

                    if (item.kind === 'file') {
                        if (typeof item.webkitGetAsEntry === 'function') {
                            const entry = item.webkitGetAsEntry();
                            if (entry) {
                                queue.push(readEntry(entry).catch(() => {
                                    const f = item.getAsFile();
                                    if (f && isValidMedia(f)) files.push(f);
                                }));
                                continue;
                            }
                        }
                        const f = item.getAsFile();
                        if (f && isValidMedia(f)) files.push(f);
                    }
                }
                await Promise.all(queue);
            } else if (dtFiles && dtFiles.length > 0) {
                for (let i = 0; i < dtFiles.length; i++) {
                    if (isValidMedia(dtFiles[i])) files.push(dtFiles[i]);
                }
            }

            if (files.length > 0) {
                // Create a new DataTransfer to populate our file input programmatically
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                fileInput.files = dt.files;

                // Trigger change event to update UI
                fileInput.dispatchEvent(new Event('change'));
            } else {
                fileInputText.textContent = 'Click to select files, or drag & drop here...';
                showToast('No valid audio or video files found in the dropped items.', 'error');
            }
        });
    }

    // --- AUTHENTICATION LOGIC ---
    const checkAuth = async () => {
        if (conversionToolContainer) conversionToolContainer.classList.remove('hidden');
        try {
            const response = await fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' });
            const data = await response.json();

            if (data.token) {
                localStorage.setItem('session_token', data.token);
            }

            if (paidCreditsDisplay) paidCreditsDisplay.textContent = data.paid_track_credits;

            if (data.authenticated) {
                isGuestUser = false;
                // User is logged in/paid
                if (userDashboard) userDashboard.classList.remove('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = data.email;
                if (logoutBtn) logoutBtn.classList.remove('hidden');

                if (subscriptionBadge) subscriptionBadge.classList.add('hidden');
                if (workspacePricingContainer) workspacePricingContainer.classList.remove('hidden');
                if (buyCreditsBtn) buyCreditsBtn.classList.remove('hidden');
                if (loginFormContainer) loginFormContainer.classList.add('hidden');
            } else {
                isGuestUser = true;
                // User is a guest
                if (userDashboard) userDashboard.classList.add('hidden');
                if (workspacePricingContainer) workspacePricingContainer.classList.add('hidden');
                if (loginFormContainer) loginFormContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Auth Check Failed', error);
            // Fallback for offline mode/guests
            if (userDashboard) userDashboard.classList.add('hidden');
            if (workspacePricingContainer) workspacePricingContainer.classList.add('hidden');
            if (loginFormContainer) loginFormContainer.classList.remove('hidden');
        }
    };

    // --- MAGIC LINK VERIFICATION ---
    const token = urlParams.get('token');

    if (token) {
        if (urlMessage) {
            urlMessage.innerHTML = `<div class="alert-message" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe;">Verifying secure link...</div>`;
            urlMessage.classList.remove('hidden');
        }
        window.history.replaceState({}, document.title, window.location.pathname);

        fetch(`${BACKEND_URL}/auth/verify`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (urlMessage) {
                        urlMessage.classList.add('hidden');
                    }
                    if (data.token) {
                        localStorage.setItem('session_token', data.token);
                    }
                    showToast('Login successful! Welcome back.', 'success');
                    checkAuth();
                } else {
                    showToast(data.error || 'Invalid link.', 'error');
                    checkAuth();
                }
            })
            .catch(err => {
                showToast('Network error. Please try logging in again.', 'error');
                checkAuth();
            });
    } else {
        checkAuth();
    }

    if (sendLinkBtn) {
        sendLinkBtn.addEventListener('click', async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            const email = loginEmail.value.trim();
            if (!email) return;

            sendLinkBtn.disabled = true;
            sendLinkBtn.textContent = 'Sending...';
            if (authMessage) {
                authMessage.style.color = '#475569';
                authMessage.textContent = 'Connecting to secure server...';
            }

            try {
                // Check if server is active with a quick ping
                let isServerActive = false;
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s quick check
                    const res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        isServerActive = true;
                    }
                } catch (e) {
                    console.log("Server is inactive, initiating wake-up...");
                }

                if (!isServerActive) {
                    // Trigger Render wake-up by sending a single non-blocking ping
                    fetch(`${BACKEND_URL}/health`).catch(() => {});
                    
                    // Wait exactly 60 seconds for the server to spin up and database to initialize
                    const delaySeconds = 60;
                    for (let elapsed = 0; elapsed <= delaySeconds; elapsed++) {
                        if (authMessage) {
                            authMessage.textContent = `Spinning up server, please wait (may take up to 60s) (${elapsed}s)...`;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                if (authMessage) {
                    authMessage.textContent = 'Requesting secure link...';
                }

                console.log("Attempting to send magic link to:", `${BACKEND_URL}/auth/login`);
                const response = await fetch(`${BACKEND_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                console.log("Backend Response Status:", response.status);

                if (response.ok) {
                    if (authMessage) {
                        authMessage.textContent = '';
                    }
                    showToast('Link sent! Check your email inbox.', 'success');
                    sendLinkBtn.disabled = false;
                    sendLinkBtn.textContent = 'Send Link';
                } else {
                    if (authMessage) {
                        authMessage.textContent = '';
                    }
                    const errorData = await response.json().catch(() => ({}));
                    console.error("Backend Error Data:", errorData);
                    showToast(errorData.error || 'Failed to send link.', 'error');
                    sendLinkBtn.disabled = false;
                    sendLinkBtn.textContent = 'Send Link';
                }
            } catch (error) {
                console.error("Fetch/Network Error:", error);
                if (authMessage) {
                    authMessage.textContent = '';
                }
                showToast('Network error or server unavailable. Try again.', 'error');
                sendLinkBtn.disabled = false;
                sendLinkBtn.textContent = 'Send Link';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            localStorage.removeItem('session_token');
            await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
            window.location.reload();
        });
    }

    if (buyCreditsBtn) {
        buyCreditsBtn.addEventListener('click', async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            buyCreditsBtn.disabled = true;
            buyCreditsBtn.textContent = 'Processing...';
            try {
                const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'credits' }),
                    credentials: 'include'
                });
                const data = await response.json();
                if (response.ok && data.url) window.location.href = data.url;
                else {
                    showToast(data.error || 'Checkout error. Please try again later.', 'error');
                    buyCreditsBtn.disabled = false;
                    buyCreditsBtn.textContent = 'Buy Credits';
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
                buyCreditsBtn.disabled = false;
                buyCreditsBtn.textContent = 'Buy Credits';
            }
        });
    }

    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            subscribeBtn.disabled = true;
            subscribeBtn.textContent = 'Processing...';
            try {
                const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'subscription' }),
                    credentials: 'include'
                });
                const data = await response.json();
                if (response.ok && data.url) window.location.href = data.url;
                else {
                    showToast(data.error || 'Checkout error. Please try again later.', 'error');
                    subscribeBtn.disabled = false;
                    subscribeBtn.textContent = 'Subscribe Now';
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
                subscribeBtn.disabled = false;
                subscribeBtn.textContent = 'Subscribe Now';
            }
        });
    }

    // --- CONVERSION TOOL LOGIC ---
    const resetUI = () => {
        if (convertBtn) {
            convertBtn.disabled = false;
            convertBtn.textContent = "Process";
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = "Cancel";
        }
        if (actionGroup) actionGroup.style.display = 'none';
        if (resetBtn) resetBtn.disabled = false;
        if (pollTimeout) {
            clearTimeout(pollTimeout);
            pollTimeout = null;
        }
    };

    const fullReset = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (urlInput) {
            urlInput.value = '';
            sessionStorage.removeItem('savedUrl');
        }
        if (startTimeInput) startTimeInput.value = '';
        if (endTimeInput) endTimeInput.value = '';
        if (transcribeInput) transcribeInput.checked = false;
        if (fileInput) fileInput.value = '';
        if (increaseQualityInput) increaseQualityInput.checked = false;
        if (attachLyricsInput) attachLyricsInput.checked = false;
        if (autoAddAlbumArtInput) autoAddAlbumArtInput.checked = true;
        if (fileInputText) {
            fileInputText.textContent = 'Click to select files, or drag & drop here...';
            fileInputText.style.fontWeight = 'normal';
            fileInputText.style.color = '#64748b';
        }
        if (statusDiv) statusDiv.innerHTML = "Ready";
        if (conversionSummary) conversionSummary.innerHTML = '';
        if (downloadList) downloadList.innerHTML = '';
        if (downloadArea) downloadArea.classList.add('hidden');
        if (thumbnailContainer) thumbnailContainer.classList.add('hidden');
        if (currentThumbnail) currentThumbnail.src = '';
        if (progressBar) progressBar.classList.add('hidden');
        resetUI();
    };

    const updateProgress = (current, total, subProgress = 0) => {
        if (!progressFill) return;
        const overallProgress = current + (subProgress / 100);
        const percent = total > 0 ? Math.min(Math.round((overallProgress / total) * 100), 100) : 0;
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${percent}%`;
    };

    const generateSummaryTable = (failedDetails, titleColor = "#1e293b") => {
        if (!failedDetails || failedDetails.length === 0) return '';
        let tableRows = failedDetails.map(f => `
            <tr>
                <td>${f.track}</td>
                <td>${f.reason}</td>
            </tr>
        `).join('');

        return `
            <div class="summary-container">
                <h3 class="summary-title" style="color: ${titleColor};">Failure Breakdown</h3>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Skipped Track</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    };

    const pollStatus = async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Status check failed');
            const data = await response.json();

            if (!statusDiv) return;

            if (data.status === 'queued') {
                if (progressBar) progressBar.classList.add('hidden');

                // If they are first in line, the worker is just waking up. Show a loading state instead of the queue block.
                if (data.queue_position <= 1) {
                    statusDiv.innerHTML = `
                        <div class="spinner"></div>
                        <p style="margin:0; font-weight:bold; font-size:1.05rem;">Starting process...</p>
                        <p style="margin:5px 0 0 0; font-size:0.85rem; color:#64748b;">Waking up the processor</p>
                    `;
                } else {
                    const waitText = data.estimated_wait <= 1 ? "< 1 min" : `~${data.estimated_wait} mins`;
                    statusDiv.innerHTML = `
                        <div class="queue-box">
                            <div class="spinner queue-spinner"></div>
                            <p style="margin:0 0 5px 0; font-weight:bold;">Waiting in Queue</p>
                            <p style="margin:0; font-size:0.85rem;">Position: ${data.queue_position} | Est. Wait: ${waitText}</p>
                        </div>
                    `;
                }
            }
            else if (data.status === 'processing') {
                if (progressBar) progressBar.classList.remove('hidden');

                if (data.current_thumbnail && currentThumbnail && thumbnailContainer) {
                    currentThumbnail.src = data.current_thumbnail;
                    thumbnailContainer.classList.remove('hidden');
                } else if (thumbnailContainer) {
                    thumbnailContainer.classList.add('hidden');
                }

                updateProgress(data.completed, data.total, data.sub_progress);

                const currentTrackDisplay = Math.min(data.completed + 1, data.total);

                statusDiv.innerHTML = `
                    <div class="spinner"></div>
                    <p style="margin:0; font-weight:bold; font-size:1.05rem;">Processing Track ${currentTrackDisplay} of ${data.total}</p>
                    <p style="margin:5px 0 0 0; font-size:0.85rem; color:#64748b;">${data.current_status || 'Working on your files'}</p>
                `;
            }
            else if (data.status === 'completed') {
                resetUI();
                if (progressBar) progressBar.classList.remove('hidden');
                updateProgress(data.total, data.total, 100);

                if (data.completed > 0) {
                    statusDiv.innerHTML = `<p style="color: #2ecc71; font-weight: bold; font-size: 1.1rem;">✅ Success! Processed ${data.completed} of ${data.total} tracks.</p>`;
                    showToast(`Success! Processed ${data.completed} of ${data.total} tracks.`, 'success');
                } else {
                    statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold; font-size: 1.1rem;">⚠️ Process Finished: 0 tracks processed.</p>`;
                    showToast(`No tracks could be processed.`, 'error');
                }

                if (downloadArea && downloadList) {
                    downloadArea.classList.remove('hidden');

                    if (conversionSummary) {
                        conversionSummary.innerHTML = generateSummaryTable(data.failed_details, data.completed > 0 ? "#1e293b" : "#ef4444");
                    }

                    if (data.completed > 0) {
                        downloadList.innerHTML = `
                            <li>
                                <a href="${BACKEND_URL}${data.zip_path}" class="zip-btn" target="_blank">
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Download ZIP Archive
                                </a>
                            </li>
                        `;
                    } else {
                        downloadList.innerHTML = '';
                    }
                }
                currentSessionId = null;
                checkAuth();
            }
            else if (data.status === 'error' || data.status === 'cancelled') {
                resetUI();
                const msg = data.status === 'error' ? (data.error || 'An error occurred during processing.') : 'Process Cancelled.';
                statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold; font-size: 1.1rem;">❌ Action Failed</p>`;
                if (data.status === 'error') showToast(msg, 'error');

                if (data.status === 'error' && data.failed_details && data.failed_details.length > 0) {
                    if (downloadArea) downloadArea.classList.remove('hidden');
                    if (downloadList) downloadList.innerHTML = '';
                    if (conversionSummary) {
                        conversionSummary.innerHTML = generateSummaryTable(data.failed_details, "#ef4444");
                    }
                }

                currentSessionId = null;
                checkAuth();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }

        // Schedule the next poll only AFTER the previous one has completed
        if (currentSessionId) {
            pollTimeout = setTimeout(pollStatus, 2000);
        }
    };

    const startConversion = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            if (!statusDiv) return;

            const hasFiles = fileInput && fileInput.files.length > 0;
            const url = urlInput ? urlInput.value.trim() : '';

            if (!hasFiles && !url) {
                showToast('Please select files to upload or enter a URL.', 'error');
                return;
            }

            if (convertBtn) {
                convertBtn.disabled = true;
                convertBtn.textContent = "Processing...";
            }
            if (resetBtn) resetBtn.disabled = true;
            if (actionGroup) actionGroup.style.display = 'flex';
            if (cancelBtn) cancelBtn.classList.remove('hidden');

            statusDiv.innerHTML = `<div class="spinner"></div><p style="font-weight:bold; color:#2980b9;">Spinning up server...</p><p style="font-size:0.85rem; color:#64748b;">(This may take up to 50 seconds if the server is asleep)</p>`;
            showToast('Spinning up server. This may take up to 50 seconds...', 'info');

            // Ping the backend to wake it up before sending a potentially large payload
            try {
                await fetch(`${BACKEND_URL}/health`);
            } catch (err) {
                console.warn("Pre-flight wake up ping failed or timed out, continuing anyway...", err);
            }

            if (hasFiles) {
                statusDiv.innerHTML = `<div class="spinner"></div><p style="font-weight:bold; color:#2980b9;">Uploading files to server...</p><p style="font-size:0.85rem; color:#64748b;">(Please keep this tab open during upload)</p>`;
            } else {
                statusDiv.innerHTML = `<div class="spinner"></div><p style="font-weight:bold; color:#2980b9;">Analyzing link...</p><p style="font-size:0.85rem; color:#64748b;">(Playlists can take 10-15 seconds to fetch from SoundCloud)</p>`;
            }

            if (downloadArea) downloadArea.classList.add('hidden');
            if (conversionSummary) conversionSummary.innerHTML = '';
            if (thumbnailContainer) thumbnailContainer.classList.add('hidden');
            if (progressBar) progressBar.classList.remove('hidden');
            if (progressFill) {
                progressFill.style.width = '0%';
                progressFill.textContent = 'Initializing...';
            }

            let response;

            if (hasFiles) {
                // Enforce a maximum file size limit of 50MB per file
                const MAX_PER_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
                const oversizedFiles = Array.from(fileInput.files).filter(file => file.size > MAX_PER_FILE_SIZE);

                if (oversizedFiles.length > 0) {
                    showToast('One or more files exceed the 50MB limit per track. Please remove them and try again.', 'error');
                    resetUI();
                    statusDiv.innerHTML = `Ready`;
                    return;
                }

                const formData = new FormData();
                for (let i = 0; i < fileInput.files.length; i++) {
                    formData.append('files', fileInput.files[i]);
                }
                if (increaseQualityInput && increaseQualityInput.checked) formData.append('increase_quality', 'true');
                if (attachLyricsInput && attachLyricsInput.checked) formData.append('attach_lyrics', 'true');
                if (autoAddAlbumArtInput && autoAddAlbumArtInput.checked) formData.append('auto_add_album_art', 'true');

                response = await fetch(`${BACKEND_URL}/process_local_files`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
            } else {
                const startTime = startTimeInput ? startTimeInput.value.trim() : '';
                const endTime = endTimeInput ? endTimeInput.value.trim() : '';
                const transcribeAudio = transcribeInput ? transcribeInput.checked : false;

                response = await fetch(`${BACKEND_URL}/start_conversion`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        start_time: startTime,
                        end_time: endTime,
                        transcribe_audio: transcribeAudio,
                        auto_add_album_art: autoAddAlbumArtInput ? autoAddAlbumArtInput.checked : false
                    })
                });
            }

            const data = await response.json();

            if (response.status === 403) {
                // UI Limit Warning Handler
                statusDiv.innerHTML = `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #f59e0b; padding: 15px; border-radius: 8px; text-align: left; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                        <p style="color: #1e293b; font-weight: bold; margin-top: 0; margin-bottom: 8px;">⚠️ Limit Reached</p>
                        <p style="font-size: 0.9rem; color: #475569; margin: 0; line-height: 1.4;">${data.error || 'Processing Blocked: You have reached the limit for this request.'}</p>
                    </div>
                `;

                if (loginFormContainer) loginFormContainer.classList.remove('hidden');
                if (loginEmail) loginEmail.focus();

                resetUI();
                checkAuth();
                showToast('Limit Reached. Please sign in.', 'error');
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start processing');
            }

            currentSessionId = data.session_id;
            pollStatus(); // Triggers the first check, which then schedules the rest

        } catch (error) {
            console.error(error);
            resetUI();
            statusDiv.innerHTML = `Ready`;

            let errorMsg = error.message;
            if (errorMsg.toLowerCase().includes('failed to fetch')) {
                errorMsg = "Network Error: Cannot reach the backend. Check your BACKEND_URL or CORS settings.";
            }
            showToast(errorMsg, 'error');
        }
    };

    const cancelConversion = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!currentSessionId) return;
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.textContent = "Cancelling...";
        }

        try {
            await fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId })
            });
            showToast('Processing cancelled.', 'info');
        } catch (error) {
            console.error('Failed to cancel:', error);
            resetUI();
        }
    };

    if (convertBtn) convertBtn.addEventListener('click', startConversion);
    if (cancelBtn) cancelBtn.addEventListener('click', cancelConversion);
    if (resetBtn) resetBtn.addEventListener('click', fullReset);

    // --- PREVENT ACCIDENTAL TAB CLOSURE FOR GUESTS ---
    window.addEventListener('beforeunload', (e) => {
        if (currentSessionId && isGuestUser) {
            e.preventDefault();
            e.returnValue = ''; // Required by modern browsers to trigger the warning popup
        }
    });

    // --- MOBILE HEADER NAV DRAWER TOGGLE ---
    const menuToggle = document.querySelector('.menu-toggle');
    const headerNav = document.querySelector('.header-nav');
    if (menuToggle && headerNav) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            headerNav.classList.toggle('open');
        });

        // Close nav if user clicks outside of it on mobile
        document.addEventListener('click', (e) => {
            if (headerNav.classList.contains('open') && !headerNav.contains(e.target) && e.target !== menuToggle) {
                headerNav.classList.remove('open');
            }
        });
    }

    // --- FAQ ACCORDION TOGGLE LOGIC ---
    const faqTriggers = document.querySelectorAll('.faq-trigger');
    faqTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const faqItem = trigger.parentElement;
            const panel = faqItem.querySelector('.faq-panel');
            const isActive = faqItem.classList.contains('active');

            // Close all other panels for accordion effect
            document.querySelectorAll('.faq-item').forEach(item => {
                if (item !== faqItem) {
                    item.classList.remove('active');
                    const otherPanel = item.querySelector('.faq-panel');
                    if (otherPanel) otherPanel.style.maxHeight = null;
                    const otherTrigger = item.querySelector('.faq-trigger');
                    if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
                }
            });

            // Toggle active state
            faqItem.classList.toggle('active');

            if (isActive) {
                panel.style.maxHeight = null;
                trigger.setAttribute('aria-expanded', 'false');
            } else {
                panel.style.maxHeight = panel.scrollHeight + 'px';
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // =========================================================================
    // --- INTERACTIVE BEFORE / AFTER AUDIO PREVIEWER ENGINE & VISUALIZER ---
    // =========================================================================
    (function initAudioPreviewer() {
        const previewSection = document.getElementById('audioEnhancerPreviewer');
        if (!previewSection) return;

        const canvas = document.getElementById('enhancerVisualizerCanvas');
        const canvasCtx = canvas ? canvas.getContext('2d') : null;
        const playBtn = document.getElementById('previewPlayBtn');
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        const btnBefore = document.getElementById('btnBefore');
        const btnAfter = document.getElementById('btnAfter');
        const crossfadeSlider = document.getElementById('abCrossfadeSlider');
        const progressContainer = document.getElementById('waveformProgressContainer');
        const progressFill = document.getElementById('waveformProgressFill');
        const currentTimeEl = document.getElementById('previewCurrentTime');
        const totalTimeEl = document.getElementById('previewTotalTime');
        const modeIndicator = document.getElementById('previewModeIndicator');
        const indicatorText = document.getElementById('indicatorText');
        const spectrumBadge = document.getElementById('spectrumBadge');
        const presetTabs = document.querySelectorAll('.preset-tab[data-preset]');
        const customAudioInput = document.getElementById('previewCustomAudioInput');
        const tryOnFilesBtn = document.getElementById('previewTryOnFilesBtn');

        let audioCtx = null;
        let isPlaying = false;
        let activePreset = 'vocals';
        let crossfadeValue = 1.0; // 0.0 = 100% Before, 1.0 = 100% After
        let currentSourceNode = null;
        let startTime = 0;
        let pauseOffset = 0;
        let audioDuration = 12.0;
        let animationFrameId = null;

        // DSP Nodes
        let gainBefore = null;
        let gainAfter = null;
        let masterGain = null;
        let analyserNode = null;
        let customBuffer = null;

        // Procedural Audio Buffer Cache
        const bufferCache = {};

        function getAudioContext() {
            if (!audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContextClass();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        }

        // Synthesize rich, authentic procedural music loops for each preset
        function synthesizePresetBuffer(ctx, preset) {
            if (bufferCache[preset]) return bufferCache[preset];

            const sampleRate = ctx.sampleRate;
            const duration = 12.0; // 12-second loop
            const totalSamples = Math.floor(sampleRate * duration);
            const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
            const leftChannel = buffer.getChannelData(0);
            const rightChannel = buffer.getChannelData(1);

            const bpm = preset === 'hiphop' ? 90 : (preset === 'acoustic' ? 105 : 95);
            const beatDuration = 60 / bpm;

            for (let i = 0; i < totalSamples; i++) {
                const t = i / sampleRate;
                const beat = (t % beatDuration) / beatDuration;
                const totalBeats = t / beatDuration;
                let sampleL = 0;
                let sampleR = 0;

                if (preset === 'vocals') {
                    // Formant-synthesized vocal melody + warm chord accompaniment
                    const chords = [
                        [220.0, 261.63, 329.63], // Am
                        [174.61, 220.0, 261.63], // F
                        [130.81, 164.81, 196.0], // C
                        [196.0, 246.94, 293.66]  // G
                    ];
                    const chordIdx = Math.floor(totalBeats / 4) % chords.length;
                    const curChord = chords[chordIdx];

                    // Vocal Lead / Formant (ah / oh)
                    const melodyFreqs = [440, 523.25, 659.25, 587.33, 440, 392, 523.25, 659.25];
                    const noteIdx = Math.floor(totalBeats * 2) % melodyFreqs.length;
                    const f0 = melodyFreqs[noteIdx];
                    const vocalEnv = Math.exp(-beat * 2.5) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 5 * t));
                    
                    // Formants at f0, 3*f0, 5*f0
                    const lead = (Math.sin(2 * Math.PI * f0 * t) * 0.5 + 
                                  Math.sin(2 * Math.PI * f0 * 2.01 * t) * 0.25 + 
                                  Math.sin(2 * Math.PI * f0 * 3.98 * t) * 0.15 +
                                  Math.sin(2 * Math.PI * f0 * 6.02 * t) * 0.08) * vocalEnv;

                    // Warm pad backing
                    let pad = 0;
                    for (let c = 0; c < curChord.length; c++) {
                        pad += Math.sin(2 * Math.PI * curChord[c] * t) * 0.12;
                        pad += Math.sin(2 * Math.PI * curChord[c] * 2 * t) * 0.04;
                    }

                    // Gentle acoustic percussion / shakers
                    const shaker = (Math.random() * 2 - 1) * Math.exp(-(beat % 0.25) * 20) * 0.08;

                    sampleL = lead * 0.7 + pad * 0.6 + shaker * 0.5;
                    sampleR = lead * 0.7 + pad * 0.6 + shaker * 0.5;

                } else if (preset === 'hiphop') {
                    // 808 Sub Kick + Snare + Trap Hi-Hats + Synth Chords
                    const isKick = (totalBeats % 4 === 0 || totalBeats % 4 === 2.5);
                    const kickEnv = isKick ? Math.exp(-beat * 6.0) : 0;
                    const kickFreq = 55 * Math.exp(-beat * 14.0) + 40;
                    const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.8;

                    // Snare on beat 2 and 4
                    const isSnare = (Math.floor(totalBeats) % 2 === 1 && beat < 0.35);
                    const snareEnv = isSnare ? Math.exp(-(beat) * 12.0) : 0;
                    const snare = ((Math.random() * 2 - 1) * 0.4 + Math.sin(2 * Math.PI * 180 * t) * 0.3) * snareEnv;

                    // Hi-Hats (16th notes with velocity accents)
                    const hatPhase = (totalBeats * 4) % 1;
                    const hatEnv = Math.exp(-hatPhase * 25.0);
                    const hatNoise = (Math.random() * 2 - 1) * hatEnv * 0.15;

                    // Lo-fi Rhodes Synth Chords
                    const hiphopChords = [146.83, 174.61, 220.0]; // Dm
                    let chordsSound = 0;
                    for (let c = 0; c < hiphopChords.length; c++) {
                        chordsSound += Math.sin(2 * Math.PI * hiphopChords[c] * t) * 0.12;
                        chordsSound += Math.sin(2 * Math.PI * hiphopChords[c] * 2 * t) * 0.05;
                    }

                    sampleL = kick * 0.9 + snare * 0.6 + hatNoise * 0.4 + chordsSound * 0.4;
                    sampleR = kick * 0.9 + snare * 0.6 + hatNoise * 0.6 + chordsSound * 0.4;

                } else { // acoustic
                    // Acoustic Guitar Arpeggio & Harmonics
                    const guitarPattern = [164.81, 220.0, 261.63, 329.63, 440.0, 329.63, 261.63, 220.0];
                    const noteIdx = Math.floor(totalBeats * 4) % guitarPattern.length;
                    const noteFreq = guitarPattern[noteIdx];
                    const notePhase = (totalBeats * 4) % 1;
                    const pluckEnv = Math.exp(-notePhase * 4.5);

                    // Guitar harmonics
                    const pluck = (
                        Math.sin(2 * Math.PI * noteFreq * t) * 0.5 +
                        Math.sin(2 * Math.PI * noteFreq * 2 * t) * 0.25 +
                        Math.sin(2 * Math.PI * noteFreq * 3 * t) * 0.15 +
                        Math.sin(2 * Math.PI * noteFreq * 4 * t) * 0.08 +
                        (Math.random() * 2 - 1) * Math.exp(-notePhase * 30) * 0.1
                    ) * pluckEnv;

                    // Ambient Room shimmer
                    const bassNote = Math.sin(2 * Math.PI * 110 * t) * 0.18;

                    sampleL = pluck * 0.75 + bassNote * 0.5;
                    sampleR = pluck * 0.65 + bassNote * 0.5;
                }

                // Smooth loop boundary fade
                const fadeDur = 0.05;
                let boundaryGain = 1.0;
                if (t < fadeDur) boundaryGain = t / fadeDur;
                if (t > duration - fadeDur) boundaryGain = (duration - t) / fadeDur;

                leftChannel[i] = sampleL * boundaryGain * 0.75;
                rightChannel[i] = sampleR * boundaryGain * 0.75;
            }

            bufferCache[preset] = buffer;
            return buffer;
        }

        // Build DSP Chain
        function buildDSPChain(ctx) {
            // Master Output & Analyzer
            masterGain = ctx.createGain();
            masterGain.gain.value = 1.0;

            analyserNode = ctx.createAnalyser();
            analyserNode.fftSize = 128;
            analyserNode.smoothingTimeConstant = 0.82;

            masterGain.connect(analyserNode);
            analyserNode.connect(ctx.destination);

            // --- BEFORE CHAIN (Low-Bitrate 96k Emulation) ---
            gainBefore = ctx.createGain();
            gainBefore.gain.value = 0.0;

            // Lowpass at 3.8kHz (removes high frequencies like low-bitrate MP3)
            const lowpassBefore = ctx.createBiquadFilter();
            lowpassBefore.type = 'lowpass';
            lowpassBefore.frequency.value = 3800;
            lowpassBefore.Q.value = 0.7;

            // Boxy mid resonance
            const midMuffle = ctx.createBiquadFilter();
            midMuffle.type = 'peaking';
            midMuffle.frequency.value = 420;
            midMuffle.gain.value = 2.5;
            midMuffle.Q.value = 1.5;

            // Flat compression
            const compBefore = ctx.createDynamicsCompressor();
            compBefore.threshold.value = -12;
            compBefore.ratio.value = 4;

            lowpassBefore.connect(midMuffle);
            midMuffle.connect(compBefore);
            compBefore.connect(gainBefore);
            gainBefore.connect(masterGain);

            // --- AFTER CHAIN (AI Enhanced 320k Studio Restoration) ---
            gainAfter = ctx.createGain();
            gainAfter.gain.value = 1.0;

            // High-shelf clarity exciter (+4.8dB @ 8.5kHz)
            const highShelfAfter = ctx.createBiquadFilter();
            highShelfAfter.type = 'highshelf';
            highShelfAfter.frequency.value = 8500;
            highShelfAfter.gain.value = 4.8;

            // Deep punch low-shelf (+3.2dB @ 75Hz)
            const lowShelfAfter = ctx.createBiquadFilter();
            lowShelfAfter.type = 'lowshelf';
            lowShelfAfter.frequency.value = 75;
            lowShelfAfter.gain.value = 3.2;

            // Anti-mud notch filter (-2.2dB @ 320Hz)
            const notchAfter = ctx.createBiquadFilter();
            notchAfter.type = 'peaking';
            notchAfter.frequency.value = 320;
            notchAfter.gain.value = -2.2;
            notchAfter.Q.value = 1.2;

            // Studio Master transparent multiband compressor
            const compAfter = ctx.createDynamicsCompressor();
            compAfter.threshold.value = -16;
            compAfter.ratio.value = 2.5;
            compAfter.attack.value = 0.01;
            compAfter.release.value = 0.15;

            highShelfAfter.connect(lowShelfAfter);
            lowShelfAfter.connect(notchAfter);
            notchAfter.connect(compAfter);
            compAfter.connect(gainAfter);
            gainAfter.connect(masterGain);

            return {
                inputBefore: lowpassBefore,
                inputAfter: highShelfAfter
            };
        }

        let dspInputs = null;

        function updateCrossfade(val) {
            crossfadeValue = val; // 0.0 (Before) to 1.0 (After)
            if (gainBefore && gainAfter && audioCtx) {
                const now = audioCtx.currentTime;
                // Equal-power crossfade curve
                const gainB = Math.cos(crossfadeValue * 0.5 * Math.PI);
                const gainA = Math.sin(crossfadeValue * 0.5 * Math.PI);
                gainBefore.gain.setTargetAtTime(gainB, now, 0.02);
                gainAfter.gain.setTargetAtTime(gainA, now, 0.02);
            }

            // Update UI
            if (crossfadeValue >= 0.6) {
                btnAfter.classList.add('active');
                btnBefore.classList.remove('active');
                if (modeIndicator) {
                    modeIndicator.className = 'mode-indicator';
                    indicatorText.textContent = 'AI ENHANCED (320kbps HD)';
                    indicatorText.style.color = '#38bdf8';
                }
                if (spectrumBadge) {
                    spectrumBadge.textContent = 'Full Spectrum 20Hz – 20kHz';
                    spectrumBadge.style.color = '#38bdf8';
                }
            } else if (crossfadeValue <= 0.4) {
                btnBefore.classList.add('active');
                btnAfter.classList.remove('active');
                if (modeIndicator) {
                    modeIndicator.className = 'mode-indicator original';
                    indicatorText.textContent = 'BEFORE (Original 96–128kbps)';
                    indicatorText.style.color = '#f59e0b';
                }
                if (spectrumBadge) {
                    spectrumBadge.textContent = 'Low-Pass Rolloff @ 3.8kHz';
                    spectrumBadge.style.color = '#f59e0b';
                }
            } else {
                btnBefore.classList.remove('active');
                btnAfter.classList.remove('active');
                if (modeIndicator) {
                    indicatorText.textContent = `A/B CROSSFADE (${Math.round(crossfadeValue * 100)}%)`;
                    indicatorText.style.color = '#cbd5e1';
                }
            }
        }

        function playAudio(offset = 0) {
            const ctx = getAudioContext();
            if (!dspInputs) {
                dspInputs = buildDSPChain(ctx);
            }

            stopAudio(false);

            let buffer = null;
            if (activePreset === 'custom' && customBuffer) {
                buffer = customBuffer;
            } else {
                buffer = synthesizePresetBuffer(ctx, activePreset);
            }

            audioDuration = buffer.duration;
            totalTimeEl.textContent = formatTime(audioDuration);

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;

            // Connect to both Before and After DSP chains
            source.connect(dspInputs.inputBefore);
            source.connect(dspInputs.inputAfter);

            const currentOffset = offset % audioDuration;
            source.start(0, currentOffset);
            startTime = ctx.currentTime - currentOffset;
            currentSourceNode = source;
            isPlaying = true;

            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');

            updateCrossfade(crossfadeValue);
            startVisualizerLoop();
        }

        function stopAudio(resetPosition = true) {
            if (currentSourceNode) {
                try {
                    currentSourceNode.stop();
                    currentSourceNode.disconnect();
                } catch (e) {}
                currentSourceNode = null;
            }
            isPlaying = false;
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');

            if (resetPosition) {
                pauseOffset = 0;
                if (progressFill) progressFill.style.width = '0%';
                if (currentTimeEl) currentTimeEl.textContent = '0:00';
            }
        }

        function togglePlay() {
            const ctx = getAudioContext();
            if (isPlaying) {
                pauseOffset = (ctx.currentTime - startTime) % audioDuration;
                stopAudio(false);
            } else {
                playAudio(pauseOffset);
            }
        }

        function formatTime(sec) {
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m}:${s < 10 ? '0' : ''}${s}`;
        }

        // Real-Time Canvas Spectrum Visualizer Loop
        function startVisualizerLoop() {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);

            const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 64;
            const dataArray = new Uint8Array(bufferLength);

            function render() {
                if (!canvasCtx || !canvas) return;

                const width = canvas.width;
                const height = canvas.height;

                canvasCtx.clearRect(0, 0, width, height);

                // Background grid lines
                canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
                canvasCtx.lineWidth = 1;
                for (let y = 30; y < height; y += 30) {
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(0, y);
                    canvasCtx.lineTo(width, y);
                    canvasCtx.stroke();
                }

                if (isPlaying && analyserNode && audioCtx) {
                    analyserNode.getByteFrequencyData(dataArray);

                    // Update time and progress bar
                    const currentPos = (audioCtx.currentTime - startTime) % audioDuration;
                    const progressPercent = (currentPos / audioDuration) * 100;
                    if (progressFill) progressFill.style.width = `${progressPercent}%`;
                    if (currentTimeEl) currentTimeEl.textContent = formatTime(currentPos);
                } else if (!isPlaying) {
                    // Gentle ambient idle waveform
                    const idleTime = Date.now() * 0.003;
                    for (let i = 0; i < bufferLength; i++) {
                        dataArray[i] = Math.max(12, Math.sin(i * 0.2 + idleTime) * 20 + 25);
                    }
                }

                // Draw Frequency Spectrum Bars
                const barCount = 42;
                const barSpacing = 4;
                const totalSpacing = (barCount - 1) * barSpacing;
                const barWidth = (width - totalSpacing) / barCount;

                for (let i = 0; i < barCount; i++) {
                    const dataIdx = Math.floor((i / barCount) * (bufferLength * 0.75));
                    let value = dataArray[dataIdx] || 0;

                    // If in "Before" mode, high frequencies roll off visually
                    if (crossfadeValue < 0.5 && i > barCount * 0.45) {
                        const rollOffFactor = Math.max(0.05, 1.0 - (i - barCount * 0.45) / (barCount * 0.4));
                        value = value * rollOffFactor * (1.0 - crossfadeValue * 0.8);
                    }

                    const barHeight = Math.max(4, (value / 255) * (height - 20));
                    const x = i * (barWidth + barSpacing);
                    const y = height - barHeight;

                    // Dynamic gradient depending on A/B state
                    const grad = canvasCtx.createLinearGradient(0, height, 0, y);
                    if (crossfadeValue > 0.6) {
                        grad.addColorStop(0, '#0284c7');
                        grad.addColorStop(0.5, '#38bdf8');
                        grad.addColorStop(1, '#c084fc');
                    } else if (crossfadeValue < 0.4) {
                        grad.addColorStop(0, '#b45309');
                        grad.addColorStop(0.6, '#f59e0b');
                        grad.addColorStop(1, '#fde68a');
                    } else {
                        grad.addColorStop(0, '#475569');
                        grad.addColorStop(0.5, '#38bdf8');
                        grad.addColorStop(1, '#f59e0b');
                    }

                    canvasCtx.fillStyle = grad;
                    canvasCtx.beginPath();
                    canvasCtx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
                    canvasCtx.fill();

                    // Glow Peak Dot
                    if (value > 40) {
                        canvasCtx.fillStyle = crossfadeValue > 0.5 ? '#e0f2fe' : '#fef3c7';
                        canvasCtx.fillRect(x, Math.max(2, y - 4), barWidth, 2);
                    }
                }

                animationFrameId = requestAnimationFrame(render);
            }

            render();
        }

        // --- EVENT LISTENERS ---
        if (playBtn) {
            playBtn.addEventListener('click', togglePlay);
        }

        if (btnBefore) {
            btnBefore.addEventListener('click', () => {
                crossfadeSlider.value = 0;
                updateCrossfade(0.0);
            });
        }

        if (btnAfter) {
            btnAfter.addEventListener('click', () => {
                crossfadeSlider.value = 100;
                updateCrossfade(1.0);
            });
        }

        if (crossfadeSlider) {
            crossfadeSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) / 100;
                updateCrossfade(val);
            });
        }

        // Preset Tabs Switching
        presetTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const preset = tab.getAttribute('data-preset');
                if (preset === activePreset) return;

                presetTabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');

                activePreset = preset;
                if (isPlaying) {
                    playAudio(0);
                } else {
                    pauseOffset = 0;
                    if (progressFill) progressFill.style.width = '0%';
                }
            });
        });

        // Custom User File Upload
        const customTabEl = document.querySelector('.custom-tab');
        if (customTabEl && customAudioInput) {
            customTabEl.addEventListener('click', () => {
                if (activePreset === 'custom' && customBuffer) {
                    customAudioInput.value = '';
                    customAudioInput.click();
                } else if (customBuffer) {
                    presetTabs.forEach(t => {
                        t.classList.remove('active');
                        t.setAttribute('aria-selected', 'false');
                    });
                    customTabEl.classList.add('active');
                    customTabEl.setAttribute('aria-selected', 'true');
                    activePreset = 'custom';
                    playAudio(0);
                } else {
                    customAudioInput.value = '';
                    customAudioInput.click();
                }
            });
        }

        if (customAudioInput) {
            customAudioInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const ctx = getAudioContext();
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    customBuffer = await ctx.decodeAudioData(arrayBuffer);
                    activePreset = 'custom';

                    presetTabs.forEach(t => {
                        t.classList.remove('active');
                        t.setAttribute('aria-selected', 'false');
                    });
                    const customTab = customAudioInput.closest('.custom-tab') || customTabEl;
                    if (customTab) {
                        customTab.classList.add('active');
                        customTab.setAttribute('aria-selected', 'true');
                    }

                    playAudio(0);
                } catch (err) {
                    console.error("Error decoding audio file for preview:", err);
                    alert("Could not decode this audio file. Please try an MP3, WAV, or OGG file.");
                }
            });
        }

        // Scrubbing on Timeline
        if (progressContainer) {
            progressContainer.addEventListener('click', (e) => {
                const rect = progressContainer.getBoundingClientRect();
                const clickPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const targetTime = clickPos * audioDuration;

                if (isPlaying) {
                    playAudio(targetTime);
                } else {
                    pauseOffset = targetTime;
                    if (progressFill) progressFill.style.width = `${clickPos * 100}%`;
                    if (currentTimeEl) currentTimeEl.textContent = formatTime(targetTime);
                }
            });
        }

        // CTA: Enhance My Tracks button
        if (tryOnFilesBtn) {
            tryOnFilesBtn.addEventListener('click', () => {
                const uploadContainer = document.getElementById('conversionToolContainer') || document.getElementById('dropZone');
                const upscaleAudioCheckbox = document.getElementById('upscaleAudio');

                if (upscaleAudioCheckbox) {
                    upscaleAudioCheckbox.checked = true;
                }

                if (uploadContainer) {
                    uploadContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    uploadContainer.style.transition = 'box-shadow 0.3s ease';
                    uploadContainer.style.boxShadow = '0 0 25px rgba(255, 85, 0, 0.4)';
                    setTimeout(() => {
                        uploadContainer.style.boxShadow = '';
                    }, 1800);
                }
            });
        }

        // Initialize visualizer idle loop on page load
        startVisualizerLoop();
    })();
});