document.addEventListener('DOMContentLoaded', () => {
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
    const billingMessage = document.getElementById('billingMessage');
    const urlMessage = document.getElementById('urlMessage');

    // 2. Conversion Tool UI Elements
    const urlInput = document.getElementById('urlInput');
    const startTimeInput = document.getElementById('startTime'); 
    const endTimeInput = document.getElementById('endTime');     
    const transcribeInput = document.getElementById('transcribeAudio'); 
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

    // Point this to your production backend URL
    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 
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

    // --- AUTHENTICATION LOGIC ---
    const checkAuth = async () => {
        if (conversionToolContainer) conversionToolContainer.classList.remove('hidden');

        try {
            const response = await fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' });
            const data = await response.json();
            
            
            if (paidCreditsDisplay) paidCreditsDisplay.textContent = data.paid_track_credits;

            if (data.authenticated) {
                isGuestUser = false;
                // User is logged in/paid
                if (userDashboard) userDashboard.classList.remove('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = data.email;
                if (logoutBtn) logoutBtn.classList.remove('hidden');
                if (buyCreditsBtn) buyCreditsBtn.classList.remove('hidden');  
                if (loginFormContainer) loginFormContainer.classList.add('hidden'); 
            } else {
                isGuestUser = true;
                // User is a guest
                if (userDashboard) userDashboard.classList.add('hidden');
                if (loginFormContainer) loginFormContainer.classList.remove('hidden');
                
                if (data.free_conversions_used >= 10) {
                    if (authMessage) {
                        authMessage.style.color = '#ef4444';
                        authMessage.textContent = "Free limit reached. Please sign in to buy credits.";
                    }
                }
            }
        } catch (error) {
            console.error('Auth Check Failed', error);
            // Fallback for offline mode/guests
            if (userDashboard) userDashboard.classList.add('hidden');
            if (loginFormContainer) loginFormContainer.classList.remove('hidden');
        }
    };

    // --- MAGIC LINK VERIFICATION ---
    const urlParams = new URLSearchParams(window.location.search);
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
                authMessage.textContent = 'Requesting secure link...';
            }

            try {
                const response = await fetch(`${BACKEND_URL}/auth/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
                });
                if (response.ok) {
                    if (authMessage) {
                        authMessage.textContent = '';
                    }
                    showToast('Link sent! Check your email inbox.', 'success');
                } else {
                    showToast('Failed to send link.', 'error');
                    sendLinkBtn.disabled = false;
                    sendLinkBtn.textContent = 'Send Link';
                }
            } catch (error) {
                showToast('Network error. Try again.', 'error');
                sendLinkBtn.disabled = false;
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
            window.location.reload();
        });
    }
    
    if (buyCreditsBtn) {
        buyCreditsBtn.addEventListener('click', async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            buyCreditsBtn.disabled = true;
            buyCreditsBtn.textContent = 'Generating Invoice...';
            try {
                const response = await fetch(`${BACKEND_URL}/buy-credits`, { method: 'POST', credentials: 'include' });
                const data = await response.json();
                if (response.ok && data.invoice_url) window.location.href = data.invoice_url;
                else {
                    showToast('Checkout error. Please try again later.', 'error');
                    buyCreditsBtn.disabled = false;
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
                buyCreditsBtn.disabled = false;
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
                    statusDiv.innerHTML = `<p style="color: #2ecc71; font-weight: bold; font-size: 1.1rem;">✅ Success! Converted ${data.completed} of ${data.total} tracks.</p>`;
                    showToast(`Success! Converted ${data.completed} of ${data.total} tracks.`, 'success');
                } else {
                    statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold; font-size: 1.1rem;">⚠️ Process Finished: 0 tracks converted.</p>`;
                    showToast(`No tracks could be converted.`, 'error');
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
            if (!urlInput || !statusDiv) return;
            const url = urlInput.value.trim();
            if (!url) {
                showToast('Please enter a valid URL.', 'error');
                return;
            }

            if (convertBtn) {
                convertBtn.disabled = true;
                convertBtn.textContent = "Processing...";
            }
            if (resetBtn) resetBtn.disabled = true;
            if (actionGroup) actionGroup.style.display = 'flex';
            if (cancelBtn) cancelBtn.classList.remove('hidden');

            statusDiv.innerHTML = `<div class="spinner"></div><p style="font-weight:bold; color:#2980b9;">Spinning up server and analyzing link...</p><p style="font-size:0.85rem; color:#64748b;">(Playlists can take 10-15 seconds to fetch from SoundCloud)</p>`;
            
            if (downloadArea) downloadArea.classList.add('hidden');
            if (conversionSummary) conversionSummary.innerHTML = '';
            if (thumbnailContainer) thumbnailContainer.classList.add('hidden');
            if (progressBar) progressBar.classList.remove('hidden');
            if (progressFill) {
                progressFill.style.width = '0%';
                progressFill.textContent = 'Initializing...';
            }

            const startTime = startTimeInput ? startTimeInput.value.trim() : '';
            const endTime = endTimeInput ? endTimeInput.value.trim() : '';
            const transcribeAudio = transcribeInput ? transcribeInput.checked : false;

            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url, 
                    start_time: startTime, 
                    end_time: endTime, 
                    transcribe_audio: transcribeAudio
                })
            });

            const data = await response.json();

            if (response.status === 403) {
                // UI Limit Warning Handler
                statusDiv.innerHTML = `
                    <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 8px; text-align: left;">
                        <p style="color: #b45309; font-weight: bold; margin-top: 0; margin-bottom: 8px;">⚠️ Limit Reached</p>
                        <p style="font-size: 0.9rem; color: #92400e; margin: 0; line-height: 1.4;">${data.error || 'Conversion Blocked: You have reached the limit for this request.'}</p>
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
                throw new Error(data.error || 'Failed to start conversion');
            }

            currentSessionId = data.session_id;
            pollStatus(); // Triggers the first check, which then schedules the rest
            
        } catch (error) {
            console.error(error);
            resetUI();
            statusDiv.innerHTML = `Ready`;
            showToast(error.message, 'error');
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
            showToast('Conversion cancelled.', 'info');
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
});