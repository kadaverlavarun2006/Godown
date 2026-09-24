const express = require('express');
const Retailer = require('../models/Retailer');

const router = express.Router();

router.get('/', async(req, res) => {
    try {
        const retailers = await Retailer.find().sort({ shopName: 1 });
        res.json(retailers);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch retailers' });
    }
});

router.post('/', async(req, res) => {
    try {
        const retailer = await Retailer.create(req.body);
        res.status(201).json(retailer);
    } catch (error) {
        const message = error.code === 11000 ? 'GST number already exists' : 'Unable to create retailer';
        res.status(400).json({ message, error: error.message });
    }
});

router.put('/:id', async(req, res) => {
    try {
        const retailer = await Retailer.findByIdAndUpdate(
            req.params.id,
            req.body, { new: true, runValidators: true }
        );

        if (!retailer) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        res.json(retailer);
    } catch (error) {
        const message = error.code === 11000 ? 'GST number already exists' : 'Unable to update retailer';
        res.status(400).json({ message, error: error.message });
    }
});

router.patch('/:id/status', async(req, res) => {
    try {
        if (typeof req.body.active !== 'boolean') {
            return res.status(400).json({ message: 'Active must be true or false' });
        }

        const retailer = await Retailer.findByIdAndUpdate(
            req.params.id, { active: req.body.active }, { new: true, runValidators: true }
        );

        if (!retailer) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        res.json(retailer);
    } catch (error) {
        res.status(400).json({ message: 'Unable to update retailer status', error: error.message });
    }
});

module.exports = router;