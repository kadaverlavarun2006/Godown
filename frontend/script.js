// Render backend URL
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://godown-backend-b3e9.onrender.com'; // change this




const todayDate = document.querySelector('#today-date');
const backendStatus = document.querySelector('#backend-status');
const backendStatusContainer = document.querySelector('.backend-status');

let dashboardData = null;


// =========================
// TODAY'S DATE
// =========================

todayDate.textContent = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
}).format(new Date());


// =========================
// BACKEND + DATABASE STATUS
// =========================

fetch(`${API_URL}/api/health`)
    .then((response) => {

        if (!response.ok) {
            throw new Error('Health check failed');
        }

        return response.json();

    })
    .then((health) => {

        console.log('Health:', health);

        const connected =
            health.backend === 'connected' &&
            health.database === 'connected';

        if (connected) {

            backendStatus.textContent = 'Connected';

            backendStatus.classList.add('is-connected');
            backendStatus.classList.remove('is-disconnected');

            backendStatusContainer.classList.add('is-connected');
            backendStatusContainer.classList.remove('is-disconnected');

        } else {

            backendStatus.textContent =
                'Database Disconnected';

            backendStatus.classList.add('is-disconnected');
            backendStatus.classList.remove('is-connected');

            backendStatusContainer.classList.add('is-disconnected');
            backendStatusContainer.classList.remove('is-connected');

        }

    })
    .catch((error) => {

        console.error('Health check error:', error);

        backendStatus.textContent = 'Backend Disconnected';

        backendStatus.classList.add('is-disconnected');
        backendStatus.classList.remove('is-connected');

        backendStatusContainer.classList.add('is-disconnected');
        backendStatusContainer.classList.remove('is-connected');

    });


// =========================
// NUMBER FORMATTING
// =========================

const formatNumber = (value) => {

    return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2
    }).format(value);

};


const formatMoney = (value) => {

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(value);

};


// =========================
// SET DASHBOARD METRIC
// =========================

const setMetric = (id, value, suffix = '') => {

    const element = document.querySelector(`#${id}`);

    if (!element) return;

    element.innerHTML =
        `${value} <span>${suffix}</span>`;

};


// =========================
// PREPARE CANVAS
// =========================

const prepareCanvas = (canvas) => {

    const ratio = window.devicePixelRatio || 1;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const context = canvas.getContext('2d');

    context.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );

    return {
        context,
        width,
        height
    };

};


// =========================
// BAR CHART
// =========================

const drawBarChart = (canvas, items) => {

    if (!canvas) return;

    const {
        context,
        width,
        height
    } = prepareCanvas(canvas);

    context.clearRect(
        0,
        0,
        width,
        height
    );

    if (!items || !items.length) {

        context.fillStyle = '#6d7a80';
        context.font = '13px Trebuchet MS';

        context.fillText(
            'No distribution data yet',
            18,
            height / 2
        );

        return;
    }

    const left = Math.min(
        150,
        Math.max(82, width * 0.28)
    );

    const top = 12;

    const rowHeight = Math.max(
        28,
        Math.min(
            52,
            (height - 24) / items.length
        )
    );

    const max = Math.max(
        ...items.map(
            (item) => Number(item.quantity) || 0
        ),
        1
    );

    items.forEach((item, index) => {

        const y =
            top + index * rowHeight;

        const label =
            item.label.length > 20
                ? `${item.label.slice(0, 18)}...`
                : item.label;

        context.fillStyle = '#6d7a80';
        context.font = '12px Trebuchet MS';

        context.fillText(
            label,
            0,
            y + 17
        );

        context.fillStyle = '#2f806a';

        context.fillRect(
            left,
            y + 5,
            (width - left - 44) *
            ((Number(item.quantity) || 0) / max),
            16
        );

        context.fillStyle = '#17232b';

        context.fillText(
            formatNumber(item.quantity),
            width - 38,
            y + 17
        );

    });

};


// =========================
// LINE CHART
// =========================

