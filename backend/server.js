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

app.use(cors());
app.use(express.json());


// =========================
// PUBLIC AUTH ROUTES
// =========================

app.use('/api/auth', authRoutes);


// =========================
// HEALTH CHECK
// =========================

app.get('/api/health', (req, res) => {

    const databaseConnected =
        mongoose.connection.readyState === 1;

    res.json({
        status: 'success',
        backend: 'connected',
        database: databaseConnected ? 'connected' : 'disconnected'
    });
});


// =========================
// ADMIN ONLY ROUTES
// =========================

app.use('/api/dashboard', requireAdmin, dashboardRoutes);

app.use('/api/stock', requireAdmin, stockRoutes);

app.use('/api/drivers', requireAdmin, driverRoutes);

app.use('/api/vehicles', requireAdmin, vehicleRoutes);

app.use('/api/retailers', requireAdmin, retailerRoutes);

app.use('/api/reports', requireAdmin, reportRoutes);

app.use('/api/exports', requireAdmin, exportRoutes);

app.use('/api/audit-logs', requireAdmin, auditRoutes);


// =========================
// ROLE BASED ROUTES
// =========================

app.use(
    '/api/products',
    requireAdminOrRetailer,
    productRoutes
);

app.use(
    '/api/deliveries',
    requireAnyRole('ADMIN', 'RETAILER', 'DRIVER'),
    deliveryRoutes
);

app.use(
    '/api/invoices',
    requireAdminOrRetailer,
    invoiceRoutes
);


// =========================
// 404 API HANDLER
// =========================

app.use('/api/*splat', (req, res) => {

    res.status(404).json({
        status: 'error',
        message: 'API endpoint not found'
    });

});


// =========================
// ERROR HANDLER
// =========================

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

    res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });

});


// =========================
// START SERVER
// =========================

// Start listening immediately - don't block on DB
app.listen(port, () => {
    console.log(`LogEase backend is running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
});

// Connect to MongoDB with retry logic (non-blocking)
const connectWithRetry = async (retries = 5, delay = 3000) => {
    for (let i = 1; i <= retries; i++) {
        try {
            await connectDB();
            console.log('MongoDB connected successfully');
            return;
        } catch (error) {
            console.error(`MongoDB connection attempt ${i}/${retries} failed: ${error.message}`);
            if (i < retries) {
                console.log(`Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('All MongoDB connection attempts failed. The server is running but DB features will not work.');
                console.error('Please check your MONGO_URI and MongoDB Atlas Network Access settings.');
            }
        }
    }
};

connectWithRetry();