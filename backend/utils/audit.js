const AuditLog = require('../models/AuditLog');

const recordAudit = async({ user = 'system', action, entity, entityId, oldValue = null, newValue = null, reason = '', session = null }) => {
    const date = new Date();
    const audit = new AuditLog({
        user,
        action,
        entity,
        entityId: String(entityId),
        oldValue,
        newValue,
        reason,
        date,
        time: date.toLocaleTimeString('en-IN')
    });
    await audit.save(session ? { session } : undefined);
    return audit;
};

module.exports = recordAudit;