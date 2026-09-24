const mongoose = require('mongoose');

const retailerSchema = new mongoose.Schema({
    shopName: {
        type: String,
        required: true,
        trim: true
    },
    ownerName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    gstNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    active: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Retailer', retailerSchema);