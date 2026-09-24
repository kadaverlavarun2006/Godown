const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    vehicleNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    vehicleType: {
        type: String,
        required: true,
        trim: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 0
    },
    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        default: null
    },
    active: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);