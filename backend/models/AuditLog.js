const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true,
        trim: true
    },
    action: {
        type: String,
        required: true,
        trim: true,
        immutable: true,
        validate: {
            validator: (value) => typeof value === 'string' && value.trim().length > 0,
            message: 'Audit action is required'
        }
    },
    entity: {
        type: String,
        required: true,
        immutable: true
    },
    entityId: {
        type: String,
        required: true,
        immutable: true
    },
    oldValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
        immutable: true
    },
    newValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
        immutable: true
    },
    reason: {
        type: String,
        trim: true,
        default: ''
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
        immutable: true
    },
    time: {
        type: String,
        required: true,
        immutable: true
    }
}, {
    collection: 'auditlogs',
    timestamps: false
});

auditLogSchema.pre('findOneAndUpdate', () => {
    throw new Error('Audit logs are append-only');
});

auditLogSchema.pre('updateOne', () => {
    throw new Error('Audit logs are append-only');
});

auditLogSchema.pre('deleteOne', () => {
    throw new Error('Audit logs cannot be deleted');
});

auditLogSchema.pre('deleteMany', () => {
    throw new Error('Audit logs cannot be deleted');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);