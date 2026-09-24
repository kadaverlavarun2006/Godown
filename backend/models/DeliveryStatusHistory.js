const mongoose = require('mongoose');

const deliveryStatusHistorySchema = new mongoose.Schema({
    delivery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ASSIGNED', 'LOADED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED'],
        required: true
    },
    notes: {
        type: String,
        default: ''
    },
    changedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('DeliveryStatusHistory', deliveryStatusHistorySchema);