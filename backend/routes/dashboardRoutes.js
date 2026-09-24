const express = require('express');
const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');

const router = express.Router();
const pendingStatuses = ['ASSIGNED', 'LOADED', 'OUT_FOR_DELIVERY'];

const startOfDay = (date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
};

const dayKey = (date) => {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const dayLabel = (key) => new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short'
}).format(new Date(`${key}T00:00:00`));

router.get('/summary', async(req, res) => {
    try {
        const now = new Date();
        const todayStart = startOfDay(now);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const sevenDayStart = new Date(todayStart);
        sevenDayStart.setDate(sevenDayStart.getDate() - 6);

        const [stockResult, todayDeliveries, todayInvoices, pendingDeliveries, lastSevenDeliveries] = await Promise.all([
            Product.aggregate([
                { $match: { active: true } },
                { $group: { _id: null, quantity: { $sum: '$availableStock' } } }
            ]),
            Delivery.find({ deliveredAt: { $gte: todayStart, $lt: tomorrowStart } }).lean(),
            Invoice.find({ date: { $gte: todayStart, $lt: tomorrowStart } }).lean(),
            Delivery.countDocuments({ status: { $in: pendingStatuses } }),
            Delivery.find({ deliveredAt: { $gte: sevenDayStart, $lt: tomorrowStart } }).lean()
        ]);

        const productIds = [...new Set(lastSevenDeliveries.flatMap((delivery) => delivery.products.map((item) => String(item.product))))];
        const driverIds = [...new Set(lastSevenDeliveries.map((delivery) => String(delivery.driver)))];
        const [productDocs, driverDocs] = await Promise.all([
            Product.find({ _id: { $in: productIds } }).select('name').lean(),
            Driver.find({ _id: { $in: driverIds } }).select('name').lean()
        ]);
        const productNames = new Map(productDocs.map((product) => [String(product._id), product.name]));
        const driverNames = new Map(driverDocs.map((driver) => [String(driver._id), driver.name]));

        const lastSevenMap = new Map();
        for (let index = 0; index < 7; index += 1) {
            const date = new Date(sevenDayStart);
            date.setDate(date.getDate() + index);
            const key = dayKey(date);
            lastSevenMap.set(key, { date: key, label: dayLabel(key), quantity: 0 });
        }

        const productMap = new Map();
        const driverMap = new Map();
        lastSevenDeliveries.forEach((delivery) => {
            const dateKey = dayKey(delivery.deliveredAt);
            const daily = lastSevenMap.get(dateKey);
            delivery.products.forEach((item) => {
                const quantity = Number(item.deliveredQuantity || 0);
                if (daily) daily.quantity += quantity;
                const productKey = String(item.product);
                productMap.set(productKey, (productMap.get(productKey) || 0) + quantity);
                const driverKey = String(delivery.driver);
                driverMap.set(driverKey, (driverMap.get(driverKey) || 0) + quantity);
            });
        });

        const todayDistribution = todayDeliveries.reduce((sum, delivery) => sum + Number(delivery.deliveredQuantity || 0), 0);
        const returnedStock = todayDeliveries.reduce((sum, delivery) => sum + Number(delivery.returnedQuantity || 0), 0);
        const damagedStock = todayDeliveries.reduce((sum, delivery) => sum + Number(delivery.damagedQuantity || 0), 0);
        const todaySales = todayInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);

        res.json({
            cards: {
                currentStock: stockResult[0] ? stockResult[0].quantity : 0,
                todaysDistribution: todayDistribution,
                todaysBills: todayInvoices.length,
                pendingDeliveries,
                todaysSales: todaySales,
                returnedStock,
                damagedStock
            },
            charts: {
                lastSevenDays: [...lastSevenMap.values()],
                productDistribution: [...productMap.entries()].map(([id, quantity]) => ({
                    label: productNames.get(id) || 'Unknown product',
                    quantity
                })).sort((a, b) => b.quantity - a.quantity),
                driverDistribution: [...driverMap.entries()].map(([id, quantity]) => ({
                    label: driverNames.get(id) || 'Unknown driver',
                    quantity
                })).sort((a, b) => b.quantity - a.quantity)
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Unable to load dashboard data' });
    }
});

module.exports = router;