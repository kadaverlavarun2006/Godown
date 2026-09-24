const mongoose = require('mongoose');

const invoiceProductSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true,
        immutable: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    deliveryDate: {
        type: Date,
        required: true
    },
    deliveryTime: {
        type: String,
        required: true
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Retailer',
        required: true
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    delivery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        required: true,
        unique: true,
        immutable: true
    },
    products: {
        type: [invoiceProductSchema],
        required: true
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PARTIAL', 'PAID'],
        default: 'PENDING'
    }
});

module.exports = mongoose.model('Invoice', invoiceSchema);