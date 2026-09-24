const express = require('express');
const Product = require('../models/Product');
const { authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async(req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch products' });
    }
});

router.post('/', authorizeAdmin, async(req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: 'Unable to create product', error: error.message });
    }
});

router.put('/:id', authorizeAdmin, async(req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body, { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(400).json({ message: 'Unable to update product', error: error.message });
    }
});

router.delete('/:id', authorizeAdmin, async(req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id, { active: false }, { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(400).json({ message: 'Unable to deactivate product', error: error.message });
    }
});

module.exports = router;