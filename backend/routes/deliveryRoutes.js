const express = require('express');
const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const DeliveryStatusHistory = require('../models/DeliveryStatusHistory');
const Driver = require('../models/Driver');
const Counter = require('../models/Counter');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Retailer = require('../models/Retailer');
const StockTransaction = require('../models/StockTransaction');
const Vehicle = require('../models/Vehicle');
const recordAudit = require('../utils/audit');
const { authorizeAdmin } = require('../middleware/auth');

const router = express.Router();
const terminalStatuses = ['DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED'];
const completionStatuses = new Set(terminalStatuses);

const populateDelivery = (query) => query
    .populate('driver', 'name phone licenseNumber active')
    .populate('vehicle', 'vehicleNumber vehicleType capacity active')
    .populate('retailer', 'shopName ownerName phone address city active')
    .populate('products.product', 'name category packSize active');

const addStatusHistory = async(deliveryId, status, session = null, notes = '') => {
    const history = new DeliveryStatusHistory({ delivery: deliveryId, status, notes });
    await history.save(session ? { session } : undefined);
};

const validateReferences = async({ driver, vehicle, retailer, products }) => {
    if (![driver, vehicle, retailer].every((id) => mongoose.isValidObjectId(id))) {
        throw new Error('Valid driver, vehicle, and retailer are required');
    }

    const [driverDoc, vehicleDoc, retailerDoc] = await Promise.all([
        Driver.findOne({ _id: driver, active: true }),
        Vehicle.findOne({ _id: vehicle, active: true }),
        Retailer.findOne({ _id: retailer, active: true })
    ]);

    if (!driverDoc) throw new Error('Active driver not found');
    if (!vehicleDoc) throw new Error('Active vehicle not found');
    if (!retailerDoc) throw new Error('Active retailer not found');
    if (!vehicleDoc.assignedDriver || vehicleDoc.assignedDriver.toString() !== driver.toString()) {
        throw new Error('Vehicle must be assigned to the selected driver');
    }

    if (!Array.isArray(products) || products.length === 0) {
        throw new Error('At least one delivery product is required');
    }

    const productIds = products.map((item) => item.product);
    if (productIds.some((id) => !mongoose.isValidObjectId(id)) || new Set(productIds.map(String)).size !== productIds.length) {
        throw new Error('Delivery products must be valid and unique');
    }

    const productDocs = await Product.find({ _id: { $in: productIds }, active: true });
    if (productDocs.length !== productIds.length) {
        throw new Error('All delivery products must be active');
    }
};

const validateRequestedProducts = (products) => products.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Delivery quantities must be greater than zero');
    }
    return { product: item.product, quantity };
});

router.get('/', async(req, res) => {
    try {
        let filter = {};
        if (req.user && req.user.role === 'RETAILER') {
            filter = { retailer: req.retailerId };
        } else if (req.user && req.user.role === 'DRIVER') {
            filter = { driver: req.driverId };
        }
        const deliveries = await populateDelivery(Delivery.find(filter).sort({ createdAt: -1 }));
        res.json(deliveries);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch deliveries' });
    }
});

router.post('/', async(req, res) => {
    try {
        if (req.user && req.user.role === 'DRIVER') {
            return res.status(403).json({ message: 'Access denied. Drivers cannot create orders or deliveries.' });
        }

        const products = validateRequestedProducts(req.body.products);

        // If placed by Retailer
        if (req.user && req.user.role === 'RETAILER') {
            const retailerId = req.retailerId;
            if (!retailerId) {
                return res.status(400).json({ message: 'Retailer profile not found for this account' });
            }

            // Check if active vehicle/driver available for auto-assignment
            let driver = req.body.driver || null;
            let vehicle = req.body.vehicle || null;

            if (!driver || !vehicle) {
                const availableVehicle = await Vehicle.findOne({ active: true, assignedDriver: { $ne: null } });
                if (availableVehicle) {
                    vehicle = availableVehicle._id;
                    driver = availableVehicle.assignedDriver;
                }
            }

            const initialStatus = (driver && vehicle) ? 'ASSIGNED' : 'PENDING';

            const delivery = await Delivery.create({
                driver,
                vehicle,
                retailer: retailerId,
                status: initialStatus,
                products
            });

            await addStatusHistory(delivery._id, initialStatus);
            await recordAudit({
                user: req.user.name || 'Retailer',
                action: 'ORDER_CREATED',
                entity: 'Delivery',
                entityId: delivery._id,
                newValue: { status: delivery.status, retailer: delivery.retailer, products },
                reason: 'Retailer placed order'
            });

            return res.status(201).json(await populateDelivery(Delivery.findById(delivery._id)));
        }

        // ADMIN delivery creation
        await validateReferences({...req.body, products });

        const delivery = await Delivery.create({
            driver: req.body.driver,
            vehicle: req.body.vehicle,
            retailer: req.body.retailer,
            status: 'ASSIGNED',
            products
        });
        await addStatusHistory(delivery._id, 'ASSIGNED');
        await recordAudit({
            user: req.user?.name || req.body.createdBy || 'system',
            action: 'DELIVERY_CREATED',
            entity: 'Delivery',
            entityId: delivery._id,
            newValue: { status: delivery.status, driver: delivery.driver, vehicle: delivery.vehicle, retailer: delivery.retailer, products },
            reason: 'Delivery assigned',
        });
        res.status(201).json(await populateDelivery(Delivery.findById(delivery._id)));
    } catch (error) {
        res.status(400).json({ message: error.message || 'Unable to create delivery' });
    }
});

