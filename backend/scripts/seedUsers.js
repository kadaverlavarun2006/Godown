require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Retailer = require('../models/Retailer');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Product = require('../models/Product');
const Delivery = require('../models/Delivery');

const seedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Seed ADMIN
        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@logease.com';
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
        const adminName = process.env.DEFAULT_ADMIN_NAME || 'LogEase Admin';

        let admin = await User.findOne({ email: adminEmail.toLowerCase() });
        if (admin) {
            console.log(`Admin account already exists: ${admin.email} (Role: ${admin.role})`);
            if (admin.role !== 'ADMIN') {
                admin.role = 'ADMIN';
                await admin.save();
                console.log(`Updated user role to ADMIN.`);
            }
        } else {
            admin = new User({
                name: adminName,
                email: adminEmail.toLowerCase(),
                password: adminPassword,
                role: 'ADMIN'
            });
            await admin.save();
            console.log(`Default ADMIN created successfully!`);
            console.log(`Email: ${adminEmail}`);
            console.log(`Password: ${adminPassword}`);
        }

        // 2. Seed RETAILER
        const retailerEmail = 'retailer@logease.com';
        const retailerPassword = 'retailer123';

        let retailerProfile = await Retailer.findOne({ shopName: 'City Supermarket' });
        if (!retailerProfile) {
            retailerProfile = await Retailer.create({
                shopName: 'City Supermarket',
                ownerName: 'Ramesh Gupta',
                phone: '9876543210',
                address: 'Shop #12, Market Complex',
                city: 'Hyderabad',
                gstNumber: '36ABCDE1234F1Z5',
                active: true
            });
            console.log('Created sample Retailer profile: City Supermarket');
        }

        let retailerUser = await User.findOne({ email: retailerEmail.toLowerCase() });
        if (retailerUser) {
            console.log(`Retailer user already exists: ${retailerUser.email}`);
            if (retailerUser.role !== 'RETAILER' || !retailerUser.retailer) {
                retailerUser.role = 'RETAILER';
                retailerUser.retailer = retailerProfile._id;
                await retailerUser.save();
                console.log('Updated user role to RETAILER and linked Retailer profile.');
            }
        } else {
            retailerUser = new User({
                name: 'Ramesh Gupta',
                email: retailerEmail.toLowerCase(),
                password: retailerPassword,
                role: 'RETAILER',
                retailer: retailerProfile._id
            });
            await retailerUser.save();
            console.log(`Default RETAILER created successfully!`);
            console.log(`Email: ${retailerEmail}`);
            console.log(`Password: ${retailerPassword}`);
        }

        // 3. Seed DRIVER
        const driverEmail = 'driver@logease.com';
        const driverPassword = 'driver123';

        let driverProfile = await Driver.findOne({ name: 'Suresh Kumar' });
        if (!driverProfile) {
            driverProfile = await Driver.create({
                name: 'Suresh Kumar',
                phone: '9876543211',
                licenseNumber: 'DL09-2023-8899',
                active: true
            });
            console.log('Created sample Driver profile: Suresh Kumar');
        }

        let vehicleDoc = await Vehicle.findOne({ vehicleNumber: 'TS09AB1234' });
        if (!vehicleDoc) {
            vehicleDoc = await Vehicle.create({
                vehicleNumber: 'TS09AB1234',
                vehicleType: 'VAN',
                capacity: 1200,
                assignedDriver: driverProfile._id,
                active: true
            });
            console.log('Created sample Vehicle: TS09AB1234');
        } else if (!vehicleDoc.assignedDriver) {
            vehicleDoc.assignedDriver = driverProfile._id;
            await vehicleDoc.save();
        }

        let driverUser = await User.findOne({ email: driverEmail.toLowerCase() });
        if (driverUser) {
            console.log(`Driver user already exists: ${driverUser.email}`);
            if (driverUser.role !== 'DRIVER' || !driverUser.driver) {
                driverUser.role = 'DRIVER';
                driverUser.driver = driverProfile._id;
                await driverUser.save();
                console.log('Updated user role to DRIVER and linked Driver profile.');
            }
        } else {
            driverUser = new User({
                name: 'Suresh Kumar',
                email: driverEmail.toLowerCase(),
                password: driverPassword,
                role: 'DRIVER',
                driver: driverProfile._id
            });
            await driverUser.save();
            console.log(`Default DRIVER created successfully!`);
            console.log(`Email: ${driverEmail}`);
            console.log(`Password: ${driverPassword}`);
        }

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error seeding users:', error.message);
        process.exit(1);
    }
};

seedUsers();
