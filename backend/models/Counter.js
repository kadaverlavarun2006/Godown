const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: String,
    sequence: {
        type: Number,
        default: 0
    }
}, {
    collection: 'counters'
});

module.exports = mongoose.model('Counter', counterSchema);