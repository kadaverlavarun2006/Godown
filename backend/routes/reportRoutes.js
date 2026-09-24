const express = require('express');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const Delivery = require('../models/Delivery');
const Invoice = require('../models/Invoice');
const StockTransaction = require('../models/StockTransaction');

const router = express.Router();
const reportTypes = ['daily', 'weekly', 'monthly', 'driver', 'retailer', 'product', 'stock', 'payment'];
const operationalColumns = [
    'Date', 'Time', 'Invoice Number', 'Driver', 'Vehicle', 'Retailer', 'Product',
    'Loaded Quantity', 'Delivered Quantity', 'Returned Quantity', 'Damaged Quantity',
    'Amount', 'Payment Status', 'Delivery Status'
];

const toDate = (value, endOfDay = false) => {
    if (!value) return null;
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
    return Number.isNaN(date.getTime()) ? null : date;
};

const dateRange = (query) => {
    const now = new Date();
    const fallbackTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fallbackFrom = new Date(fallbackTo);
    fallbackFrom.setDate(fallbackFrom.getDate() - 30);
    const range = {
        from: toDate(query.from) || fallbackFrom,
        to: toDate(query.to, true) || new Date(fallbackTo.getTime() + 86399999)
    };
    if (range.from > range.to) throw new Error('Report start date must be on or before the end date');
    return range;
};

