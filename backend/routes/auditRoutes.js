const express = require('express');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

router.get('/', async(req, res) => {
    try {
        const filter = {};
        if (req.query.action) filter.action = req.query.action;
        if (req.query.entity) filter.entity = req.query.entity;
        if (req.query.user) filter.user = { $regex: req.query.user, $options: 'i' };
        if (req.query.from || req.query.to) {
            filter.date = {};
            if (req.query.from) filter.date.$gte = new Date(req.query.from);
            if (req.query.to) {
                const to = new Date(req.query.to);
                to.setHours(23, 59, 59, 999);
                filter.date.$lte = to;
            }
        }

        const logs = await AuditLog.find(filter).sort({ date: -1, _id: -1 }).limit(500);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch audit logs' });
    }
});

module.exports = router;