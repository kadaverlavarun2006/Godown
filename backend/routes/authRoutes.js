const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Retailer = require('../models/Retailer');
const Driver = require('../models/Driver');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const signToken = (user) => {
    const secret = process.env.JWT_SECRET || 'logease_jwt_secret_key_admin_2026';
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
            retailer: user.retailer?._id || user.retailer || null,
            driver: user.driver?._id || user.driver || null
        },
        secret,
        { expiresIn: '7d' }
    );
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, shopName, phone, address, city, gstNumber } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const validRoles = ['ADMIN', 'RETAILER', 'DRIVER'];
        const userRole = role && validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : 'ADMIN';

        let retailerId = req.body.retailerId || null;

        if (userRole === 'RETAILER' && !retailerId) {
            // Check if retailer with this owner name already exists
            let retailerDoc = await Retailer.findOne({
                $or: [
                    { ownerName: new RegExp(`^${name.trim()}$`, 'i') },
                    { shopName: new RegExp(`^${shopName || name.trim()}`, 'i') }
                ]
            });

            if (!retailerDoc) {
                retailerDoc = await Retailer.create({
                    shopName: shopName?.trim() || `${name.trim()}'s Store`,
                    ownerName: name.trim(),
                    phone: phone?.trim() || '9876543210',
                    address: address?.trim() || 'Commercial Market',
                    city: city?.trim() || 'Central',
                    gstNumber: gstNumber?.trim() || `GST${Date.now().toString().slice(-10)}`
                });
            }
            retailerId = retailerDoc._id;
        }

        const user = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: userRole,
            retailer: retailerId
        });

        await user.save();
        await user.populate('retailer');

        const token = signToken(user);

        return res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                retailer: user.retailer
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to register user', error: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                message: 'Database is connecting or unavailable. Please check MongoDB Atlas IP Whitelist (Network Access) or database connection.'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .populate('retailer')
            .populate('driver');

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // If retailer user without retailer reference, associate one
        if (user.role === 'RETAILER' && !user.retailer) {
            let retailerDoc = await Retailer.findOne({
                $or: [
                    { ownerName: new RegExp(`^${user.name}$`, 'i') },
                    { shopName: new RegExp(`^${user.name}`, 'i') }
                ]
            });
            if (!retailerDoc) {
                retailerDoc = await Retailer.create({
                    shopName: `${user.name}'s Shop`,
                    ownerName: user.name,
                    phone: '9876543210',
                    address: 'Market Street',
                    city: 'Local',
                    gstNumber: `GST${Date.now().toString().slice(-10)}`
                });
            }
            user.retailer = retailerDoc;
            await User.findByIdAndUpdate(user._id, { retailer: retailerDoc._id });
        }

        // If driver user without driver reference, associate one
        if (user.role === 'DRIVER' && !user.driver) {
            let driverDoc = await Driver.findOne({
                $or: [
                    { name: new RegExp(`^${user.name}$`, 'i') }
                ]
            });
            if (!driverDoc) {
                driverDoc = await Driver.create({
                    name: user.name,
                    phone: '9876543211',
                    licenseNumber: `DL${Date.now().toString().slice(-8)}`,
                    active: true
                });
            }
            user.driver = driverDoc;
            await User.findByIdAndUpdate(user._id, { driver: driverDoc._id });
        }

        const token = signToken(user);

        return res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                retailer: user.retailer,
                driver: user.driver
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to log in: ' + error.message, error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    const user = await User.findById(req.user._id)
        .select('-password')
        .populate('retailer')
        .populate('driver');

    return res.json({
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            retailer: user.retailer,
            driver: user.driver
        }
    });
});

module.exports = router;
