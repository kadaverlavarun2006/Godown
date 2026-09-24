// LogEase Retailer Portal Logic

const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
let availableProducts = [];
let orderCart = [];
let myOrders = [];
let myInvoices = [];

const formatMoney = (val) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
}).format(val || 0);

const formatDate = (val) => {
    if (!val) return '--';
    const d = new Date(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const escapeHtml = (val) => String(val || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

// Elements
const productSelect = document.querySelector('#order-product');
const quantityInput = document.querySelector('#order-quantity');
const unitPriceInput = document.querySelector('#order-unit-price');
const btnAddLine = document.querySelector('#btn-add-line');
const orderItemsList = document.querySelector('#order-items-list');
const orderTotalAmount = document.querySelector('#order-total-amount');
const btnSubmitOrder = document.querySelector('#btn-submit-order');
const orderFormMessage = document.querySelector('#order-form-message');

const ordersTbody = document.querySelector('#retailer-orders-tbody');
const ordersCount = document.querySelector('#orders-count');
const billsTbody = document.querySelector('#retailer-bills-tbody');
const billsCount = document.querySelector('#bills-count');
const paymentsTbody = document.querySelector('#retailer-payments-tbody');
const paymentsCount = document.querySelector('#payments-count');

// KPI elements
const kpiTotalOrders = document.querySelector('#retailer-total-orders');
const kpiActiveOrders = document.querySelector('#retailer-active-orders');
const kpiPendingBills = document.querySelector('#retailer-pending-bills');
const kpiTotalPaid = document.querySelector('#retailer-total-paid');

// Tab Switching
document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
    });
});

// Load User & Store Information
const loadProfile = async () => {
    try {
        const res = await fetch(`${API_BASE}/auth/me`);
        if (res.ok) {
            const data = await res.json();
            const user = data.user;
            const storeTitle = document.querySelector('#store-title');
            const storeMeta = document.querySelector('#store-meta');
            if (storeTitle && user.retailer) {
                storeTitle.textContent = user.retailer.shopName || `${user.name}'s Store`;
            }
            if (storeMeta && user.retailer) {
                storeMeta.textContent = `Owner: ${user.retailer.ownerName || user.name} · City: ${user.retailer.city || 'General'} · GST: ${user.retailer.gstNumber || 'Registered'}`;
            }
        }
    } catch (e) {
        console.warn('Could not load profile metadata', e);
    }
};

// Load Products for Order Placement
const loadProducts = async () => {
    try {
        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) throw new Error('Failed to load products');
        availableProducts = await res.json();
        availableProducts = availableProducts.filter((p) => p.active);

        productSelect.innerHTML = `<option value="">Choose a product...</option>` +
            availableProducts.map((p) => `
                <option value="${p._id}" data-price="${p.sellingPrice}">
                    ${escapeHtml(p.name)} (${escapeHtml(p.packSize)}) - ${formatMoney(p.sellingPrice)}
                </option>
            `).join('');
    } catch (e) {
        productSelect.innerHTML = `<option value="">Error loading products</option>`;
    }
};

// Update unit price on product selection
productSelect.addEventListener('change', () => {
    const selectedOption = productSelect.selectedOptions[0];
    const price = selectedOption?.dataset.price;
    unitPriceInput.value = price ? formatMoney(price) : '';
});

// Add Item to Order Cart
btnAddLine.addEventListener('click', () => {
    const productId = productSelect.value;
    const qty = parseInt(quantityInput.value, 10);

    if (!productId) {
        alert('Please choose a product to order.');
        return;
    }
    if (!qty || qty <= 0) {
        alert('Please enter a valid quantity greater than 0.');
        return;
    }

    const prod = availableProducts.find((p) => p._id === productId);
    if (!prod) return;

    const existingIndex = orderCart.findIndex((item) => item.product === productId);
    if (existingIndex > -1) {
        orderCart[existingIndex].quantity += qty;
    } else {
        orderCart.push({
            product: prod._id,
            name: prod.name,
            packSize: prod.packSize,
            price: prod.sellingPrice,
            quantity: qty
        });
    }

    quantityInput.value = '';
    renderOrderCart();
});

