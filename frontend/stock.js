const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
const stockApi = `${API_BASE}/stock`;
const productsApi = `${API_BASE}/products`;
const stockForm = document.querySelector('#stock-form');
const productSelect = document.querySelector('#product');
const stockDate = document.querySelector('#stock-date');
const formMessage = document.querySelector('#stock-form-message');
const currentStockBody = document.querySelector('#current-stock-body');
const currentStockMessage = document.querySelector('#current-stock-message');
const historyBody = document.querySelector('#stock-history-body');
const historyMessage = document.querySelector('#history-message');
const stockSearch = document.querySelector('#stock-search');
const stockProductFilter = document.querySelector('#stock-product-filter');
const refreshStock = document.querySelector('#refresh-stock');

let products = [];
let transactions = [];

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

const setToday = () => {
    const now = new Date();
    stockDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const renderProductOptions = () => {
    const options = products.map((product) => `<option value="${product._id}">${escapeHtml(product.name)} (${escapeHtml(product.packSize)})</option>`).join('');
    productSelect.innerHTML = `<option value="">Select product</option>${options}`;
    stockProductFilter.innerHTML = `<option value="">All products</option>${options.replace('Select product', 'All products')}`;
};

const renderCurrentStock = (stock) => {
    currentStockBody.innerHTML = stock.length ? stock.map((item) => `
        <tr>
            <td data-label="Product"><strong>${escapeHtml(item.product.name)}</strong></td>
            <td data-label="Category">${escapeHtml(item.product.category)}</td>
            <td data-label="Pack size">${escapeHtml(item.product.packSize)}</td>
            <td data-label="Quantity">${item.quantity}</td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="4">No stock has been recorded yet.</td></tr>';
    currentStockMessage.textContent = `${stock.length} product${stock.length === 1 ? '' : 's'} with stock`;
};

const renderHistory = () => {
    const query = stockSearch.value.trim().toLowerCase();
    const productId = stockProductFilter.value;
    const filteredTransactions = transactions.filter((transaction) => {
        const matchesProduct = !productId || (transaction.product && transaction.product._id === productId);
        const searchableText = [
            transaction.product && transaction.product.name,
            transaction.supplier,
            transaction.invoiceNumber,
            transaction.batchNumber,
            transaction.createdBy
        ].join(' ').toLowerCase();
        return matchesProduct && searchableText.includes(query);
    });

    historyBody.innerHTML = filteredTransactions.length ? filteredTransactions.map((transaction) => `
        <tr>
            <td data-label="Date">${formatDate(transaction.date)}</td>
            <td data-label="Product"><strong>${escapeHtml(transaction.product && transaction.product.name || 'Unknown')}</strong></td>
            <td data-label="Quantity">${transaction.quantity}</td>
            <td data-label="Supplier">${escapeHtml(transaction.supplier)}</td>
            <td data-label="Invoice">${escapeHtml(transaction.invoiceNumber)}</td>
            <td data-label="Batch">${escapeHtml(transaction.batchNumber)}</td>
            <td data-label="Created by">${escapeHtml(transaction.createdBy)}</td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="7">No matching stock transactions.</td></tr>';
};

const loadProducts = async() => {
    const response = await fetch(productsApi);
    if (!response.ok) {
        throw new Error('Unable to load products');
    }

    products = (await response.json()).filter((product) => product.active);
    renderProductOptions();
};

const loadStock = async() => {
    const [currentResponse, historyResponse] = await Promise.all([
        fetch(`${stockApi}/current`),
        fetch(`${stockApi}/transactions`)
    ]);

    if (!currentResponse.ok || !historyResponse.ok) {
        throw new Error('Unable to load stock data');
    }

    renderCurrentStock(await currentResponse.json());
    transactions = await historyResponse.json();
    historyMessage.textContent = `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`;
    renderHistory();
};

const loadPage = async() => {
    try {
        await loadProducts();
        await loadStock();
    } catch (error) {
        currentStockMessage.textContent = error.message;
        historyMessage.textContent = error.message;
    }
};

stockForm.addEventListener('submit', async(event) => {
    event.preventDefault();
    formMessage.textContent = '';

    const formData = new FormData(stockForm);
    const payload = Object.fromEntries(formData.entries());
    payload.quantity = Number(payload.quantity);

    try {
        const response = await fetch(`${stockApi}/in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Unable to record stock');
        }

        formMessage.textContent = 'Stock transaction recorded.';
        stockForm.reset();
        setToday();
        await loadStock();
    } catch (error) {
        formMessage.textContent = error.message;
    }
});

stockSearch.addEventListener('input', renderHistory);
stockProductFilter.addEventListener('change', renderHistory);
refreshStock.addEventListener('click', loadPage);
setToday();
loadPage();