router.post('/:id/load', authorizeAdmin, async(req, res) => {
    const session = await mongoose.startSession();
    try {
        const loadProducts = req.body.products;
        if (!Array.isArray(loadProducts) || loadProducts.length === 0) {
            throw new Error('Loaded product quantities are required');
        }

        let loadedDelivery;
        await session.withTransaction(async() => {
            const delivery = await Delivery.findById(req.params.id).session(session);
            if (!delivery) throw new Error('Delivery not found');
            if (delivery.status !== 'ASSIGNED') throw new Error('Only assigned deliveries can be loaded');

            const requested = new Map(loadProducts.map((item) => [String(item.product), Number(item.quantity)]));
            const stockTransactions = [];
            let totalLoaded = 0;

            for (const item of delivery.products) {
                const quantity = requested.get(String(item.product));
                if (!Number.isFinite(quantity) || quantity < 0 || quantity > item.quantity) {
                    throw new Error('Loaded quantity must be within the requested delivery quantity');
                }

                item.loadedQuantity = quantity;
                totalLoaded += quantity;
                if (quantity > 0) {
                    const balance = await Product.findOneAndUpdate({ _id: item.product, active: true, availableStock: { $gte: quantity } }, { $inc: { availableStock: -quantity } }, { new: true, session });
                    if (!balance) {
                        throw new Error(`Insufficient stock for product ${item.product}`);
                    }

                    stockTransactions.push({
                        product: item.product,
                        quantity,
                        date: new Date(),
                        createdBy: 'delivery-load',
                        transactionType: 'OUT',
                        delivery: delivery._id
                    });
                }
            }

            if (totalLoaded <= 0) throw new Error('At least one product must be loaded');
            delivery.loadedQuantity = totalLoaded;
            delivery.status = 'LOADED';
            await StockTransaction.insertMany(stockTransactions, { session });
            await delivery.save({ session });
            await addStatusHistory(delivery._id, 'LOADED', session);
            await recordAudit({
                user: req.body.user || 'system',
                action: 'STOCK_ADJUSTED',
                entity: 'Delivery',
                entityId: delivery._id,
                oldValue: { status: 'ASSIGNED' },
                newValue: { status: 'LOADED', loadedQuantity: totalLoaded, products: loadProducts },
                reason: 'Stock loaded for delivery',
                session
            });
            loadedDelivery = delivery;
        });

        res.json(await populateDelivery(Delivery.findById(loadedDelivery._id)));
    } catch (error) {
        res.status(400).json({ message: error.message || 'Unable to load delivery' });
    } finally {
        await session.endSession();
    }
});

