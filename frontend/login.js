// ======================================================
// LogEase Login Logic
// ======================================================


// ======================================================
// BACKEND URL
// ======================================================

const LOGIN_API =
    window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://godown-backend-b3e9.onrender.com';


// ======================================================
// DOM ELEMENTS
// ======================================================

const loginForm =
    document.querySelector('#login-form');

const emailInput =
    document.querySelector('#admin-email');

const passwordInput =
    document.querySelector('#admin-password');

const loginBtn =
    document.querySelector('#login-btn');

const loginAlert =
    document.querySelector('#login-alert');


// ======================================================
// ALERT
// ======================================================

const showAlert = (
    message,
    isError = true
) => {

    if (!loginAlert) {
        return;
    }

    loginAlert.textContent =
        message;

    loginAlert.className =
        `alert-message ${
            isError
                ? 'alert-error'
                : 'alert-success'
        }`;

    loginAlert.classList.remove(
        'hidden'
    );
};


const hideAlert = () => {

    if (!loginAlert) {
        return;
    }

    loginAlert.textContent = '';

    loginAlert.classList.add(
        'hidden'
    );
};


// ======================================================
// LOGIN
// ======================================================

const handleLogin = async (e) => {

    if (e) {
        e.preventDefault();
    }


    hideAlert();


    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;


    // ----------------------------------------------
    // VALIDATION
    // ----------------------------------------------

    if (!email || !password) {

        showAlert(
            'Please enter both email and password.'
        );

        return;
    }


    // ----------------------------------------------
    // BUTTON
    // ----------------------------------------------

    loginBtn.disabled = true;


    const btnSpan =
        loginBtn.querySelector('span') ||
        loginBtn;


    btnSpan.textContent =
        'Authenticating...';


    try {


        // ==========================================
        // LOGIN REQUEST
        // ==========================================

        const response =
            await fetch(
                `${LOGIN_API}/api/auth/login`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );


        // ==========================================
        // RESPONSE
        // ==========================================

        let data;

        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                'Backend returned an invalid response.'
            );
        }


        // ==========================================
        // ERROR
        // ==========================================

        if (!response.ok) {

            throw new Error(
                data.message ||
                'Login failed. Please verify your credentials.'
            );
        }


        // ==========================================
        // USER VALIDATION
        // ==========================================

        if (
            !data.user ||
            ![
                'ADMIN',
                'RETAILER',
                'DRIVER'
            ].includes(
                data.user.role
            )
        ) {

            throw new Error(
                'Access Denied: You do not have permission to access this portal.'
            );
        }


        // ==========================================
        // TOKEN VALIDATION
        // ==========================================

        if (!data.token) {

            throw new Error(
                'Login succeeded but no authentication token was returned.'
            );
        }


        // ==========================================
        // SAVE AUTH
        // ==========================================

        localStorage.setItem(
            'logease_token',
            data.token
        );

        localStorage.setItem(
            'logease_user',
            JSON.stringify(
                data.user
            )
        );


        // ==========================================
        // ROLE
        // ==========================================

        const role =
            data.user.role;


        let welcomeText =
            `Welcome, Administrator ${data.user.name}! Redirecting to Dashboard...`;


        let redirectPage =
            'index.html';


        // ==========================================
        // RETAILER
        // ==========================================

        if (
            role === 'RETAILER'
        ) {

            welcomeText =
                `Welcome, ${data.user.name}! Redirecting to Retailer Portal...`;


            const params =
                new URLSearchParams(
                    window.location.search
                );


            const redirectParam =
                params.get('redirect');


            const allowedRetailerPages = [
                'retailer-portal.html',
                'products.html'
            ];


            if (
                redirectParam &&
                allowedRetailerPages.includes(
                    redirectParam.split('?')[0]
                )
            ) {

                redirectPage =
                    redirectParam;

            } else {

                redirectPage =
                    'retailer-portal.html';
            }
        }


        // ==========================================
        // DRIVER
        // ==========================================

        else if (
            role === 'DRIVER'
        ) {

            welcomeText =
                `Welcome, Driver ${data.user.name}! Redirecting to Driver Portal...`;

            redirectPage =
                'driver-portal.html';
        }


        // ==========================================
        // ADMIN
        // ==========================================

        else {

            const params =
                new URLSearchParams(
                    window.location.search
                );


            redirectPage =
                params.get('redirect') ||
                'index.html';
        }


        // ==========================================
        // SUCCESS
        // ==========================================

        showAlert(
            welcomeText,
            false
        );


        setTimeout(() => {

            window.location.href =
                redirectPage;

        }, 600);


    } catch (error) {

        console.error(
            'Login error:',
            error
        );


        // ------------------------------------------
        // FETCH ERROR
        // ------------------------------------------

        if (
            error instanceof TypeError &&
            error.message === 'Failed to fetch'
        ) {

            showAlert(
                'Cannot connect to backend. Please check the Render backend and CORS configuration.'
            );

        } else {

            showAlert(
                error.message ||
                'Login failed.'
            );
        }


    } finally {

        loginBtn.disabled = false;


        const btnSpan2 =
            loginBtn.querySelector('span') ||
            loginBtn;


        btnSpan2.textContent =
            'Sign In';
    }
};


// ======================================================
// EVENT LISTENERS
// ======================================================

if (loginForm) {

    loginForm.addEventListener(
        'submit',
        handleLogin
    );

} else if (loginBtn) {

    loginBtn.addEventListener(
        'click',
        handleLogin
    );
}