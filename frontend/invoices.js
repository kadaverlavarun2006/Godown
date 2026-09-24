const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
const invoicesApi = `${API_BASE}/invoices`;
const invoiceSearch = document.querySelector('#invoice-search');
const invoiceTableBody = document.querySelector('#invoice-table-body');
const listMessage = document.querySelector('#invoice-list-message');
const invoiceDetail = document.querySelector('#invoice-detail');
const exportDate = document.querySelector('#export-date');
const exportDriver = document.querySelector('#export-driver');
const exportRetailer = document.querySelector('#export-retailer');
const exportProduct = document.querySelector('#export-product');
const exportExcel = document.querySelector('#export-excel');

let invoices = [];

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatDate = (value) => new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
}).format(new Date(value));

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
}).format(value);

const deliveryDate = (invoice) => invoice.deliveryDate || invoice.delivery && invoice.delivery.deliveredAt || invoice.date;
const deliveryTime = (invoice) => invoice.deliveryTime || invoice.delivery && invoice.delivery.deliveredAt && new Date(invoice.delivery.deliveredAt).toLocaleTimeString('en-IN') || invoice.time;
const generatedDate = (invoice) => invoice.generatedAt || invoice.date;

const fillExportFilters = () => {
    const currentValues = {
        driver: exportDriver.value,
        retailer: exportRetailer.value,
        product: exportProduct.value
    };
    const drivers = [...new Map(invoices.map((invoice) => [invoice.driver._id, invoice.driver])).values()];
    const retailers = [...new Map(invoices.map((invoice) => [invoice.retailer._id, invoice.retailer])).values()];
    const products = [...new Map(invoices.flatMap((invoice) => invoice.products).map((item) => [item.product._id, item.product])).values()];
    exportDriver.innerHTML = '<option value="">All drivers</option>' + drivers.map((driver) => `<option value="${driver._id}">${escapeHtml(driver.name)}</option>`).join('');
    exportRetailer.innerHTML = '<option value="">All retailers</option>' + retailers.map((retailer) => `<option value="${retailer._id}">${escapeHtml(retailer.shopName)}</option>`).join('');
    exportProduct.innerHTML = '<option value="">All products</option>' + products.map((product) => `<option value="${product._id}">${escapeHtml(product.name)}</option>`).join('');
    exportDriver.value = currentValues.driver;
    exportRetailer.value = currentValues.retailer;
    exportProduct.value = currentValues.product;
};

const matchesExportFilters = (invoice) => {
    const invoiceDate = new Date(invoice.deliveryDate || invoice.date).toISOString().slice(0, 10);
    const dateMatches = !exportDate.value || invoiceDate === exportDate.value;
    const driverMatches = !exportDriver.value || invoice.driver._id === exportDriver.value;
    const retailerMatches = !exportRetailer.value || invoice.retailer._id === exportRetailer.value;
    const productMatches = !exportProduct.value || invoice.products.some((item) => item.product._id === exportProduct.value);
    return dateMatches && driverMatches && retailerMatches && productMatches;
};