router.patch('/:id/status', async(req, res) => {
    if (req.user && req.user.role === 'RETAILER') {
        return res.status(403).json({ message: 'Access denied. Retailers cannot update delivery status.' });
    }

    const session = await mongoose.startSession();
    try {
        let updatedDelivery;
        await session.withTransaction(async() => {
            const delivery = await Delivery.findById(req.params.id).session(session);
            if (!delivery) throw new Error('Delivery not found');

            // DRIVER can only update deliveries assigned to them
            if (req.user && req.user.role === 'DRIVER') {
                if (!delivery.driver || String(delivery.driver) !== String(req.driverId)) {
                    throw new Error('Access denied. You can only update deliveries assigned to you.');
                }
            }

            if (terminalStatuses.includes(delivery.status)) throw new Error('Completed deliveries cannot be changed');
            const previousStatus = delivery.status;

            const nextStatus = req.body.status;
            const allowed = (delivery.status === 'LOADED' && nextStatus === 'OUT_FOR_DELIVERY') ||
                (delivery.status === 'OUT_FOR_DELIVERY' && completionStatuses.has(nextStatus)) ||
                (delivery.status === 'LOADED' && completionStatuses.has(nextStatus));
            if (!allowed) throw new Error(`Invalid status transition from ${delivery.status} to ${nextStatus}`);

            const returnReason = req.body.returnReason || req.body.damageReason || req.body.reason || '';

            if (completionStatuses.has(nextStatus)) {
                const completionProducts = req.body.products;
                if (!Array.isArray(completionProducts)) throw new Error('Completion quantities are required');

                delivery.returnReason = returnReason;
                const quantities = new Map(completionProducts.map((item) => [String(item.product), item]));
                let deliveredTotal = 0;
                let returnedTotal = 0;
                let damagedTotal = 0;
                const returnedTransactions = [];

                for (const item of delivery.products) {
                    const completed = quantities.get(String(item.product)) || {};
                    const previousReturnedQuantity = item.returnedQuantity;
                    const delivered = Number(completed.deliveredQuantity !== undefined ? completed.deliveredQuantity : (nextStatus === 'DELIVERED' ? item.loadedQuantity : 0));
                    const returned = Number(completed.returnedQuantity || 0);
                    const damaged = Number(completed.damagedQuantity || 0);
                    const itemReason = completed.returnReason || completed.damageReason || returnReason;

                    if (![delivered, returned, damaged].every((quantity) => Number.isFinite(quantity) && quantity >= 0)) {
                        throw new Error('Completion quantities must be zero or greater');
                    }
                    if (delivered + returned + damaged !== item.loadedQuantity) {
                        throw new Error(`Delivered (${delivered}) + returned (${returned}) + damaged (${damaged}) must equal loaded quantity (${item.loadedQuantity})`);
                    }

                    item.deliveredQuantity = delivered;
                    item.returnedQuantity = returned;
                    item.damagedQuantity = damaged;
                    item.returnReason = itemReason;
                    deliveredTotal += delivered;
                    returnedTotal += returned;
                    damagedTotal += damaged;
                    if (returned > 0) {
                        await Product.updateOne({ _id: item.product, active: true }, { $inc: { availableStock: returned } }, { session });
                        returnedTransactions.push({
                            product: item.product,
                            quantity: returned,
                            date: new Date(),
                            createdBy: req.user?.role === 'DRIVER' ? 'driver-return' : 'delivery-return',
                            transactionType: 'IN',
                            delivery: delivery._id
                        });
                        await recordAudit({
                            user: req.user?.name || req.body.user || 'system',
                            action: 'RETURN_RECORDED',
                            entity: 'Delivery',
                            entityId: delivery._id,
                            oldValue: { returnedQuantity: previousReturnedQuantity },
                            newValue: { returnedQuantity: returned, reason: itemReason },
                            reason: itemReason || 'Returned stock recorded',
                            session
                        });
                    }
                }

                delivery.deliveredQuantity = deliveredTotal;
                delivery.returnedQuantity = returnedTotal;
                delivery.damagedQuantity = damagedTotal;
                delivery.deliveredAt = new Date();
                await StockTransaction.insertMany(returnedTransactions, { session });

                const invoiceProducts = [];
                let invoiceTotal = 0;
                const productIds = delivery.products.map((item) => item.product);
                const productDocs = await Product.find({ _id: { $in: productIds } }).session(session);
                const productMap = new Map(productDocs.map((product) => [String(product._id), product]));
                for (const item of delivery.products) {
                    const product = productMap.get(String(item.product));
                    if (!product) throw new Error('Invoice product no longer exists');
                    const lineTotal = item.deliveredQuantity * product.sellingPrice;
                    invoiceProducts.push({
                        product: product._id,
                        productName: product.name,
                        quantity: item.deliveredQuantity,
                        unitPrice: product.sellingPrice,
                        totalAmount: lineTotal
                    });
                    invoiceTotal += lineTotal;
                }

                const invoiceDate = new Date();
                const deliveryDate = delivery.deliveredAt;
                const year = invoiceDate.getFullYear();
                const counter = await Counter.findOneAndUpdate({ _id: `invoice-${year}` }, { $inc: { sequence: 1 } }, { new: true, upsert: true, session });
                const invoiceNumber = `INV-${year}-${String(counter.sequence).padStart(6, '0')}`;
                const invoice = new Invoice({
                    invoiceNumber,
                    date: invoiceDate,
                    time: invoiceDate.toLocaleTimeString('en-IN'),
                    generatedAt: invoiceDate,
                    deliveryDate,
                    deliveryTime: deliveryDate.toLocaleTimeString('en-IN'),
                    retailer: delivery.retailer,
                    driver: delivery.driver,
                    vehicle: delivery.vehicle,
                    delivery: delivery._id,
                    products: invoiceProducts,
                    totalAmount: invoiceTotal,
                    paymentStatus: 'PENDING'
                });
                await invoice.save({ session });
                await recordAudit({
                    user: req.user?.name || req.body.user || 'system',
                    action: 'INVOICE_GENERATED',
                    entity: 'Invoice',
                    entityId: invoice._id,
                    newValue: { invoiceNumber, totalAmount: invoiceTotal, paymentStatus: invoice.paymentStatus },
                    reason: 'Invoice generated from completed delivery',
                    session
                });
            }

            delivery.status = nextStatus;
            await delivery.save({ session });
            await addStatusHistory(delivery._id, nextStatus, session, returnReason);
            await recordAudit({
                user: req.user?.name || req.body.user || 'system',
                action: nextStatus === 'OUT_FOR_DELIVERY' ? 'DELIVERY_DISPATCHED' : 'DELIVERY_COMPLETED',
                entity: 'Delivery',
                entityId: delivery._id,
                oldValue: { status: previousStatus },
                newValue: {
                    status: nextStatus,
                    deliveredQuantity: delivery.deliveredQuantity,
                    returnedQuantity: delivery.returnedQuantity,
                    damagedQuantity: delivery.damagedQuantity,
                    returnReason: delivery.returnReason
                },
                reason: returnReason || (nextStatus === 'OUT_FOR_DELIVERY' ? 'Delivery dispatched' : 'Delivery completed'),
                session
            });
            updatedDelivery = delivery;
        });

        res.json(await populateDelivery(Delivery.findById(updatedDelivery._id)));
    } catch (error) {
        res.status(400).json({ message: error.message || 'Unable to update delivery status' });
    } finally {
        await session.endSession();
    }
});

