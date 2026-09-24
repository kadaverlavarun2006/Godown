// LogEase Driver Portal Logic

const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
let myDeliveries = [];
let currentModalDelivery = null;

const formatDate = (val) => {
    if (!val) return '--';
    const d = new Date(val);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const escapeHtml = (val) => String(val || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

// DOM Elements
const kpiActiveDeliveries = document.querySelector('#kpi-active-deliveries');
const kpiInTransit = document.querySelector('#kpi-in-transit');
const kpiCompleted = document.querySelector('#kpi-completed');

const activeDeliveriesContainer = document.querySelector('#active-deliveries-container');
const activeDeliveriesCount = document.querySelector('#active-deliveries-count');
const driverHistoryTbody = document.querySelector('#driver-history-tbody');
const historyDeliveriesCount = document.querySelector('#history-deliveries-count');

// Modal Elements
const completionModal = document.querySelector('#completion-modal');
const completionForm = document.querySelector('#completion-form');
const modalDeliveryId = document.querySelector('#modal-delivery-id');
const modalStatusSelect = document.querySelector('#modal-status-select');
const modalProductsTbody = document.querySelector('#modal-products-tbody');
const modalReturnReason = document.querySelector('#modal-return-reason');
const modalErrorMessage = document.querySelector('#modal-error-message');
const btnCloseModal = document.querySelector('#btn-close-modal');
const btnCancelModal = document.querySelector('#btn-cancel-modal');
const btnSubmitCompletion = document.querySelector('#btn-submit-completion');

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

// Load Driver Profile & Meta
const loadProfile = async () => {
    try {
        const res = await fetch(`${API_BASE}/auth/me`);
        if (res.ok) {
            const data = await res.json();
            const user = data.user;
            const greeting = document.querySelector('#driver-greeting');
            const meta = document.querySelector('#driver-meta');
            if (greeting) {
                greeting.textContent = `Welcome, ${user.name}`;
            }
            if (meta && user.driver) {
                meta.textContent = `License: ${user.driver.licenseNumber || 'Verified'} · Phone: ${user.driver.phone || '--'} · Active Assigned Routes`;
            }
        }
    } catch (e) {
        console.warn('Could not load driver profile metadata', e);
    }
};

// Fetch Deliveries
const loadDeliveries = async () => {
    try {
        const res = await fetch(`${API_BASE}/deliveries`);
        if (!res.ok) {
            throw new Error('Failed to fetch assigned deliveries');
        }

        myDeliveries = await res.json();
        renderKPIs();
        renderActiveDeliveries();
        renderHistory();
    } catch (error) {
        if (activeDeliveriesContainer) {
            activeDeliveriesContainer.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
        }
        if (driverHistoryTbody) {
            driverHistoryTbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
        }
    }
};

// Render KPIs
const renderKPIs = () => {
    const active = myDeliveries.filter((d) => ['ASSIGNED', 'LOADED', 'OUT_FOR_DELIVERY'].includes(d.status));
    const inTransit = myDeliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY');
    const completed = myDeliveries.filter((d) => ['DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED'].includes(d.status));

    if (kpiActiveDeliveries) kpiActiveDeliveries.innerHTML = `${active.length} <span>trips</span>`;
    if (kpiInTransit) kpiInTransit.innerHTML = `${inTransit.length} <span>en route</span>`;
    if (kpiCompleted) kpiCompleted.innerHTML = `${completed.length} <span>delivered</span>`;
};

// Render Active Deliveries
const renderActiveDeliveries = () => {
    const active = myDeliveries.filter((d) => ['ASSIGNED', 'LOADED', 'OUT_FOR_DELIVERY'].includes(d.status));
    if (activeDeliveriesCount) {
        activeDeliveriesCount.textContent = `${active.length} active trip${active.length === 1 ? '' : 's'}`;
    }

    if (!active.length) {
        activeDeliveriesContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 48px 24px;">
                <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">No Active Deliveries</p>
                <p style="color: var(--muted); margin: 0;">You have no active shipments assigned at this moment.</p>
            </div>
        `;
        return;
    }

    activeDeliveriesContainer.innerHTML = active.map((d) => {
        const retailer = d.retailer || {};
        const vehicle = d.vehicle || {};
        const products = d.products || [];

        let statusClass = 'status-assigned';
        let statusLabel = d.status;
        if (d.status === 'LOADED') {
            statusClass = 'status-loaded';
            statusLabel = 'Loaded & Ready';
        } else if (d.status === 'OUT_FOR_DELIVERY') {
            statusClass = 'status-transit';
            statusLabel = 'Out For Delivery';
        } else if (d.status === 'ASSIGNED') {
            statusClass = 'status-assigned';
            statusLabel = 'Assigned (Pending Load)';
        }

        const productItemsHtml = products.map((item) => {
            const p = item.product || {};
            return `
                <div class="driver-product-row">
                    <div>
                        <strong>${escapeHtml(p.name || 'Product')}</strong>
                        <span class="product-pack">(${escapeHtml(p.packSize || '--')})</span>
                    </div>
                    <div class="product-qty-badge">
                        <span>Loaded: <strong>${item.loadedQuantity || 0}</strong></span>
                        <span class="req-qty">(Req: ${item.quantity || 0})</span>
                    </div>
                </div>
            `;
        }).join('');

        let actionBtnHtml = '';
        if (d.status === 'LOADED') {
            actionBtnHtml = `
                <button type="button" class="primary-btn btn-start-transit" data-id="${d._id}" style="width: 100%;">
                    Start Trip (Out For Delivery) 🚚
                </button>
            `;
        } else if (d.status === 'OUT_FOR_DELIVERY') {
            actionBtnHtml = `
                <button type="button" class="primary-btn btn-open-completion" data-id="${d._id}" style="width: 100%; background: #2f806a;">
                    Record Handover / Update Status ✓
                </button>
            `;
        } else {
            actionBtnHtml = `
                <p class="status-waiting-note">
                    ⏳ Warehouse is preparing and loading stock for this shipment.
                </p>
            `;
        }

        return `
            <article class="driver-card" data-id="${d._id}">
                <div class="driver-card-header">
                    <div>
                        <span class="status-pill ${statusClass}">${statusLabel}</span>
                        <p class="card-created-date">Assigned: ${formatDate(d.createdAt)}</p>
                    </div>
                    <span class="vehicle-tag">${escapeHtml(vehicle.vehicleNumber || 'Vehicle')}</span>
                </div>

                <div class="driver-retailer-info">
                    <h3 class="retailer-name">${escapeHtml(retailer.shopName || 'Retailer Shop')}</h3>
                    <p class="retailer-owner">Owner: ${escapeHtml(retailer.ownerName || '--')}</p>
                    <div class="retailer-contact-row">
                        <span class="retailer-phone">📞 ${escapeHtml(retailer.phone || '--')}</span>
                        ${retailer.phone ? `<a href="tel:${escapeHtml(retailer.phone)}" class="call-btn">Call Retailer</a>` : ''}
                    </div>
                    <p class="retailer-address">
                        📍 <strong>Address:</strong> ${escapeHtml(retailer.address || '--')}, ${escapeHtml(retailer.city || '')}
                    </p>
                </div>

                <div class="driver-products-box">
                    <h4>Assigned Products (${products.length})</h4>
                    <div class="driver-products-list">
                        ${productItemsHtml}
                    </div>
                </div>

                <div class="driver-card-actions">
                    ${actionBtnHtml}
                </div>
            </article>
        `;
    }).join('');

    // Attach Event Handlers
    document.querySelectorAll('.btn-start-transit').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await updateDeliveryTransit(id);
        });
    });

    document.querySelectorAll('.btn-open-completion').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            openCompletionModal(id);
        });
    });
};

// Start Trip (Status -> OUT_FOR_DELIVERY)
const updateDeliveryTransit = async (deliveryId) => {
    if (!confirm('Are you starting delivery transit for this shipment?')) return;

    try {
        const res = await fetch(`${API_BASE}/deliveries/${deliveryId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'OUT_FOR_DELIVERY',
                reason: 'Driver started delivery route'
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Failed to update status');
        }

        await loadDeliveries();
    } catch (error) {
        alert(error.message);
    }
};

// Modal Logic
const showModalError = (msg) => {
    if (!msg) {
        modalErrorMessage.textContent = '';
        modalErrorMessage.classList.add('hidden');
    } else {
        modalErrorMessage.textContent = msg;
        modalErrorMessage.classList.remove('hidden');
    }
};

const openCompletionModal = (deliveryId) => {
    const delivery = myDeliveries.find((d) => d._id === deliveryId);
    if (!delivery) return;

    currentModalDelivery = delivery;
    modalDeliveryId.value = delivery._id;
    modalStatusSelect.value = 'DELIVERED';
    modalReturnReason.value = '';
    showModalError('');

    renderModalProductRows('DELIVERED');
    completionModal.classList.remove('hidden');
};

const closeModal = () => {
    completionModal.classList.add('hidden');
    currentModalDelivery = null;
};

if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

modalStatusSelect.addEventListener('change', () => {
    const status = modalStatusSelect.value;
    renderModalProductRows(status);
});

const renderModalProductRows = (status) => {
    if (!currentModalDelivery) return;

    modalProductsTbody.innerHTML = currentModalDelivery.products.map((item, index) => {
        const p = item.product || {};
        const loaded = item.loadedQuantity || 0;

        let delivered = loaded;
        let returned = 0;
        let damaged = 0;

        if (status === 'RETURNED') {
            delivered = 0;
            returned = loaded;
        }

        return `
            <tr data-product-id="${p._id}">
                <td>
                    <strong>${escapeHtml(p.name || 'Product')}</strong>
                    <div class="product-pack">${escapeHtml(p.packSize || '')}</div>
                </td>
                <td class="num-col loaded-qty" data-loaded="${loaded}">
                    <strong>${loaded}</strong>
                </td>
                <td>
                    <input type="number" class="modal-input-delivered" min="0" max="${loaded}" value="${delivered}" data-index="${index}" style="width: 75px; text-align: right;" required />
                </td>
                <td>
                    <input type="number" class="modal-input-returned" min="0" max="${loaded}" value="${returned}" data-index="${index}" style="width: 75px; text-align: right;" required />
                </td>
                <td>
                    <input type="number" class="modal-input-damaged" min="0" max="${loaded}" value="${damaged}" data-index="${index}" style="width: 75px; text-align: right;" required />
                </td>
            </tr>
        `;
    }).join('');
};

// Handle Completion Form Submit
completionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showModalError('');

    if (!currentModalDelivery) return;

    const deliveryId = modalDeliveryId.value;
    const status = modalStatusSelect.value;
    const returnReason = modalReturnReason.value.trim();

    const productRows = modalProductsTbody.querySelectorAll('tr');
    const productsPayload = [];
    let hasReturnsOrDamage = false;

    for (const row of productRows) {
        const productId = row.dataset.productId;
        const loadedQty = Number(row.querySelector('.loaded-qty').dataset.loaded);
        const deliveredQty = Number(row.querySelector('.modal-input-delivered').value || 0);
        const returnedQty = Number(row.querySelector('.modal-input-returned').value || 0);
        const damagedQty = Number(row.querySelector('.modal-input-damaged').value || 0);

        if (deliveredQty < 0 || returnedQty < 0 || damagedQty < 0) {
            showModalError('Product quantities cannot be negative.');
            return;
        }

        if (deliveredQty + returnedQty + damagedQty !== loadedQty) {
            showModalError(`For one of the items, Delivered (${deliveredQty}) + Returned (${returnedQty}) + Damaged (${damagedQty}) does not match Loaded (${loadedQty}).`);
            return;
        }

        if (returnedQty > 0 || damagedQty > 0) {
            hasReturnsOrDamage = true;
        }

        productsPayload.push({
            product: productId,
            deliveredQuantity: deliveredQty,
            returnedQuantity: returnedQty,
            damagedQuantity: damagedQty,
            returnReason: returnReason
        });
    }

    if (hasReturnsOrDamage && !returnReason) {
        showModalError('Please enter a return/damage reason explaining why items were not delivered.');
        modalReturnReason.focus();
        return;
    }

    btnSubmitCompletion.disabled = true;
    btnSubmitCompletion.textContent = 'Submitting Handover...';

    try {
        const res = await fetch(`${API_BASE}/deliveries/${deliveryId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                products: productsPayload,
                returnReason,
                reason: returnReason || `Delivery completed by driver with status ${status}`
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Failed to update delivery status');
        }

        closeModal();
        await loadDeliveries();
    } catch (error) {
        showModalError(error.message);
    } finally {
        btnSubmitCompletion.disabled = false;
        btnSubmitCompletion.textContent = 'Confirm & Update Status';
    }
});

// Render Delivery History
const renderHistory = () => {
    const history = myDeliveries.filter((d) => ['DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED'].includes(d.status));
    if (historyDeliveriesCount) {
        historyDeliveriesCount.textContent = `${history.length} completed delivery record${history.length === 1 ? '' : 's'}`;
    }

    if (!history.length) {
        driverHistoryTbody.innerHTML = `<tr><td colspan="6" class="empty-state">No completed delivery records yet.</td></tr>`;
        return;
    }

    driverHistoryTbody.innerHTML = history.map((d) => {
        const retailer = d.retailer || {};
        const products = d.products || [];

        const productsSummary = products.map((item) => {
            const p = item.product || {};
            return `${escapeHtml(p.name || 'Product')} (${item.deliveredQuantity || 0} del / ${item.returnedQuantity || 0} ret / ${item.damagedQuantity || 0} dam)`;
        }).join('<br>');

        let statusClass = 'status-delivered';
        if (d.status === 'PARTIALLY_DELIVERED') statusClass = 'status-partial';
        if (d.status === 'RETURNED') statusClass = 'status-returned';

        return `
            <tr>
                <td>${formatDate(d.deliveredAt || d.updatedAt || d.createdAt)}</td>
                <td>
                    <strong>${escapeHtml(retailer.shopName || 'Retailer')}</strong>
                    <div class="product-pack">${escapeHtml(retailer.city || '')} · 📞 ${escapeHtml(retailer.phone || '')}</div>
                </td>
                <td style="font-size: 0.85rem; line-height: 1.4;">${productsSummary}</td>
                <td>
                    <span style="color: #2f806a; font-weight: 700;">Del: ${d.deliveredQuantity || 0}</span> | 
                    <span style="color: #b45309;">Ret: ${d.returnedQuantity || 0}</span> | 
                    <span style="color: #c53030;">Dam: ${d.damagedQuantity || 0}</span>
                </td>
                <td style="color: var(--muted); font-size: 0.88rem;">${escapeHtml(d.returnReason || '--')}</td>
                <td>
                    <span class="status-pill ${statusClass}">${d.status}</span>
                </td>
            </tr>
        `;
    }).join('');
};

// Initialize
loadProfile();
loadDeliveries();
