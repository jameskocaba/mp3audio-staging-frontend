document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
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

    const BACKEND_URL = 'https://mp3audio-staging.onrender.com'; // Verify this URL!
    
    // --- SEAMLESS TOKEN VERIFICATION ---
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        // 1. Show a loading state on the UI immediately
        urlMessage.innerHTML = `<div class="alert-message" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe;">Verifying secure link...</div>`;
        urlMessage.classList.remove('hidden');
        
        // 2. Clean the URL bar so the token disappears
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // 3. Secretly verify with the backend
        fetch(`${BACKEND_URL}/auth/verify`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                urlMessage.innerHTML = `<div class="alert-message alert-success">Login successful! Welcome back.</div>`;
                // Hide the success message after 4 seconds
                setTimeout(() => { urlMessage.classList.add('hidden'); }, 4000); 
                checkAuth(); // Refreshes UI and hides the guest login section
            } else {
                urlMessage.innerHTML = `<div class="alert-message alert-error">${data.error || 'Invalid link.'}</div>`;
                checkAuth();
            }
        })
        .catch(err => {
            urlMessage.innerHTML = `<div class="alert-message alert-error">Network error. Please try logging in again.</div>`;
            checkAuth();
        });
    } else {
        // Normal page load, no token
        checkAuth();
    }

    // --- SMART AUTHENTICATION FLOW ---
    async function checkAuth() {
        try {
            const response = await fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' });
            const data = await response.json();
            
            userDashboard.classList.remove('hidden');
            freeUsesDisplay.textContent = `${data.free_conversions_used}/5`;
            paidCreditsDisplay.textContent = data.paid_track_credits;

            // WE ALWAYS WANT THE TOOL VISIBLE NOW
            conversionToolContainer.classList.remove('hidden'); 

            if (data.authenticated) {
                // USER IS LOGGED IN
                userEmailDisplay.textContent = data.email;
                logoutBtn.classList.remove('hidden');
                guestLoginSection.classList.add('hidden'); // Hide the login form
                buyCreditsBtn.classList.remove('hidden');  // Show the buy button
            } else {
                // USER IS AN ANONYMOUS GUEST
                userEmailDisplay.textContent = 'Guest Session';
                logoutBtn.classList.add('hidden');
                guestLoginSection.classList.remove('hidden'); // Show login form
                buyCreditsBtn.classList.add('hidden'); // Hide buy button
                
                // Update text if they hit limit, but don't hide the tool
                if (data.free_conversions_used >= 5) {
                    authMessage.style.color = '#ef4444';
                    authMessage.textContent = "Free limit reached. Please sign in to buy credits.";
                }
            }
        } catch (error) {
            console.error('Auth Check Failed', error);
        }
    }

    const sendMagicLink = async () => {
        const email = loginEmail.value.trim();
        if (!email) return;

        sendLinkBtn.disabled = true;
        sendLinkBtn.textContent = 'Sending...';
        authMessage.style.color = '#475569';
        authMessage.textContent = 'Requesting secure link...';

        try {
            const response = await fetch(`${BACKEND_URL}/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
            });
            if (response.ok) {
                authMessage.style.color = '#2ecc71';
                authMessage.textContent = 'Link sent! Check your email inbox.';
            } else {
                authMessage.style.color = '#ef4444';
                authMessage.textContent = 'Failed to send link.';
                sendLinkBtn.disabled = false;
                sendLinkBtn.textContent = 'Send Link';
            }
        } catch (error) {
            authMessage.style.color = '#ef4444';
            authMessage.textContent = 'Network error. Try again.';
            sendLinkBtn.disabled = false;
        }
    };

    // Event Listeners for Auth
    sendLinkBtn.addEventListener('click', sendMagicLink);
    logoutBtn.addEventListener('click', async () => {
        await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
        window.location.reload();
    });
    
    buyCreditsBtn.addEventListener('click', async () => {
        buyCreditsBtn.disabled = true;
        buyCreditsBtn.textContent = 'Generating Invoice...';
        try {
            const response = await fetch(`${BACKEND_URL}/buy-credits`, { method: 'POST', credentials: 'include' });
            const data = await response.json();
            if (response.ok && data.invoice_url) window.location.href = data.invoice_url;
            else {
                billingMessage.textContent = 'Checkout error. Please try again later.';
                billingMessage.style.display = 'block';
                buyCreditsBtn.disabled = false;
            }
        } catch (error) {
            billingMessage.textContent = 'Network error. Please try again.';
            billingMessage.style.display = 'block';
            buyCreditsBtn.disabled = false;
        }
    });

    // --- CONVERSION LOGIC ---
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const statusDiv = document.getElementById('status');
    let currentSessionId = null;
    let pollInterval = null;

    const pollStatus = async () => {
        if (!currentSessionId) return;
        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.status === 'processing') {
                statusDiv.innerHTML = `<p>Processing: ${data.completed} / ${data.total}</p>`;
            } else if (data.status === 'completed') {
                statusDiv.innerHTML = `<p style="color: green;">✅ Complete!</p>`;
                document.getElementById('downloadArea').classList.remove('hidden');
                document.getElementById('downloadList').innerHTML = `<li><a href="${BACKEND_URL}${data.zip_path}" class="zip-btn" target="_blank">Download ZIP</a></li>`;
                clearInterval(pollInterval);
                checkAuth(); // Refreshes the 0/5 UI immediately after success
            } else if (data.status === 'error') {
                statusDiv.innerHTML = `<p style="color: red;">❌ Error processing.</p>`;
                clearInterval(pollInterval);
            }
        } catch (error) { console.error(error); }
    };

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        convertBtn.disabled = true;
        statusDiv.innerHTML = `<p>Starting...</p>`;

        try {
            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url,
                    transcribe_audio: document.getElementById('transcribeAudio').checked
                })
            });
            const data = await response.json();

            // --- THE INTERCEPT FOR GUESTS HITTING THE LIMIT ---
            if (response.status === 403) {
                statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold;">❌ Conversion Blocked: Limit Reached</p>`;
                
                // Highlight the login box and scroll the user up to it
                guestLoginSection.classList.remove('hidden');
                loginEmail.focus();
                authMessage.style.color = '#ef4444';
                authMessage.textContent = "You've hit the free limit! Please sign in below to unlock more.";
                userDashboard.scrollIntoView({ behavior: 'smooth' });
                
                convertBtn.disabled = false;
                checkAuth();
                return;
            }
            if (!response.ok) throw new Error(data.error || 'Failed to start');

            currentSessionId = data.session_id;
            pollInterval = setInterval(pollStatus, 2000);
            
        } catch (error) {
            statusDiv.innerHTML = `<p style="color: red;">❌ ${error.message}</p>`;
            convertBtn.disabled = false;
        }
    });
});