const drawLineChart = (canvas, items) => {

    if (!canvas) return;

    const {
        context,
        width,
        height
    } = prepareCanvas(canvas);

    context.clearRect(
        0,
        0,
        width,
        height
    );

    if (!items || !items.length) {

        context.fillStyle = '#6d7a80';
        context.font = '13px Trebuchet MS';

        context.fillText(
            'No sales data yet',
            18,
            height / 2
        );

        return;
    }

    const padding = {
        top: 18,
        right: 18,
        bottom: 38,
        left: 38
    };

    const chartWidth =
        width -
        padding.left -
        padding.right;

    const chartHeight =
        height -
        padding.top -
        padding.bottom;

    const max = Math.max(
        ...items.map(
            (item) => Number(item.quantity) || 0
        ),
        1
    );

    const points = items.map(
        (item, index) => ({

            x:
                padding.left +
                (
                    chartWidth *
                    index /
                    Math.max(
                        items.length - 1,
                        1
                    )
                ),

            y:
                padding.top +
                chartHeight -
                (
                    chartHeight *
                    (Number(item.quantity) || 0) /
                    max
                ),

            item

        })
    );


    // Bottom line

    context.strokeStyle = '#e2e9e5';
    context.lineWidth = 1;

    context.beginPath();

    context.moveTo(
        padding.left,
        padding.top + chartHeight
    );

    context.lineTo(
        width - padding.right,
        padding.top + chartHeight
    );

    context.stroke();


    // Main line

    context.strokeStyle = '#2f806a';
    context.lineWidth = 3;

    context.beginPath();

    points.forEach(
        (point, index) => {

            if (index === 0) {

                context.moveTo(
                    point.x,
                    point.y
                );

            } else {

                context.lineTo(
                    point.x,
                    point.y
                );

            }

        }
    );

    context.stroke();


    // Points

    points.forEach((point) => {

        context.fillStyle = '#2f806a';

        context.beginPath();

        context.arc(
            point.x,
            point.y,
            4,
            0,
            Math.PI * 2
        );

        context.fill();


        context.fillStyle = '#6d7a80';

        context.font = '11px Trebuchet MS';

        context.textAlign = 'center';

        context.fillText(
            point.item.label,
            point.x,
            height - 14
        );


        context.fillStyle = '#17232b';

        context.fillText(
            formatNumber(point.item.quantity),
            point.x,
            Math.max(
                12,
                point.y - 10
            )
        );

    });

    context.textAlign = 'left';

};


// =========================
// RENDER DASHBOARD
// =========================

const renderDashboard = () => {

    if (!dashboardData) return;

    const {
        cards = {},
        charts = {}
    } = dashboardData;


    setMetric(
        'current-stock',
        formatNumber(cards.currentStock || 0),
        'units'
    );


    setMetric(
        'todays-distribution',
        formatNumber(cards.todaysDistribution || 0),
        'units'
    );


    setMetric(
        'todays-bills',
        formatNumber(cards.todaysBills || 0),
        'invoices'
    );


    setMetric(
        'pending-deliveries',
        formatNumber(cards.pendingDeliveries || 0),
        'shipments'
    );


    const salesElement =
        document.querySelector('#todays-sales');

    if (salesElement) {

        salesElement.textContent =
            formatMoney(cards.todaysSales || 0);

    }


    setMetric(
        'returned-stock',
        formatNumber(cards.returnedStock || 0),
        'units'
    );


    setMetric(
        'damaged-stock',
        formatNumber(cards.damagedStock || 0),
        'units'
    );


    drawLineChart(
        document.querySelector('#last-seven-chart'),
        charts.lastSevenDays || []
    );


    drawBarChart(
        document.querySelector('#product-chart'),
        charts.productDistribution || []
    );


    drawBarChart(
        document.querySelector('#driver-chart'),
        charts.driverDistribution || []
    );

};


// =========================
// DASHBOARD DATA
// =========================

const loadDashboard = async () => {

    try {

        const token = localStorage.getItem('logease_token');

        if (!token) {

            console.warn(
                'No login token found. Dashboard requires ADMIN login.'
            );

            document.querySelectorAll(
                '.card-value'
            ).forEach((element) => {

                element.textContent = 'Login Required';

            });

            return;
        }


        const response = await fetch(
            `${API_URL}/api/dashboard/summary`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );


        if (response.status === 401) {

            console.error(
                'Authentication required.'
            );

            document.querySelectorAll(
                '.card-value'
            ).forEach((element) => {

                element.textContent = 'Login Required';

            });

            return;
        }


        if (response.status === 403) {

            console.error(
                'Admin access required.'
            );

            document.querySelectorAll(
                '.card-value'
            ).forEach((element) => {

                element.textContent = 'Admin Only';

            });

            return;
        }


        if (!response.ok) {

            throw new Error(
                'Dashboard data unavailable'
            );

        }


        const data = await response.json();

        console.log(
            'Dashboard data:',
            data
        );

        dashboardData = data;

        renderDashboard();

    } catch (error) {

        console.error(
            'Dashboard error:',
            error
        );

        document.querySelectorAll(
            '.card-value'
        ).forEach((element) => {

            element.textContent = 'Unavailable';

        });

    }

};


// Load dashboard

loadDashboard();


// =========================
// RESIZE
// =========================

window.addEventListener(
    'resize',
    () => {

        if (dashboardData) {
            renderDashboard();
        }

    }
);