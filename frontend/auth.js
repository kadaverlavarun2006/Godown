// LogEase Authentication & Role-Based Access Control Utility (ADMIN & RETAILER)

const AUTH_CONFIG = {
    apiBase: window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api',
    tokenKey: 'logease_token',
    userKey: 'logease_user'
};


const getToken = () => localStorage.getItem(AUTH_CONFIG.tokenKey);

const getUser = () => {
    try {
        const raw = localStorage.getItem(AUTH_CONFIG.userKey);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const setAuth = (token, user) => {
    localStorage.setItem(AUTH_CONFIG.tokenKey, token);
    localStorage.setItem(AUTH_CONFIG.userKey, JSON.stringify(user));
};

const clearAuth = () => {
    localStorage.removeItem(AUTH_CONFIG.tokenKey);
    localStorage.removeItem(AUTH_CONFIG.userKey);
};

const logout = () => {
    clearAuth();
    window.location.href = 'login.html';
};

const isAdmin = () => {
    const user = getUser();
    return !!(user && user.role === 'ADMIN');
};

const isRetailer = () => {
    const user = getUser();
    return !!(user && user.role === 'RETAILER');
};

const isDriver = () => {
    const user = getUser();
    return !!(user && user.role === 'DRIVER');
};

// Pages configuration
const RETAILER_ALLOWED_PAGES = ['retailer-portal.html', 'products.html'];
const DRIVER_ALLOWED_PAGES = ['driver-portal.html'];
const ADMIN_RESTRICTED_PAGES_FOR_RETAILER = [
    'index.html',
    'stock.html',
    'drivers.html',
    'vehicles.html',
    'retailers.html',
    'deliveries.html',
    'invoices.html',
    'reports.html',
    'audit-logs.html',
    'driver-portal.html'
];
const RESTRICTED_PAGES_FOR_DRIVER = [
    'index.html',
    'stock.html',
    'drivers.html',
    'vehicles.html',
    'retailers.html',
    'deliveries.html',
    'invoices.html',
    'reports.html',
    'audit-logs.html',
    'products.html',
    'retailer-portal.html'
];

// Enforce role-based page routing
const enforceAccessControl = () => {
    const currentPage = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';
    const isLoginPage = currentPage === 'login.html';

    const token = getToken();
    const user = getUser();

    if (!isLoginPage) {
        if (!token || !user) {
            const redirectParam = encodeURIComponent(currentPage + window.location.search);
            window.location.href = `login.html?redirect=${redirectParam}`;
            return false;
        }

        // Retailer restriction: block access to all admin-only pages
        if (user.role === 'RETAILER') {
            if (ADMIN_RESTRICTED_PAGES_FOR_RETAILER.includes(currentPage) || !RETAILER_ALLOWED_PAGES.includes(currentPage)) {
                console.warn('Retailer attempted to access restricted admin page. Redirecting to retailer portal.');
                window.location.href = 'retailer-portal.html';
                return false;
            }
        }

        // Driver restriction: block access to admin and retailer pages
        if (user.role === 'DRIVER') {
            if (RESTRICTED_PAGES_FOR_DRIVER.includes(currentPage) || !DRIVER_ALLOWED_PAGES.includes(currentPage)) {
                console.warn('Driver attempted to access restricted page. Redirecting to driver portal.');
                window.location.href = 'driver-portal.html';
                return false;
            }
        }
    } else {
        if (token && user) {
            // Already logged in, redirect to appropriate home
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get('redirect');

            if (user.role === 'RETAILER') {
                if (redirect && RETAILER_ALLOWED_PAGES.includes(redirect.split('?')[0])) {
                    window.location.href = redirect;
                } else {
                    window.location.href = 'retailer-portal.html';
                }
                return false;
            } else if (user.role === 'DRIVER') {
                window.location.href = 'driver-portal.html';
                return false;
            } else if (user.role === 'ADMIN') {
                window.location.href = redirect || 'index.html';
                return false;
            }
        }
    }
    return true;
};

// Global fetch interceptor to attach JWT token and catch 401/403
const setupFetchInterceptor = () => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
        let [resource, config] = args;
        config = config || {};
        config.headers = config.headers ? new Headers(config.headers) : new Headers();

        const url = typeof resource === 'string' ? resource : resource?.url || '';
        const isApiCall = url.includes('/api/');
        const isAuthCall = url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/health');

        if (isApiCall && !isAuthCall) {
            const token = getToken();
            if (token && !config.headers.has('Authorization')) {
                config.headers.set('Authorization', `Bearer ${token}`);
            }
        }

        try {
            const response = await originalFetch(resource, config);

            if (response.status === 401 && isApiCall && !isAuthCall) {
                console.warn('Session expired or unauthorized. Redirecting to login.');
                clearAuth();
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
            } else if (response.status === 403) {
                console.error('Access denied: Insufficient role permissions.');
            }

            return response;
        } catch (error) {
            throw error;
        }
    };
};

