// Header auth state handler for pages that do not load the full converter script.js
(function () {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const BACKEND_URL = isLocal ? 'http://127.0.0.1:8000' : 'https://api.mp3aud.io';
    const headerLoginLink = document.getElementById('headerLoginLink');
    const headerUserNav = document.getElementById('headerUserNav');
    const headerPaidCreditsDisplay = document.getElementById('headerPaidCreditsDisplay');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');

    if (!headerLoginLink || !headerUserNav) return;

    // Only attempt backend auth verification over HTTP/HTTPS protocols
    if (window.location.protocol.indexOf('http') === 0) {
        fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' })
            .then(function (res) {
                if (!res.ok) throw new Error('Auth check not ok');
                return res.json();
            })
            .then(function (data) {
                if (data && data.authenticated) {
                    if (headerPaidCreditsDisplay) {
                        headerPaidCreditsDisplay.textContent = (data.paid_track_credits !== undefined && data.paid_track_credits !== null) ? data.paid_track_credits : 0;
                    }
                    headerUserNav.classList.remove('hidden');
                    headerLoginLink.classList.add('hidden');
                }
            })
            .catch(function () {
                // Keep default Sign In / Pricing visible
            });
    }

    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', async function () {
            try {
                if (window.location.protocol.indexOf('http') === 0) {
                    await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
                }
            } catch (e) {}
            localStorage.removeItem('session_token');
            window.location.reload();
        });
    }
})();
