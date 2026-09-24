const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Retailer = require('../models/Retailer');
const Driver = require('../models/Driver');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authentication required. Missing or invalid authorization header.' });
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'logease_jwt_secret_key_admin_2026';
        const decoded = jwt.verify(token, secret);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User belonging to this token no longer exists.' });
        }

        // If user is a RETAILER and retailer reference is not set, resolve or link it
        if (user.role === 'RETAILER') {
            if (!user.retailer) {
                let retailerDoc = await Retailer.findOne({
                    $or: [
                        { ownerName: new RegExp(`^${user.name}$`, 'i') },
                        { shopName: new RegExp(`^${user.name}`, 'i') }
                    ]
                });

                if (!retailerDoc) {
                    // Create an initial retailer profile for this user
                    retailerDoc = await Retailer.create({
                        shopName: `${user.name}'s Shop`,
                        ownerName: user.name,
                        phone: '9876543210',
                        address: 'Retailer Address',
                        city: 'Local',
                        gstNumber: `GST${Date.now().toString().slice(-10)}`
                    });
                }
                user.retailer = retailerDoc._id;
                await User.findByIdAndUpdate(user._id, { retailer: retailerDoc._id });
            }
            req.retailerId = user.retailer;
        }

        // If user is a DRIVER and driver reference is not set, resolve or link it
        if (user.role === 'DRIVER') {
            if (!user.driver) {
                let driverDoc = await Driver.findOne({
                    $or: [
                        { name: new RegExp(`^${user.name}$`, 'i') }
                    ]
                });

                if (!driverDoc) {
                    // Create an initial driver profile for this user
                    driverDoc = await Driver.create({
                        name: user.name,
                        phone: '9876543211',
                        licenseNumber: `DL${Date.now().toString().slice(-8)}`,
                        active: true
                    });
                }
                user.driver = driverDoc._id;
                await User.findByIdAndUpdate(user._id, { driver: driverDoc._id });
            }
            req.driverId = user.driver;
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
        return res.status(500).json({ message: 'Authentication error', error: error.message });
    }
};

const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Access denied. ADMIN role required.' });
    }
    next();
};

const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: `Access denied. Requires role: ${roles.join(' or ')}.` });
    }
    next();
};

const requireAdmin = [authenticate, authorizeAdmin];
const requireAdminOrRetailer = [authenticate, authorizeRoles('ADMIN', 'RETAILER')];
const requireAdminOrDriver = [authenticate, authorizeRoles('ADMIN', 'DRIVER')];
const requireAnyRole = (...roles) => [authenticate, authorizeRoles(...roles)];

module.exports = {
    authenticate,
    authorizeAdmin,
    authorizeRoles,
    requireAdmin,
    requireAdminOrRetailer,
    requireAdminOrDriver,
    requireAnyRole
};


