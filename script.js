document.addEventListener('DOMContentLoaded', () => {
    // 1. User Dashboard & Auth UI Elements
    const userDashboard = document.getElementById('userDashboard');
    const guestLoginSection = document.getElementById('guestLoginSection');
    const conversionToolContainer = document.getElementById('conversionToolContainer');
    const loginEmail = document.getElementById('loginEmail');
    const sendLinkBtn = document.getElementById('sendLinkBtn');
    const authMessage = document.getElementById('authMessage');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const freeUsesDisplay = document.getElementById('freeUsesDisplay');
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

    const BACKEND_URL = 'https://mp3audio-staging.onrender.com'; 
    let currentSessionId = null;
    let pollInterval = null;

    // --- BULLETPROOF AUTHENTICATION LOGIC ---
    const checkAuth = async () => {
        // ALWAYS MAKE SURE THE TOOL IS VISIBLE IMMEDIATELY
        if (conversionToolContainer) conversionToolContainer.classList.remove('hidden');

        try {
            const response = await fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' });
            const data = await response.json();
            
            if (userDashboard) userDashboard.classList.remove('hidden');
            if (freeUsesDisplay) freeUsesDisplay.textContent = `${data.free_conversions_used}/5`;
            if (paidCreditsDisplay) paidCreditsDisplay.textContent = data.paid_track_credits;

            if (data.authenticated) {
                if (userEmailDisplay) userEmailDisplay.textContent = data.email;
                if (logoutBtn) logoutBtn.classList.remove('hidden');
                if (guestLoginSection) guestLoginSection.classList.add('hidden'); 
                if (buyCreditsBtn) buyCreditsBtn.classList.remove('hidden');  
            } else {
                if (userEmailDisplay) userEmailDisplay.textContent = 'Guest Session';
                if (logoutBtn) logoutBtn.classList.add('hidden');
                if (buyCreditsBtn) buyCreditsBtn.classList.add('hidden'); 
                
                if (data.free_conversions_used >= 5) {
                    if (guestLoginSection) guestLoginSection.classList.remove('hidden');
                    if (authMessage) {
                        authMessage.style.color = '#ef4444';
                        authMessage.textContent = "Free limit reached. Please sign in to buy credits.";
                    }
                } else {
                    if (guestLoginSection) guestLoginSection.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Auth Check Failed', error);
            if (guestLoginSection) guestLoginSection.classList.add('hidden');
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
                    urlMessage.innerHTML = `<div class="alert-message alert-success">Login successful! Welcome back.</div>`;
                    setTimeout(() => { urlMessage.classList.add('hidden'); }, 4000); 
                }
                checkAuth(); 
            } else {
                if (urlMessage) urlMessage.innerHTML = `<div class="alert-message alert-error">${data.error || 'Invalid link.'}</div>`;
                checkAuth();
            }
        })
        .catch(err => {
            if (urlMessage) urlMessage.innerHTML = `<div class="alert-message alert-error">Network error. Please try logging in again.</div>`;
            checkAuth();
        });
    } else {
        checkAuth();
    }

    if (sendLinkBtn) {
        sendLinkBtn.addEventListener('click', async () => {
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
                        authMessage.style.color = '#2ecc71';
                        authMessage.textContent = 'Link sent! Check your email inbox.';
                    }
                } else {
                    if (authMessage) {
                        authMessage.style.color = '#ef4444';
                        authMessage.textContent = 'Failed to send link.';
                    }
                    sendLinkBtn.disabled = false;
                    sendLinkBtn.textContent = 'Send Link';
                }
            } catch (error) {
                if (authMessage) {
                    authMessage.style.color = '#ef4444';
                    authMessage.textContent = 'Network error. Try again.';
                }
                sendLinkBtn.disabled = false;
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
            window.location.reload();
        });
    }
    
    if (buyCreditsBtn) {
        buyCreditsBtn.addEventListener('click', async () => {
            buyCreditsBtn.disabled = true;
            buyCreditsBtn.textContent = 'Generating Invoice...';
            try {
                const response = await fetch(`${BACKEND_URL}/buy-credits`, { method: 'POST', credentials: 'include' });
                const data = await response.json();
                if (response.ok && data.invoice_url) window.location.href = data.invoice_url;
                else {
                    if (billingMessage) {
                        billingMessage.textContent = 'Checkout error. Please try again later.';
                        billingMessage.style.display = 'block';
                    }
                    buyCreditsBtn.disabled = false;
                }
            } catch (error) {
                if (billingMessage) {
                    billingMessage.textContent = 'Network error. Please try again.';
                    billingMessage.style.display = 'block';
                }
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
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    };

    const fullReset = () => {
        if (urlInput) urlInput.value = '';
        if (startTimeInput) startTimeInput.value = ''; 
        if (endTimeInput) endTimeInput.value = '';  
        if (transcribeInput) transcribeInput.checked = false;   
        if (statusDiv) statusDiv.innerHTML = "Ready";
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
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    const pollStatus = async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Status check failed');
            const data = await response.json();
            
            if (!statusDiv) return;

            // STATE: WAITING IN QUEUE
            if (data.status === 'queued') {
                if (progressBar) progressBar.classList.add('hidden');
                const waitText = data.estimated_wait <= 1 ? "< 1 min" : `~${data.estimated_wait} mins`;

                statusDiv.innerHTML = `
                    <div class="queue-box">
                        <div class="spinner queue-spinner"></div>
                        <p style="margin:0 0 5px 0; font-weight:bold;">Waiting in Queue</p>
                        <p style="margin:0; font-size:0.85rem;">Position: ${data.queue_position} | Est. Wait: ${waitText}</p>
                    </div>
                `;
            } 
            // STATE: PROCESSING
            else if (data.status === 'processing') {
                if (progressBar) progressBar.classList.remove('hidden');
                
                if (data.current_thumbnail && currentThumbnail && thumbnailContainer) {
                    currentThumbnail.src = data.current_thumbnail;
                    thumbnailContainer.classList.remove('hidden');
                }
                
                updateProgress(data.completed, data.total, data.sub_progress);
                
                statusDiv.innerHTML = `
                    <div class="spinner"></div>
                    <p style="margin:0; font-weight:bold;">Processing...</p>
                    <p style="margin:5px 0 0 0; font-size:0.85rem; color:#64748b;">${data.current_status || 'Working on your files'}</p>
                `;
            }
            // STATE: COMPLETED
            else if (data.status === 'completed') {
                resetUI();
                if (progressBar) progressBar.classList.remove('hidden');
                updateProgress(data.total, data.total, 100);
                
                statusDiv.innerHTML = `<p style="color: #2ecc71; font-weight: bold;">✅ Success! Conversion complete.</p>`;
                
                if (downloadArea && downloadList) {
                    downloadArea.classList.remove('hidden');
                    downloadList.innerHTML = `
                        <li>
                            <a href="${BACKEND_URL}${data.zip_path}" class="zip-btn" target="_blank">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Download ZIP Archive
                            </a>
                        </li>
                    `;
                }
                currentSessionId = null;
                checkAuth(); 
            }
            // STATE: ERROR OR CANCELLED
            else if (data.status === 'error' || data.status === 'cancelled') {
                resetUI();
                const msg = data.status === 'error' ? (data.error || 'An error occurred during processing.') : 'Process Cancelled.';
                statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold;">❌ ${msg}</p>`;
                currentSessionId = null;
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    };

    const startConversion = async () => {
        if (!urlInput || !statusDiv) return;
        const url = urlInput.value.trim();
        if (!url) {
            statusDiv.innerHTML = `<p style="color: #ef4444;">Please enter a valid URL.</p>`;
            return;
        }

        const startTime = startTimeInput ? startTimeInput.value.trim() : '';
        const endTime = endTimeInput ? endTimeInput.value.trim() : '';
        const transcribeAudio = transcribeInput ? transcribeInput.checked : false;

        if (convertBtn) {
            convertBtn.disabled = true;
            convertBtn.textContent = "Processing...";
        }
        if (resetBtn) resetBtn.disabled = true;
        if (actionGroup) actionGroup.style.display = 'flex';
        if (cancelBtn) cancelBtn.classList.remove('hidden');
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Spinning up the server. Please be patient...</p>`;
        if (downloadArea) downloadArea.classList.add('hidden');
        if (thumbnailContainer) thumbnailContainer.classList.add('hidden');
        if (progressBar) progressBar.classList.remove('hidden');
        if (progressFill) {
            progressFill.style.width = '0%';
            progressFill.textContent = 'Initializing...';
        }

        try {
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

            // INTERCEPT GUESTS HITTING LIMIT
            if (response.status === 403) {
                statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold;">❌ Conversion Blocked: Limit Reached</p>`;
                if (guestLoginSection) guestLoginSection.classList.remove('hidden');
                if (loginEmail) loginEmail.focus();
                if (authMessage) {
                    authMessage.style.color = '#ef4444';
                    authMessage.textContent = "You've hit the free limit! Please sign in below to unlock more.";
                }
                if (userDashboard) userDashboard.scrollIntoView({ behavior: 'smooth' });
                resetUI();
                checkAuth();
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start conversion');
            }

            currentSessionId = data.session_id;
            pollInterval = setInterval(pollStatus, 2000);
            pollStatus(); 
        } catch (error) {
            resetUI();
            statusDiv.innerHTML = `<p style="color: #ef4444;">❌ ${error.message}</p>`;
        }
    };

    const cancelConversion = async () => {
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
        } catch (error) {
            console.error('Failed to cancel:', error);
            resetUI();
        }
    };

    if (convertBtn) convertBtn.addEventListener('click', startConversion);
    if (cancelBtn) cancelBtn.addEventListener('click', cancelConversion);
    if (resetBtn) resetBtn.addEventListener('click', fullReset);
});