const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    packSize: {
        type: String,
        required: true,
        trim: true
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    availableStock: {
        type: Number,
        default: 0,
        min: 0
    },
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);