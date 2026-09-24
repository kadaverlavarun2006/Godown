const mongoose = require('mongoose');

const deliveryProductSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0.0001
    },
    loadedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    deliveredQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    returnedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    damagedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    returnReason: {
        type: String,
        default: ''
    }
}, { _id: false });

const deliverySchema = new mongoose.Schema({
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: false,
        default: null
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: false,
        default: null
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Retailer',
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ASSIGNED', 'LOADED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED'],
        default: 'PENDING'
    },
    products: {
        type: [deliveryProductSchema],
        required: true,
        validate: {
            validator: (products) => products.length > 0,
            message: 'At least one product is required'
        }
    },
    loadedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    deliveredQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    returnedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    damagedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    returnReason: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Delivery', deliverySchema);