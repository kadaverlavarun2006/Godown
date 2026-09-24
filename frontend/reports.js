const reportsApi = 'http://localhost:5000/api/reports';
const reportType = document.querySelector('#report-type');
const reportFrom = document.querySelector('#report-from');
const reportTo = document.querySelector('#report-to');
const reportDriver = document.querySelector('#report-driver');
const reportRetailer = document.querySelector('#report-retailer');
const reportProduct = document.querySelector('#report-product');
const reportTable = document.querySelector('#report-table');
const reportTitle = document.querySelector('#report-result-title');
const reportMessage = document.querySelector('#report-message');

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
}).format(value);

const setDefaultDates = () => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    const dateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    reportFrom.value = dateValue(from);
    reportTo.value = dateValue(today);
};

const fillSelect = (select, placeholder, items, label) => {
        select.innerHTML = `<option value="">${placeholder}</option>${items.map((item) => `<option value="${item._id}">${escapeHtml(label(item))}</option>`).join('')}`;
};

const loadFilters = async() => {
    const responses = await Promise.all([
        fetch('http://localhost:5000/api/drivers'),
        fetch('http://localhost:5000/api/retailers'),
        fetch('http://localhost:5000/api/products')
    ]);
    if (responses.some((response) => !response.ok)) throw new Error('Unable to load report filters');
    const [drivers, retailers, products] = await Promise.all(responses.map((response) => response.json()));
    fillSelect(reportDriver, 'All drivers', drivers, (item) => item.name);
    fillSelect(reportRetailer, 'All retailers', retailers, (item) => item.shopName);
    fillSelect(reportProduct, 'All products', products, (item) => item.name);
};

const getParams = () => {
    const params = new URLSearchParams({
        type: reportType.value,
        from: reportFrom.value,
        to: reportTo.value
    });
    if (reportDriver.value) params.set('driver', reportDriver.value);
    if (reportRetailer.value) params.set('retailer', reportRetailer.value);
    if (reportProduct.value) params.set('product', reportProduct.value);
    return params;
};

const displayValue = (column, value) => column === 'Amount' ? formatMoney(value || 0) : value ?? '';

const renderReport = (report) => {
    reportTitle.textContent = report.title;
    reportMessage.textContent = `${report.rows.length} row${report.rows.length === 1 ? '' : 's'}`;
    reportTable.innerHTML = `
        <thead><tr>${report.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
        <tbody>${report.rows.length ? report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(displayValue(column, row[column]))}</td>`).join('')}</tr>`).join('') : `<tr><td class="empty-state" colspan="${report.columns.length}">No data for this report range.</td></tr>`}</tbody>
    `;
};

const viewReport = async() => {
    reportMessage.textContent = 'Loading report...';
    try {
        const response = await fetch(`${reportsApi}?${getParams()}`);
        if (!response.ok) throw new Error((await response.json()).message || 'Unable to load report');
        renderReport(await response.json());
    } catch (error) {
        reportMessage.textContent = error.message;
    }
};

const downloadReport = async(extension) => {
    const button = extension === 'xlsx' ? document.querySelector('#download-report-excel') : document.querySelector('#download-report-pdf');
    button.disabled = true;
    try {
        const response = await fetch(`${reportsApi}/export.${extension}?${getParams()}`);
        if (!response.ok) throw new Error('Unable to download report');
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `logease-${reportType.value}-report.${extension}`;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        reportMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
};

document.querySelector('#view-report').addEventListener('click', viewReport);
document.querySelector('#download-report-excel').addEventListener('click', () => downloadReport('xlsx'));
document.querySelector('#download-report-pdf').addEventListener('click', () => downloadReport('pdf'));
setDefaultDates();
loadFilters().then(viewReport).catch((error) => { reportMessage.textContent = error.message; });