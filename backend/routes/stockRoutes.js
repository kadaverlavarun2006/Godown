const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const recordAudit = require('../utils/audit');

const router = express.Router();

const buildTransactionFilter = (query) => {
    const filter = { transactionType: { $in: ['IN', 'OUT'] } };

    if (query.product && mongoose.isValidObjectId(query.product)) {
        filter.product = query.product;
    }

    if (query.supplier) {
        filter.supplier = { $regex: query.supplier, $options: 'i' };
    }

    if (query.from || query.to) {
        filter.date = {};
        if (query.from) {
            filter.date.$gte = new Date(query.from);
        }
        if (query.to) {
            const toDate = new Date(query.to);
            toDate.setHours(23, 59, 59, 999);
            filter.date.$lte = toDate;
        }
    }

    return filter;
};

router.post('/in', async(req, res) => {
    const session = await mongoose.startSession();
    try {
        const { product, quantity, supplier, invoiceNumber, batchNumber, date, createdBy } = req.body;

        if (!mongoose.isValidObjectId(product)) {
            return res.status(400).json({ message: 'A valid product is required' });
        }

        if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
            return res.status(400).json({ message: 'Quantity must be greater than zero' });
        }

        let transaction;
        await session.withTransaction(async() => {
            const selectedProduct = await Product.findOne({ _id: product, active: true }).session(session);
            if (!selectedProduct) {
                throw new Error('Active product not found');
            }

            transaction = new StockTransaction({
                product,
                quantity: Number(quantity),
                supplier,
                invoiceNumber,
                batchNumber,
                date: date || new Date(),
                createdBy,
                transactionType: 'IN'
            });
            await transaction.save({ session });
            const updatedProduct = await Product.findOneAndUpdate({ _id: product, active: true }, { $inc: { availableStock: Number(quantity) } }, { new: true, session });
            if (!updatedProduct) {
                throw new Error('Active product not found');
            }
            await recordAudit({
                user: createdBy || 'system',
                action: 'STOCK_ADDED',
                entity: 'StockTransaction',
                entityId: transaction._id,
                oldValue: { availableStock: selectedProduct.availableStock },
                newValue: { availableStock: updatedProduct.availableStock, quantity: Number(quantity) },
                reason: 'Stock received into godown',
                session
            });
        });

        await transaction.populate('product', 'name category packSize');
        res.status(201).json(transaction);
    } catch (error) {
        res.status(400).json({ message: 'Unable to add stock', error: error.message });
    } finally {
        await session.endSession();
    }
});

router.get('/current', async(req, res) => {
    try {
        const currentStock = await StockTransaction.aggregate([
            { $match: { transactionType: { $in: ['IN', 'OUT'] } } },
            {
                $group: {
                    _id: '$product',
                    quantity: {
                        $sum: {
                            $cond: [{ $eq: ['$transactionType', 'IN'] }, '$quantity', { $multiply: ['$quantity', -1] }]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            { $match: { quantity: { $gt: 0 } } },
            {
                $project: {
                    _id: 0,
                    productId: '$_id',
                    quantity: 1,
                    product: {
                        _id: '$product._id',
                        name: '$product.name',
                        category: '$product.category',
                        packSize: '$product.packSize',
                        availableStock: '$product.availableStock',
                        active: '$product.active'
                    }
                }
            },
            { $sort: { 'product.name': 1 } }
        ]);

        res.json(currentStock);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch current stock' });
    }
});

router.get('/transactions', async(req, res) => {
    try {
        const transactions = await StockTransaction.find(buildTransactionFilter(req.query))
            .populate('product', 'name category packSize')
            .sort({ date: -1, createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch stock history' });
    }
});

module.exports = router;