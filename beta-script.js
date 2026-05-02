document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const authContainer = document.getElementById('authContainer');
    const userDashboard = document.getElementById('userDashboard');
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

    // === CHANGE THIS TO YOUR RENDER STAGING URL ===
    const BACKEND_URL = 'https://mp3audio-staging.onrender.com'; 
    
    // Check for Magic Link URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'success') {
        urlMessage.innerHTML = `<div class="alert-message alert-success">Login successful! Welcome back.</div>`;
        urlMessage.classList.remove('hidden');
        window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
    } else if (urlParams.get('error')) {
        urlMessage.innerHTML = `<div class="alert-message alert-error">Login link invalid or expired. Try again.</div>`;
        urlMessage.classList.remove('hidden');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // --- AUTHENTICATION FLOW ---
    const checkAuth = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/auth/me`, {
                method: 'GET',
                credentials: 'include' // CRITICAL for session cookies
            });
            const data = await response.json();
            
            if (data.authenticated) {
                // User is logged in: Show Dashboard & Tool
                authContainer.classList.add('hidden');
                userDashboard.classList.remove('hidden');
                conversionToolContainer.classList.remove('hidden');
                
                userEmailDisplay.textContent = data.email;
                freeUsesDisplay.textContent = `${data.free_conversions_used}/5`;
                paidCreditsDisplay.textContent = data.paid_track_credits;
            } else {
                // User is logged out: Show Login
                authContainer.classList.remove('hidden');
                userDashboard.classList.add('hidden');
                conversionToolContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Auth Check Failed', error);
            authContainer.classList.remove('hidden');
        }
    };

    const sendMagicLink = async () => {
        const email = loginEmail.value.trim();
        if (!email) {
            authMessage.style.color = '#ef4444';
            authMessage.textContent = 'Please enter a valid email.';
            return;
        }

        sendLinkBtn.disabled = true;
        sendLinkBtn.textContent = 'Sending...';
        authMessage.style.color = '#475569';
        authMessage.textContent = 'Requesting secure link...';

        try {
            const response = await fetch(`${BACKEND_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();

            if (response.ok) {
                authMessage.style.color = '#2ecc71';
                authMessage.textContent = 'Link sent! Check your email inbox.';
            } else {
                authMessage.style.color = '#ef4444';
                authMessage.textContent = data.error || 'Failed to send link.';
                sendLinkBtn.disabled = false;
                sendLinkBtn.textContent = 'Send Link';
            }
        } catch (error) {
            authMessage.style.color = '#ef4444';
            authMessage.textContent = 'Network error. Try again.';
            sendLinkBtn.disabled = false;
            sendLinkBtn.textContent = 'Send Link';
        }
    };

    const logoutUser = async () => {
        await fetch(`${BACKEND_URL}/auth/logout`, { 
            method: 'POST', 
            credentials: 'include' 
        });
        window.location.reload();
    };

    const buyCredits = async () => {
        buyCreditsBtn.disabled = true;
        buyCreditsBtn.textContent = 'Generating Invoice...';
        
        try {
            const response = await fetch(`${BACKEND_URL}/buy-credits`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await response.json();
            
            if (response.ok && data.invoice_url) {
                window.location.href = data.invoice_url; // Redirect to NOWPayments
            } else {
                billingMessage.textContent = 'Checkout error. Please try again later.';
                billingMessage.style.display = 'block';
                buyCreditsBtn.disabled = false;
                buyCreditsBtn.textContent = 'Buy 100 Credits for $2.00';
            }
        } catch (error) {
            billingMessage.textContent = 'Network error. Please try again.';
            billingMessage.style.display = 'block';
            buyCreditsBtn.disabled = false;
            buyCreditsBtn.textContent = 'Buy 100 Credits for $2.00';
        }
    };

    // Event Listeners for Auth & Billing
    sendLinkBtn.addEventListener('click', sendMagicLink);
    logoutBtn.addEventListener('click', logoutUser);
    buyCreditsBtn.addEventListener('click', buyCredits);
    
    // Initial Load
    checkAuth();


    // --- CONVERSION TOOL LOGIC ---
    // (This is your existing code, updated with credentials: 'include')
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const statusDiv = document.getElementById('status');
    let currentSessionId = null;
    let pollInterval = null;

    const pollStatus = async () => {
        if (!currentSessionId) return;
        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`, { 
                credentials: 'include' // CRITICAL
            });
            const data = await response.json();
            
            if (data.status === 'processing') {
                statusDiv.innerHTML = `<p>Processing: ${data.completed} / ${data.total}</p>`;
            } else if (data.status === 'completed') {
                statusDiv.innerHTML = `<p style="color: green;">✅ Complete!</p>`;
                document.getElementById('downloadArea').classList.remove('hidden');
                document.getElementById('downloadList').innerHTML = `
                    <li><a href="${BACKEND_URL}${data.zip_path}" class="zip-btn" target="_blank">Download ZIP</a></li>
                `;
                clearInterval(pollInterval);
                checkAuth(); // Refresh stats on dashboard
            } else if (data.status === 'error') {
                statusDiv.innerHTML = `<p style="color: red;">❌ Error processing.</p>`;
                clearInterval(pollInterval);
            }
        } catch (error) { console.error(error); }
    };

    const startConversion = async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        convertBtn.disabled = true;
        statusDiv.innerHTML = `<p>Starting...</p>`;

        try {
            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST',
                credentials: 'include', // CRITICAL
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url,
                    transcribe_audio: document.getElementById('transcribeAudio').checked,
                    start_time: document.getElementById('startTime').value,
                    end_time: document.getElementById('endTime').value
                })
            });

            const data = await response.json();

            // Handle limits and billing blockers
            if (response.status === 403 && data.requires_payment) {
                statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold;">❌ Limit Reached</p>`;
                billingMessage.textContent = data.error;
                billingMessage.style.display = 'block';
                // Automatically scroll up to the buy button
                userDashboard.scrollIntoView({ behavior: 'smooth' });
                convertBtn.disabled = false;
                return;
            }

            if (!response.ok) throw new Error(data.error || 'Failed to start');

            currentSessionId = data.session_id;
            pollInterval = setInterval(pollStatus, 2000);
            
        } catch (error) {
            statusDiv.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
            convertBtn.disabled = false;
        }
    };

    convertBtn.addEventListener('click', startConversion);
});