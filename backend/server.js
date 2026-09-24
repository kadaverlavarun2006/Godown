require('dotenv').config();

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');

const connectDB = require('./config/db');

const auditRoutes = require('./routes/auditRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const driverRoutes = require('./routes/driverRoutes');
const exportRoutes = require('./routes/exportRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const productRoutes = require('./routes/productRoutes');
const reportRoutes = require('./routes/reportRoutes');
const retailerRoutes = require('./routes/retailerRoutes');
const stockRoutes = require('./routes/stockRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');

const authRoutes = require('./routes/authRoutes');

const {
    requireAdmin,
    requireAdminOrRetailer,
    requireAnyRole
} = require('./middleware/auth');

const app = express();

const port = process.env.PORT || 5000;


// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:64713',
    'https://godown-kappa.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {

        // Allow requests without an origin
        // Example: Postman, server-to-server requests
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.log('Blocked CORS origin:', origin);

        return callback(
            new Error('Not allowed by CORS')
        );
    },

    credentials: true,

    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],

    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ]
}));


// Handle CORS preflight requests
app.options('*', cors());


// ======================================================
// BODY PARSER
// ======================================================

app.use(express.json());


// ======================================================
// PUBLIC AUTH ROUTES
// ======================================================

app.use('/api/auth', authRoutes);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/api/health', (req, res) => {

    const databaseConnected =
        mongoose.connection.readyState === 1;

    res.json({
        status: 'success',
        backend: 'connected',
        database: databaseConnected
            ? 'connected'
            : 'disconnected'
    });
});


// ======================================================
// ADMIN ONLY ROUTES
// ======================================================

app.use(
    '/api/dashboard',
    requireAdmin,
    dashboardRoutes
);

app.use(
    '/api/stock',
    requireAdmin,
    stockRoutes
);

app.use(
    '/api/drivers',
    requireAdmin,
    driverRoutes
);

app.use(
    '/api/vehicles',
    requireAdmin,
    vehicleRoutes
);

app.use(
    '/api/retailers',
    requireAdmin,
    retailerRoutes
);

app.use(
    '/api/reports',
    requireAdmin,
    reportRoutes
);

app.use(
    '/api/exports',
    requireAdmin,
    exportRoutes
);

app.use(
    '/api/audit-logs',
    requireAdmin,
    auditRoutes
);


// ======================================================
// ROLE BASED ROUTES
// ======================================================

app.use(
    '/api/products',
    requireAdminOrRetailer,
    productRoutes
);

app.use(
    '/api/deliveries',
    requireAnyRole(
        'ADMIN',
        'RETAILER',
        'DRIVER'
    ),
    deliveryRoutes
);

app.use(
    '/api/invoices',
    requireAdminOrRetailer,
    invoiceRoutes
);


// ======================================================
// 404 API HANDLER
// ======================================================

app.use('/api/*splat', (req, res) => {

    res.status(404).json({
        status: 'error',
        message: 'API endpoint not found'
    });
});


// ======================================================
// ERROR HANDLER
// ======================================================

app.use((error, req, res, next) => {

    console.error('Server Error:', error);

    if (
        error instanceof SyntaxError &&
        error.status === 400 &&
        error.body
    ) {
        return res.status(400).json({
            status: 'error',
            message: 'Request body must be valid JSON'
        });
    }

    // CORS error
    if (error.message === 'Not allowed by CORS') {
        return res.status(403).json({
            status: 'error',
            message: 'CORS origin not allowed'
        });
    }

    res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
});


// ======================================================
// START SERVER
// ======================================================

app.listen(
    port,
    '0.0.0.0',
    () => {
        console.log(
            `LogEase backend is running on port ${port}`
        );
    }
);


// ======================================================
// MONGODB CONNECTION WITH RETRY
// ======================================================

const connectWithRetry = async (
    retries = 5,
    delay = 3000
) => {

    for (let i = 1; i <= retries; i++) {

        try {

            await connectDB();

            console.log(
                'MongoDB connected successfully'
            );

            return;

        } catch (error) {

            console.error(
                `MongoDB connection attempt ${i}/${retries} failed: ${error.message}`
            );

            if (i < retries) {

                console.log(
                    `Retrying in ${delay / 1000}s...`
                );

                await new Promise(
                    resolve => setTimeout(
                        resolve,
                        delay
                    )
                );

            } else {

                console.error(
                    'All MongoDB connection attempts failed.'
                );

                console.error(
                    'The server is running but DB features will not work.'
                );

                console.error(
                    'Check MONGO_URI and MongoDB Atlas Network Access.'
                );
            }
        }
    }
};

connectWithRetry();