const dayKey = (date) => {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const weekKey = (date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    const day = value.getDay() || 7;
    value.setDate(value.getDate() - day + 1);
    return dayKey(value);
};

const monthKey = (date) => {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
};

const operationalRows = async(query) => {
    const range = dateRange(query);
    const invoices = await Invoice.find({ deliveryDate: { $gte: range.from, $lte: range.to } })
        .populate('retailer', 'shopName')
        .populate('driver', 'name')
        .populate('vehicle', 'vehicleNumber')
        .populate('delivery', 'status products')
        .populate('products.product', 'name')
        .lean();

    return invoices.flatMap((invoice) => {
        if (query.driver && String(invoice.driver._id) !== query.driver) return [];
        if (query.retailer && String(invoice.retailer._id) !== query.retailer) return [];
        const deliveryProducts = new Map((invoice.delivery && invoice.delivery.products || []).map((item) => [String(item.product), item]));
        return invoice.products.filter((item) => !query.product || String(item.product._id) === query.product).map((item) => {
            const deliveryProduct = deliveryProducts.get(String(item.product._id));
            return {
                Date: dayKey(invoice.deliveryDate),
                Time: invoice.deliveryTime,
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
            };
        });
    });
};

const groupRows = (rows, keyName, keyFunction) => {
    const groups = new Map();
    rows.forEach((row) => {
        const key = keyFunction(row);
        const existing = groups.get(key) || {
            [keyName]: key,
            'Loaded Quantity': 0,
            'Delivered Quantity': 0,
            'Returned Quantity': 0,
            'Damaged Quantity': 0,
            Amount: 0
        };
        existing['Loaded Quantity'] += Number(row['Loaded Quantity'] || 0);
        existing['Delivered Quantity'] += Number(row['Delivered Quantity'] || 0);
        existing['Returned Quantity'] += Number(row['Returned Quantity'] || 0);
        existing['Damaged Quantity'] += Number(row['Damaged Quantity'] || 0);
        existing.Amount += Number(row.Amount || 0);
        groups.set(key, existing);
    });
    return [...groups.values()].sort((a, b) => String(a[keyName]).localeCompare(String(b[keyName])));
};

const stockReport = async(query) => {
    const range = dateRange(query);
    const filter = { date: { $gte: range.from, $lte: range.to } };
    if (query.product) filter.product = query.product;
    const transactions = await StockTransaction.find(filter)
        .populate('product', 'name')
        .populate('delivery', 'status')
        .sort({ date: -1 })
        .lean();
    return {
        columns: ['Date', 'Time', 'Type', 'Product', 'Quantity', 'Supplier', 'Invoice Number', 'Batch Number', 'Created By', 'Delivery Status'],
        rows: transactions.map((transaction) => ({
            Date: dayKey(transaction.date),
            Time: new Date(transaction.date).toLocaleTimeString('en-IN'),
            Type: transaction.transactionType,
            Product: transaction.product.name,
            Quantity: transaction.quantity,
            Supplier: transaction.supplier || '',
            'Invoice Number': transaction.invoiceNumber || '',
            'Batch Number': transaction.batchNumber || '',
            'Created By': transaction.createdBy,
            'Delivery Status': transaction.delivery && transaction.delivery.status || ''
        }))
    };
};

const buildReport = async(query) => {
    if (!reportTypes.includes(query.type)) throw new Error('Unknown report type');
    if (query.type === 'stock') {
        const result = await stockReport(query);
        return { title: 'Stock Report', columns: result.columns, rows: result.rows };
    }

    const rows = await operationalRows(query);
    if (query.type === 'payment') {
        const paymentRows = rows.filter((row, index, all) => all.findIndex((item) => item['Invoice Number'] === row['Invoice Number']) === index).map((row) => ({
            Date: row.Date,
            Time: row.Time,
            'Invoice Number': row['Invoice Number'],
            Retailer: row.Retailer,
            Driver: row.Driver,
            Amount: row.Amount,
            'Payment Status': row['Payment Status']
        }));
        return { title: 'Payment Report', columns: Object.keys(paymentRows[0] || { Date: '', Time: '', 'Invoice Number': '', Retailer: '', Driver: '', Amount: 0, 'Payment Status': '' }), rows: paymentRows };
    }

    if (query.type === 'driver') {
        const grouped = groupRows(rows, 'Driver', (row) => row.Driver);
        return { title: 'Driver-wise Report', columns: ['Driver', 'Loaded Quantity', 'Delivered Quantity', 'Returned Quantity', 'Damaged Quantity', 'Amount'], rows: grouped };
    }
    if (query.type === 'retailer') {
        const grouped = groupRows(rows, 'Retailer', (row) => row.Retailer);
        return { title: 'Retailer-wise Report', columns: ['Retailer', 'Loaded Quantity', 'Delivered Quantity', 'Returned Quantity', 'Damaged Quantity', 'Amount'], rows: grouped };
    }
    if (query.type === 'product') {
        const grouped = groupRows(rows, 'Product', (row) => row.Product);
        return { title: 'Product-wise Report', columns: ['Product', 'Loaded Quantity', 'Delivered Quantity', 'Returned Quantity', 'Damaged Quantity', 'Amount'], rows: grouped };
    }
    if (query.type === 'weekly') {
        const grouped = groupRows(rows, 'Week Starting', (row) => weekKey(row.Date));
        return { title: 'Weekly Report', columns: ['Week Starting', 'Loaded Quantity', 'Delivered Quantity', 'Returned Quantity', 'Damaged Quantity', 'Amount'], rows: grouped };
    }
    if (query.type === 'monthly') {
        const grouped = groupRows(rows, 'Month', (row) => monthKey(row.Date));
        return { title: 'Monthly Report', columns: ['Month', 'Loaded Quantity', 'Delivered Quantity', 'Returned Quantity', 'Damaged Quantity', 'Amount'], rows: grouped };
    }
    return { title: 'Daily Report', columns: operationalColumns, rows };
};

router.get('/', async(req, res) => {
    try {
        res.json(await buildReport(req.query));
    } catch (error) {
        res.status(400).json({ message: error.message || 'Unable to build report' });
    }
});

router.get('/export.xlsx', async(req, res) => {
    try {
        const report = await buildReport(req.query);
        const worksheet = XLSX.utils.json_to_sheet(report.rows, { header: report.columns });
        worksheet['!cols'] = report.columns.map((column) => ({ wch: Math.max(16, column.length + 2) }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=logease-${req.query.type}-report.xlsx`);
        res.send(buffer);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Unable to export report' });
    }
});

router.get('/export.pdf', async(req, res) => {
    try {
        const report = await buildReport(req.query);
        const document = new PDFDocument({ margin: 32, layout: 'landscape', size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=logease-${req.query.type}-report.pdf`);
        document.pipe(res);
        document.fontSize(20).fillColor('#17232b').text('LogEase');
        document.fontSize(15).fillColor('#2f806a').text(report.title);
        document.fontSize(9).fillColor('#6d7a80').text(`Range: ${req.query.from || 'start'} to ${req.query.to || 'today'}`);
        document.moveDown();

        const pageWidth = document.page.width - 64;
        const columnWidth = pageWidth / report.columns.length;
        let y = document.y;
        const drawRow = (values, color) => {
            document.fontSize(7).fillColor(color);
            values.forEach((value, index) => {
                document.text(String(value === undefined || value === null ? '' : value), 32 + index * columnWidth, y, {
                    width: columnWidth - 5,
                    height: 24,
                    ellipsis: true,
                    lineBreak: false
                });
            });
        };
        drawRow(report.columns, '#6d7a80');
        y += 18;
        document.strokeColor('#e2e9e5').moveTo(32, y).lineTo(32 + pageWidth, y).stroke();
        y += 8;
        report.rows.forEach((row) => {
            if (y > document.page.height - 45) {
                document.addPage({ layout: 'landscape', size: 'A4', margin: 32 });
                y = 32;
            }
            drawRow(report.columns.map((column) => row[column]), '#17232b');
            y += 18;
        });
        document.end();
    } catch (error) {
        res.status(400).json({ message: error.message || 'Unable to export report PDF' });
    }
});

module.exports = router;