const renderOrderCart = () => {
    if (orderCart.length === 0) {
        orderItemsList.innerHTML = `<p class="line-placeholder">No items added to this order yet.</p>`;
        orderTotalAmount.textContent = formatMoney(0);
        btnSubmitOrder.disabled = true;
        return;
    }

    let total = 0;
    orderItemsList.innerHTML = orderCart.map((item, index) => {
        const itemTotal = item.quantity * item.price;
        total += itemTotal;
        return `
            <div class="order-item-row">
                <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <div style="font-size: 0.8rem; color: var(--muted);">${item.quantity} x ${formatMoney(item.price)} (${escapeHtml(item.packSize)})</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong>${formatMoney(itemTotal)}</strong>
                    <button class="text-button" type="button" onclick="removeCartItem(${index})" style="color: #c53030;">Remove</button>
                </div>
            </div>
        `;
    }).join('');

    orderTotalAmount.textContent = formatMoney(total);
    btnSubmitOrder.disabled = false;
};

window.removeCartItem = (index) => {
    orderCart.splice(index, 1);
    renderOrderCart();
};

// Submit Order
btnSubmitOrder.addEventListener('click', async () => {
    if (orderCart.length === 0) return;

    btnSubmitOrder.disabled = true;
    btnSubmitOrder.textContent = 'Submitting order...';
    orderFormMessage.textContent = '';

    try {
        const payload = {
            products: orderCart.map((item) => ({
                product: item.product,
                quantity: item.quantity
            }))
        };

        const res = await fetch(`${API_BASE}/deliveries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to place order');

        orderFormMessage.textContent = 'Order placed successfully! Track its progress in "My Orders".';
        orderFormMessage.className = 'form-message alert-success';
        orderCart = [];
        renderOrderCart();

        // Refresh orders and KPI
        await loadOrders();
    } catch (e) {
        orderFormMessage.textContent = e.message;
        orderFormMessage.className = 'form-message alert-error';
    } finally {
        btnSubmitOrder.disabled = orderCart.length === 0;
        btnSubmitOrder.textContent = 'Confirm & Submit Order';
    }
});

// Load Retailer's Orders
const loadOrders = async () => {
    try {
        const res = await fetch(`${API_BASE}/deliveries`);
        if (!res.ok) throw new Error('Unable to load orders');
        myOrders = await res.json();

        ordersCount.textContent = `${myOrders.length} order${myOrders.length === 1 ? '' : 's'}`;
        renderOrders();
        updateKPIs();
    } catch (e) {
        ordersTbody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
    }
};

const renderOrders = () => {
    if (!myOrders.length) {
        ordersTbody.innerHTML = `<tr><td colspan="5" class="empty-state">You have not placed any orders yet.</td></tr>`;
        return;
    }

    ordersTbody.innerHTML = myOrders.map((ord) => {
        const totalRequested = ord.products.reduce((acc, p) => acc + (p.quantity || 0), 0);
        const delivered = ord.deliveredQuantity || 0;
        const productsSummary = ord.products.map((p) => `${escapeHtml(p.product?.name || 'Product')} (${p.quantity})`).join(', ');

        return `
            <tr>
                <td>${formatDate(ord.createdAt)}</td>
                <td title="${productsSummary}" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${productsSummary}
                </td>
                <td><strong>${totalRequested}</strong> units</td>
                <td>${delivered} units</td>
                <td>
                    <span class="status-pill status-${(ord.status || 'pending').toLowerCase()}">
                        ${escapeHtml(ord.status.replaceAll('_', ' '))}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
};

// Load Retailer's Bills (Invoices)
const loadBills = async () => {
    try {
        const res = await fetch(`${API_BASE}/invoices`);
        if (!res.ok) throw new Error('Unable to load bills');
        myInvoices = await res.json();

        billsCount.textContent = `${myInvoices.length} bill${myInvoices.length === 1 ? '' : 's'}`;
        paymentsCount.textContent = `${myInvoices.filter((i) => i.paymentStatus === 'PAID').length} paid`;

        renderBills();
        renderPayments();
        updateKPIs();
    } catch (e) {
        billsTbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
    }
};

const renderBills = () => {
    if (!myInvoices.length) {
        billsTbody.innerHTML = `<tr><td colspan="6" class="empty-state">No bills generated yet. Bills are automatically created when your deliveries arrive.</td></tr>`;
        return;
    }

    billsTbody.innerHTML = myInvoices.map((inv) => {
        const isPaid = inv.paymentStatus === 'PAID';
        const productsList = (inv.products || []).map((p) => `${escapeHtml(p.productName)} x${p.quantity}`).join(', ');

        return `
            <tr>
                <td><strong>${escapeHtml(inv.invoiceNumber)}</strong></td>
                <td>${formatDate(inv.date)}</td>
                <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${productsList}">
                    ${productsList}
                </td>
                <td><strong>${formatMoney(inv.totalAmount)}</strong></td>
                <td>
                    <span class="status-pill status-${inv.paymentStatus.toLowerCase()}">
                        ${escapeHtml(inv.paymentStatus)}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        ${!isPaid ? `<button class="pay-btn" type="button" onclick="payBill('${inv._id}')">Pay Now</button>` : '<span style="color: var(--green); font-size: 0.85rem; font-weight: 700;">Paid</span>'}
                        <button class="text-button" type="button" onclick="downloadInvoicePdf('${inv._id}', '${inv.invoiceNumber}')">PDF</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

const renderPayments = () => {
    const paidList = myInvoices.filter((i) => i.paymentStatus === 'PAID' || i.paymentStatus === 'PARTIAL');
    if (!paidList.length) {
        paymentsTbody.innerHTML = `<tr><td colspan="5" class="empty-state">No payments on record yet.</td></tr>`;
        return;
    }

    paymentsTbody.innerHTML = paidList.map((inv) => `
        <tr>
            <td><strong>${escapeHtml(inv.invoiceNumber)}</strong></td>
            <td>${formatDate(inv.date)}</td>
            <td><strong>${formatMoney(inv.totalAmount)}</strong></td>
            <td>
                <span class="status-pill status-${inv.paymentStatus.toLowerCase()}">
                    ${escapeHtml(inv.paymentStatus)}
                </span>
            </td>
            <td>
                <button class="text-button" type="button" onclick="downloadInvoicePdf('${inv._id}', '${inv.invoiceNumber}')">Download Receipt</button>
            </td>
        </tr>
    `).join('');
};

// Make Payment on a Bill
window.payBill = async (invoiceId) => {
    if (!confirm('Confirm payment for this invoice?')) return;

    try {
        const res = await fetch(`${API_BASE}/invoices/${invoiceId}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus: 'PAID' })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Payment processing failed');
        }

        alert('Payment completed successfully!');
        await loadBills();
    } catch (e) {
        alert(e.message);
    }
};

// Download Invoice PDF
window.downloadInvoicePdf = async (invoiceId, invoiceNumber) => {
    try {
        const res = await fetch(`${API_BASE}/invoices/${invoiceId}/pdf`);
        if (!res.ok) throw new Error('Unable to download invoice PDF');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoiceNumber}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert(e.message);
    }
};

// Update KPIs
const updateKPIs = () => {
    kpiTotalOrders.innerHTML = `${myOrders.length} <span>placed</span>`;
    const active = myOrders.filter((o) => ['PENDING', 'ASSIGNED', 'LOADED', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
    kpiActiveOrders.innerHTML = `${active} <span>in progress</span>`;

    const pendingAmount = myInvoices
        .filter((i) => i.paymentStatus !== 'PAID')
        .reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    kpiPendingBills.textContent = formatMoney(pendingAmount);

    const paidAmount = myInvoices
        .filter((i) => i.paymentStatus === 'PAID')
        .reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    kpiTotalPaid.textContent = formatMoney(paidAmount);
};

// Initial Load
(async () => {
    await loadProfile();
    await Promise.all([loadProducts(), loadOrders(), loadBills()]);
})();
