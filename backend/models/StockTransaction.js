const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
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
    supplier: {
        type: String,
        trim: true
    },
    invoiceNumber: {
        type: String,
        trim: true
    },
    batchNumber: {
        type: String,
        trim: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    createdBy: {
        type: String,
        required: true,
        trim: true
    },
    transactionType: {
        type: String,
        enum: ['IN', 'OUT'],
        default: 'IN',
        immutable: true
    },
    delivery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        default: null,
        immutable: true
    }
}, {
    collection: 'stocktransactions'
});

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);