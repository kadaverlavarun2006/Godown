// LogEase Administrator Login Logic

// Update 'logease-backend.onrender.com' to your actual Render service name after deployment
const LOGIN_API = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://logease-backend.onrender.com';


const loginForm = document.querySelector('#login-form');
const emailInput = document.querySelector('#admin-email');
const passwordInput = document.querySelector('#admin-password');
const loginBtn = document.querySelector('#login-btn');
const loginAlert = document.querySelector('#login-alert');

const showAlert = (message, isError = true) => {
    loginAlert.textContent = message;
    loginAlert.className = `alert-message ${isError ? 'alert-error' : 'alert-success'}`;
    loginAlert.classList.remove('hidden');
};

const hideAlert = () => {
    loginAlert.textContent = '';
    loginAlert.classList.add('hidden');
};

const handleLogin = async (e) => {
    if (e) e.preventDefault();
    hideAlert();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showAlert('Please enter both email and password.');
        return;
    }

    loginBtn.disabled = true;
    const btnSpan = loginBtn.querySelector('span') || loginBtn;
    btnSpan.textContent = 'Authenticating...';

    try {
        const response = await fetch(`${LOGIN_API}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed. Please verify your credentials.');
            }

            if (!data.user || !['ADMIN', 'RETAILER', 'DRIVER'].includes(data.user.role)) {
                throw new Error('Access Denied: You do not have permission to access this portal.');
            }

            // Store authentication credentials
            setAuth(data.token, data.user);

            const role = data.user.role;
            let welcomeText = `Welcome, Administrator ${data.user.name}! Redirecting to Dashboard...`;
            let redirectPage = 'index.html';

            if (role === 'RETAILER') {
                welcomeText = `Welcome, ${data.user.name}! Redirecting to Retailer Portal...`;
                const params = new URLSearchParams(window.location.search);
                const redirectParam = params.get('redirect');
                const allowedRetailerPages = ['retailer-portal.html', 'products.html'];
                if (redirectParam && allowedRetailerPages.includes(redirectParam.split('?')[0])) {
                    redirectPage = redirectParam;
                } else {
                    redirectPage = 'retailer-portal.html';
                }
            } else if (role === 'DRIVER') {
                welcomeText = `Welcome, Driver ${data.user.name}! Redirecting to Driver Portal...`;
                redirectPage = 'driver-portal.html';
            } else {
                const params = new URLSearchParams(window.location.search);
                redirectPage = params.get('redirect') || 'index.html';
            }

            showAlert(welcomeText, false);

            setTimeout(() => {
                window.location.href = redirectPage;
            }, 600);

        } catch (error) {
            showAlert(error.message);
        } finally {
            loginBtn.disabled = false;
            const btnSpan2 = loginBtn.querySelector('span') || loginBtn;
            btnSpan2.textContent = 'Sign In';
        }
};

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
} else if (loginBtn) {
    // Fallback if form element is missing
    loginBtn.addEventListener('click', handleLogin);
}
