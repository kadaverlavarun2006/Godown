const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');
const recordAudit = require('../utils/audit');

const router = express.Router();

const invoiceQuery = (query) => query
    .populate('retailer', 'shopName ownerName phone address city gstNumber')
    .populate('driver', 'name phone licenseNumber')
    .populate('vehicle', 'vehicleNumber vehicleType capacity')
    .populate('delivery', 'deliveredAt')
    .populate('products.product', 'name category packSize');

router.get('/', async(req, res) => {
    try {
        let filter = {};
        if (req.user && req.user.role === 'RETAILER') {
            filter = { retailer: req.retailerId };
        }
        const invoices = await invoiceQuery(Invoice.find(filter).sort({ date: -1, invoiceNumber: -1 }));
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch invoices' });
    }
});

router.get('/:id', async(req, res) => {
    try {
        const invoice = await invoiceQuery(Invoice.findById(req.params.id));
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        if (req.user && req.user.role === 'RETAILER') {
            const invoiceRetailerId = invoice.retailer?._id || invoice.retailer;
            if (String(invoiceRetailerId) !== String(req.retailerId)) {
                return res.status(403).json({ message: 'Access denied. You can only view your own bills.' });
            }
        }
        res.json(invoice);
    } catch (error) {
        res.status(400).json({ message: 'Unable to fetch invoice' });
    }
});

router.patch('/:id/payment', async(req, res) => {
    const session = await mongoose.startSession();
    try {
        const allowed = ['PENDING', 'PARTIAL', 'PAID'];
        if (!allowed.includes(req.body.paymentStatus)) {
            return res.status(400).json({ message: 'Invalid payment status' });
        }

        if (req.user && req.user.role === 'RETAILER') {
            const invoiceCheck = await Invoice.findById(req.params.id);
            if (!invoiceCheck) return res.status(404).json({ message: 'Invoice not found' });
            if (String(invoiceCheck.retailer) !== String(req.retailerId)) {
                return res.status(403).json({ message: 'Access denied. You can only pay your own bills.' });
            }
        }

        let invoice;
        await session.withTransaction(async() => {
            invoice = await Invoice.findById(req.params.id).session(session);
            if (!invoice) throw new Error('Invoice not found');
            const oldStatus = invoice.paymentStatus;
            invoice.paymentStatus = req.body.paymentStatus;
            await invoice.save({ session });
            await recordAudit({
                user: req.user?.name || req.body.user || 'system',
                action: 'PAYMENT_UPDATED',
                entity: 'Invoice',
                entityId: invoice._id,
                oldValue: { paymentStatus: oldStatus },
                newValue: { paymentStatus: invoice.paymentStatus },
                reason: req.body.reason || 'Payment status updated',
                session
            });
        });
        res.json(invoice);
    } catch (error) {
        res.status(error.message === 'Invoice not found' ? 404 : 400).json({ message: error.message === 'Invoice not found' ? error.message : 'Unable to update payment status', error: error.message });
    } finally {
        await session.endSession();
    }
});

router.get('/:id/pdf', async(req, res) => {
    try {
        const invoice = await invoiceQuery(Invoice.findById(req.params.id));
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (req.user && req.user.role === 'RETAILER') {
            const invoiceRetailerId = invoice.retailer?._id || invoice.retailer;
            if (String(invoiceRetailerId) !== String(req.retailerId)) {
                return res.status(403).json({ message: 'Access denied. You can only download your own bills.' });
            }
        }

        const document = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
        document.pipe(res);

        document.fontSize(22).fillColor('#17232b').text('LogEase', { continued: true });
        document.fontSize(10).fillColor('#6d7a80').text('  Godown Management System', { align: 'right' });
        document.moveDown();
        document.fontSize(18).fillColor('#2f806a').text('INVOICE');
        document.fontSize(11).fillColor('#17232b').text(`Invoice number: ${invoice.invoiceNumber}`);
        document.text(`Generated: ${invoice.date.toLocaleDateString('en-IN')}  ${invoice.time}`);
        document.text(`Delivered: ${invoice.deliveryDate.toLocaleDateString('en-IN')}  ${invoice.deliveryTime}`);
        document.moveDown();
        document.fontSize(11).text(`Retailer: ${invoice.retailer.shopName}`);
        document.text(`Owner: ${invoice.retailer.ownerName}`);
        document.text(`City: ${invoice.retailer.city}`);
        document.text(`GST: ${invoice.retailer.gstNumber}`);
        document.text(`Driver: ${invoice.driver.name}`);
        document.text(`Vehicle: ${invoice.vehicle.vehicleNumber}`);
        document.moveDown();

        const columns = [
            { label: 'PRODUCT', x: 50, width: 210, align: 'left' },
            { label: 'QUANTITY', x: 260, width: 75, align: 'right' },
            { label: 'UNIT PRICE', x: 335, width: 105, align: 'right' },
            { label: 'TOTAL', x: 440, width: 105, align: 'right' }
        ];
        const drawRow = (values, y, color) => {
            document.fillColor(color).fontSize(10);
            columns.forEach((column, index) => {
                document.text(String(values[index]), column.x, y, {
                    width: column.width,
                    align: column.align,
                    lineBreak: false
                });
            });
        };

        const headerY = document.y;
        drawRow(columns.map((column) => column.label), headerY, '#6d7a80');
        const dividerY = headerY + 18;
        document.strokeColor('#e2e9e5').moveTo(50, dividerY).lineTo(545, dividerY).stroke();

        let rowY = dividerY + 10;
        invoice.products.forEach((item) => {
            const productLines = document.heightOfString(item.productName, { width: 210 });
            const rowHeight = Math.max(20, productLines) + 8;
            if (rowY + rowHeight > document.page.height - 70) {
                document.addPage();
                rowY = 50;
            }
            document.fillColor('#17232b').fontSize(10);
            document.text(item.productName, 50, rowY, { width: 210 });
            document.text(String(item.quantity), 260, rowY, { width: 75, align: 'right' });
            document.text(`Rs. ${item.unitPrice.toFixed(2)}`, 335, rowY, { width: 105, align: 'right' });
            document.text(`Rs. ${item.totalAmount.toFixed(2)}`, 440, rowY, { width: 105, align: 'right' });
            rowY += rowHeight;
        });

        document.y = rowY;

        document.moveDown();
        document.fontSize(14).text(`Total amount: Rs. ${invoice.totalAmount.toFixed(2)}`, { align: 'right' });
        document.fontSize(10).fillColor('#6d7a80').text(`Payment status: ${invoice.paymentStatus}`, { align: 'right' });
        document.end();
    } catch (error) {
        res.status(500).json({ message: 'Unable to generate invoice PDF' });
    }
});

module.exports = router;