// Customize navigation and UI based on user role
const renderHeaderAndUI = () => {
    const user = getUser();
    if (!user) return;

    const nav = document.querySelector('.topbar-nav');
    const currentPage = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';

    if (nav) {
        // If Retailer, customize the topbar links so Admin links are not shown
        if (user.role === 'RETAILER') {
            const todayFormatted = new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            nav.innerHTML = `
                <a class="nav-link ${currentPage === 'retailer-portal.html' ? 'active' : ''}" href="retailer-portal.html">Retailer Portal</a>
                <a class="nav-link ${currentPage === 'products.html' ? 'active' : ''}" href="products.html">Products</a>
                <div class="header-date">
                    <span class="date-label">Today</span>
                    <time id="today-date">${todayFormatted}</time>
                </div>
            `;
        }

        // If Driver, customize the topbar links so Admin and Retailer links are not shown
        if (user.role === 'DRIVER') {
            const todayFormatted = new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            nav.innerHTML = `
                <a class="nav-link ${currentPage === 'driver-portal.html' ? 'active' : ''}" href="driver-portal.html">Driver Portal</a>
                <div class="header-date">
                    <span class="date-label">Today</span>
                    <time id="today-date">${todayFormatted}</time>
                </div>
            `;
        }

        // Render user badge if not already present
        if (!document.querySelector('#user-header-pill')) {
            const badge = document.createElement('div');
            badge.id = 'user-header-pill';
            const roleClass = user.role === 'RETAILER' ? 'retailer-pill' : (user.role === 'DRIVER' ? 'driver-pill' : '');
            const badgeRoleClass = user.role === 'RETAILER' ? 'role-retailer' : (user.role === 'DRIVER' ? 'role-driver' : '');

            badge.className = `admin-header-pill ${roleClass}`;
            badge.innerHTML = `
                <span class="role-badge ${badgeRoleClass}" title="${user.role}">${user.role}</span>
                <span class="admin-name" title="${user.email || ''}">${user.name || 'User'}</span>
                <button id="logout-button" class="btn-logout" type="button" title="Sign out of LogEase">Sign Out</button>
            `;

            nav.appendChild(badge);

            const logoutBtn = badge.querySelector('#logout-button');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    logout();
                });
            }
        }
    }

    // If on products.html and user is a RETAILER, hide admin management form
    if (currentPage === 'products.html' && user.role === 'RETAILER') {
        const productFormSection = document.querySelector('#product-form')?.closest('section');
        if (productFormSection) {
            productFormSection.style.display = 'none';
        }
        // Change eyebrow / header
        const eyebrow = document.querySelector('.eyebrow');
        if (eyebrow) eyebrow.textContent = 'Retailer Catalog';
        const pageTitle = document.querySelector('#page-title');
        if (pageTitle) pageTitle.textContent = 'Available Products';

        // Add a style tag to hide edit/delete action columns for retailers
        const style = document.createElement('style');
        style.textContent = `
            #product-table th:last-child,
            #product-table td:last-child {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
};

// Execute access check immediately
enforceAccessControl();
setupFetchInterceptor();

// Render header when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeaderAndUI);
} else {
    renderHeaderAndUI();
}
