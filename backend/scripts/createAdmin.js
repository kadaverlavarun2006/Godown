require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

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

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error creating admin:', error.message);
        process.exit(1);
    }
};

seedAdmin();