router.get('/:id', async(req, res) => {
    try {
        const delivery = await populateDelivery(Delivery.findById(req.params.id));
        if (!delivery) {
            return res.status(404).json({ message: 'Delivery not found' });
        }
        if (req.user && req.user.role === 'RETAILER') {
            const deliveryRetailerId = delivery.retailer?._id || delivery.retailer;
            if (String(deliveryRetailerId) !== String(req.retailerId)) {
                return res.status(403).json({ message: 'Access denied. You can only view your own orders.' });
            }
        }
        if (req.user && req.user.role === 'DRIVER') {
            const deliveryDriverId = delivery.driver?._id || delivery.driver;
            if (String(deliveryDriverId) !== String(req.driverId)) {
                return res.status(403).json({ message: 'Access denied. You can only view deliveries assigned to you.' });
            }
        }
        res.json(delivery);
    } catch (error) {
        res.status(400).json({ message: 'Unable to fetch delivery details' });
    }
});

router.get('/:id/history', async(req, res) => {
    try {
        if (req.user && req.user.role === 'RETAILER') {
            const delivery = await Delivery.findById(req.params.id);
            if (!delivery || String(delivery.retailer) !== String(req.retailerId)) {
                return res.status(403).json({ message: 'Access denied. You can only view your own order history.' });
            }
        }
        if (req.user && req.user.role === 'DRIVER') {
            const delivery = await Delivery.findById(req.params.id);
            if (!delivery || !delivery.driver || String(delivery.driver) !== String(req.driverId)) {
                return res.status(403).json({ message: 'Access denied. You can only view history for deliveries assigned to you.' });
            }
        }
        const history = await DeliveryStatusHistory.find({ delivery: req.params.id }).sort({ changedAt: 1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch delivery history' });
    }
});

module.exports = router;