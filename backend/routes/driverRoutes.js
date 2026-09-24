const express = require('express');
const Driver = require('../models/Driver');

const router = express.Router();

router.get('/', async(req, res) => {
    try {
        const drivers = await Driver.find().sort({ createdAt: -1 });
        res.json(drivers);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch drivers' });
    }
});

router.post('/', async(req, res) => {
    try {
        const driver = await Driver.create(req.body);
        res.status(201).json(driver);
    } catch (error) {
        const message = error.code === 11000 ? 'License number already exists' : 'Unable to create driver';
        res.status(400).json({ message, error: error.message });
    }
});

router.put('/:id', async(req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            req.body, { new: true, runValidators: true }
        );

        if (!driver) {
            return res.status(404).json({ message: 'Driver not found' });
        }

        res.json(driver);
    } catch (error) {
        const message = error.code === 11000 ? 'License number already exists' : 'Unable to update driver';
        res.status(400).json({ message, error: error.message });
    }
});

router.patch('/:id/status', async(req, res) => {
    try {
        if (typeof req.body.active !== 'boolean') {
            return res.status(400).json({ message: 'Active must be true or false' });
        }

        const driver = await Driver.findByIdAndUpdate(
            req.params.id, { active: req.body.active }, { new: true, runValidators: true }
        );

        if (!driver) {
            return res.status(404).json({ message: 'Driver not found' });
        }

        res.json(driver);
    } catch (error) {
        res.status(400).json({ message: 'Unable to update driver status', error: error.message });
    }
});

module.exports = router;