const renderInvoices = () => {
    const query = invoiceSearch.value.trim().toLowerCase();
    const filtered = invoices.filter((invoice) => [
        invoice.invoiceNumber,
        invoice.retailer.shopName,
        invoice.driver.name,
        invoice.vehicle.vehicleNumber,
        invoice.paymentStatus
    ].some((field) => String(field).toLowerCase().includes(query)) && matchesExportFilters(invoice));

    invoiceTableBody.innerHTML = filtered.length ? filtered.map((invoice) => `
        <tr>
            <td data-label="Invoice"><strong>${escapeHtml(invoice.invoiceNumber)}</strong></td>
            <td data-label="Generated">${formatDate(generatedDate(invoice))}<br><span class="invoice-time">${escapeHtml(invoice.time)}</span></td>
            <td data-label="Retailer">${escapeHtml(invoice.retailer.shopName)}</td>
            <td data-label="Driver">${escapeHtml(invoice.driver.name)}</td>
            <td data-label="Total">${formatMoney(invoice.totalAmount)}</td>
            <td data-label="Payment"><span class="status-pill status-${invoice.paymentStatus.toLowerCase()}">${escapeHtml(invoice.paymentStatus)}</span></td>
            <td class="table-actions"><button class="table-button" type="button" data-view-invoice="${invoice._id}">View</button></td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="7">No invoices found.</td></tr>';
};

const renderDetail = (invoice) => {
        invoiceDetail.innerHTML = `
        <div class="invoice-detail-heading">
            <div>
                <p class="eyebrow">Invoice details</p>
                <h2 id="invoice-detail-title">${escapeHtml(invoice.invoiceNumber)}</h2>
                <p class="invoice-meta">Generated: ${formatDate(invoice.date)} · ${escapeHtml(invoice.time)}<br>Delivered: ${formatDate(deliveryDate(invoice))} · ${escapeHtml(deliveryTime(invoice))}</p>
            </div>
            <div class="invoice-actions">
                <button class="secondary-button" id="print-invoice" type="button">Print invoice</button>
                <button class="primary-button" id="download-invoice" type="button">Download PDF</button>
            </div>
        </div>
        <div class="invoice-parties">
            <div><span>Retailer</span><strong>${escapeHtml(invoice.retailer.shopName)}</strong><small>${escapeHtml(invoice.retailer.ownerName)} · ${escapeHtml(invoice.retailer.city)}</small><small>${escapeHtml(invoice.retailer.gstNumber)}</small></div>
            <div><span>Delivery</span><strong>${escapeHtml(invoice.driver.name)}</strong><small>${escapeHtml(invoice.vehicle.vehicleNumber)} · ${escapeHtml(invoice.vehicle.vehicleType)}</small><small>Payment: ${escapeHtml(invoice.paymentStatus)}</small></div>
        </div>
        <div class="table-wrap">
            <table class="invoice-items">
                <colgroup><col class="invoice-product-col"><col class="invoice-quantity-col"><col class="invoice-price-col"><col class="invoice-total-col"></colgroup>
                <thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead>
                <tbody>${invoice.products.map((item) => `<tr><td>${escapeHtml(item.productName)}</td><td>${item.quantity}</td><td>${formatMoney(item.unitPrice)}</td><td>${formatMoney(item.totalAmount)}</td></tr>`).join('')}</tbody>
            </table>
        </div>
        <p class="invoice-total">Total amount: <strong>${formatMoney(invoice.totalAmount)}</strong></p>
    `;
    invoiceDetail.classList.remove('hidden');

    document.querySelector('#print-invoice').addEventListener('click', () => printInvoice(invoice));
    document.querySelector('#download-invoice').addEventListener('click', async() => {
        try {
            const response = await fetch(`${invoicesApi}/${invoice._id}/pdf`);
            if (!response.ok) throw new Error('Unable to generate invoice PDF');
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${invoice.invoiceNumber}.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            listMessage.textContent = error.message;
        }
    });
};

const printInvoice = (invoice) => {
    const printable = window.open('', '_blank', 'width=900,height=700');
    printable.document.write(`<!doctype html><html><head><title>${escapeHtml(invoice.invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;color:#17232b;padding:36px}h1{color:#2f806a}header{display:flex;justify-content:space-between;border-bottom:2px solid #2f806a;padding-bottom:18px}.party{display:inline-block;width:48%;vertical-align:top;margin:24px 0}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:18px}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}th:nth-child(1),td:nth-child(1){width:48%}th:nth-child(2),td:nth-child(2){width:14%;text-align:right}th:nth-child(3),td:nth-child(3){width:19%;text-align:right}th:nth-child(4),td:nth-child(4){width:19%;text-align:right}.total{text-align:right;font-size:18px;margin-top:24px}</style></head><body><header><h1>LogEase</h1><div><strong>${escapeHtml(invoice.invoiceNumber)}</strong><br>Generated: ${formatDate(invoice.date)} · ${escapeHtml(invoice.time)}<br>Delivered: ${formatDate(deliveryDate(invoice))} · ${escapeHtml(deliveryTime(invoice))}</div></header><div class="party"><strong>Retailer</strong><br>${escapeHtml(invoice.retailer.shopName)}<br>${escapeHtml(invoice.retailer.ownerName)}<br>${escapeHtml(invoice.retailer.city)}<br>${escapeHtml(invoice.retailer.gstNumber)}</div><div class="party"><strong>Delivery</strong><br>${escapeHtml(invoice.driver.name)}<br>${escapeHtml(invoice.vehicle.vehicleNumber)}</div><table><colgroup><col style="width:48%"><col style="width:14%"><col style="width:19%"><col style="width:19%"></colgroup><thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${invoice.products.map((item) => `<tr><td>${escapeHtml(item.productName)}</td><td>${item.quantity}</td><td>${formatMoney(item.unitPrice)}</td><td>${formatMoney(item.totalAmount)}</td></tr>`).join('')}</tbody></table><p class="total"><strong>Total: ${formatMoney(invoice.totalAmount)}</strong></p></body></html>`);
    printable.document.close();
    printable.focus();
    printable.print();
};

const loadInvoices = async() => {
    try {
        const response = await fetch(invoicesApi);
        if (!response.ok) throw new Error('Unable to load invoices');
        invoices = await response.json();
        fillExportFilters();
        listMessage.textContent = `${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`;
        renderInvoices();
    } catch (error) {
        listMessage.textContent = error.message;
    }
};

invoiceSearch.addEventListener('input', renderInvoices);
[exportDate, exportDriver, exportRetailer, exportProduct].forEach((filter) => filter.addEventListener('change', renderInvoices));
exportExcel.addEventListener('click', async() => {
    const params = new URLSearchParams();
    if (exportDate.value) params.set('date', exportDate.value);
    if (exportDriver.value) params.set('driver', exportDriver.value);
    if (exportRetailer.value) params.set('retailer', exportRetailer.value);
    if (exportProduct.value) params.set('product', exportProduct.value);

    exportExcel.disabled = true;
    try {
        const response = await fetch(`${API_BASE}/exports/invoices.xlsx?${params.toString()}`);
        if (!response.ok) throw new Error('Unable to export invoices');
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'logease-invoices.xlsx';
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        listMessage.textContent = error.message;
    } finally {
        exportExcel.disabled = false;
    }
});
invoiceTableBody.addEventListener('click', async(event) => {
    const button = event.target.closest('[data-view-invoice]');
    if (!button) return;
    try {
        const response = await fetch(`${invoicesApi}/${button.dataset.viewInvoice}`);
        if (!response.ok) throw new Error('Unable to load invoice details');
        renderDetail(await response.json());
    } catch (error) {
        listMessage.textContent = error.message;
    }
});

loadInvoices();