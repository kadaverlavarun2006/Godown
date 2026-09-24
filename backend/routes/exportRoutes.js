const express = require('express');
const XLSX = require('xlsx');
const Invoice = require('../models/Invoice');

const router = express.Router();
const columns = [
    'Date',
    'Time',
    'Invoice Number',
    'Driver',
    'Vehicle',
    'Retailer',
    'Product',
    'Loaded Quantity',
    'Delivered Quantity',
    'Returned Quantity',
    'Damaged Quantity',
    'Amount',
    'Payment Status',
    'Delivery Status'
];

const dayMatches = (value, day) => value && value.toISOString().slice(0, 10) === day;

router.get('/invoices.xlsx', async(req, res) => {
    try {
        const invoices = await Invoice.find()
            .populate('retailer', 'shopName')
            .populate('driver', 'name')
            .populate('vehicle', 'vehicleNumber')
            .populate('delivery', 'status products deliveredAt')
            .populate('products.product', 'name');

        const filtered = invoices.filter((invoice) => {
            const deliveryDate = invoice.deliveryDate || invoice.date;
            const driverMatches = !req.query.driver || String(invoice.driver._id) === req.query.driver;
            const retailerMatches = !req.query.retailer || String(invoice.retailer._id) === req.query.retailer;
            const productMatches = !req.query.product || invoice.products.some((item) => String(item.product._id) === req.query.product);
            const dateMatches = !req.query.date || dayMatches(deliveryDate, req.query.date);
            return driverMatches && retailerMatches && productMatches && dateMatches;
        });

        const rows = [];
        filtered.forEach((invoice) => {
            const deliveryProducts = new Map((invoice.delivery && invoice.delivery.products || []).map((item) => [String(item.product), item]));
            invoice.products.forEach((item) => {
                const deliveryProduct = deliveryProducts.get(String(item.product._id));
                rows.push({
                    Date: (invoice.deliveryDate || invoice.date).toISOString().slice(0, 10),
                    Time: invoice.deliveryTime || invoice.time,
                    'Invoice Number': invoice.invoiceNumber,
                    Driver: invoice.driver.name,
                    Vehicle: invoice.vehicle.vehicleNumber,
                    Retailer: invoice.retailer.shopName,
                    Product: item.productName,
                    'Loaded Quantity': deliveryProduct && deliveryProduct.loadedQuantity || 0,
                    'Delivered Quantity': deliveryProduct && deliveryProduct.deliveredQuantity || item.quantity,
                    'Returned Quantity': deliveryProduct && deliveryProduct.returnedQuantity || 0,
                    'Damaged Quantity': deliveryProduct && deliveryProduct.damagedQuantity || 0,
                    Amount: item.totalAmount,
                    'Payment Status': invoice.paymentStatus,
                    'Delivery Status': invoice.delivery && invoice.delivery.status || 'DELIVERED'
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
        worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(column.length + 2, 18) }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=logease-invoices.xlsx');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ message: 'Unable to export invoices' });
    }
});

module.exports = router;