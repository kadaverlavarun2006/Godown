const deliveriesApi = 'http://localhost:5000/api/deliveries';
const driversApi = 'http://localhost:5000/api/drivers';
const vehiclesApi = 'http://localhost:5000/api/vehicles';
const retailersApi = 'http://localhost:5000/api/retailers';
const productsApi = 'http://localhost:5000/api/products';

const deliveryForm = document.querySelector('#delivery-form');
const driverSelect = document.querySelector('#delivery-driver');
const vehicleSelect = document.querySelector('#delivery-vehicle');
const retailerSelect = document.querySelector('#delivery-retailer');
const productSelect = document.querySelector('#delivery-product');
const quantityInput = document.querySelector('#delivery-quantity');
const productLines = document.querySelector('#delivery-product-lines');
const deliveryTableBody = document.querySelector('#delivery-table-body');
const listMessage = document.querySelector('#delivery-list-message');
const formMessage = document.querySelector('#delivery-form-message');
const completionPanel = document.querySelector('#completion-panel');
const completionLines = document.querySelector('#completion-lines');
const completionStatus = document.querySelector('#completion-status');
const completionMessage = document.querySelector('#completion-message');

let drivers = [];
let vehicles = [];
let retailers = [];
let products = [];
let deliveries = [];
let deliveryProducts = [];
let completingDelivery = null;

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const fillSelect = (select, placeholder, items, label) => {
        select.innerHTML = `<option value="">${placeholder}</option>${items.map((item) => `<option value="${item._id}">${escapeHtml(label(item))}</option>`).join('')}`;
};

const renderProductLines = () => {
    productLines.innerHTML = deliveryProducts.length ? deliveryProducts.map((item, index) => `
        <div class="delivery-line">
            <span>${escapeHtml(item.name)} · ${item.quantity}</span>
            <button class="text-button" type="button" data-remove-product="${index}">Remove</button>
        </div>
    `).join('') : '<p class="line-placeholder">No products added yet.</p>';
};

const renderCompletionLines = () => {
    completionLines.innerHTML = completingDelivery.products.map((item) => `
        <div class="completion-line" data-product-id="${item.product._id}">
            <strong>${escapeHtml(item.product.name)}</strong>
            <span>Loaded: ${item.loadedQuantity}</span>
            <label>Delivered <input data-field="deliveredQuantity" type="number" min="0" max="${item.loadedQuantity}" step="0.0001" value="${item.loadedQuantity}" /></label>
            <label>Returned <input data-field="returnedQuantity" type="number" min="0" max="${item.loadedQuantity}" step="0.0001" value="0" /></label>
            <label>Damaged <input data-field="damagedQuantity" type="number" min="0" max="${item.loadedQuantity}" step="0.0001" value="0" /></label>
        </div>
    `).join('');
};

const renderDeliveries = () => {
    deliveryTableBody.innerHTML = deliveries.length ? deliveries.map((delivery) => `
        <tr>
            <td data-label="Retailer"><strong>${escapeHtml(delivery.retailer.shopName)}</strong></td>
            <td data-label="Driver">${escapeHtml(delivery.driver.name)}</td>
            <td data-label="Vehicle">${escapeHtml(delivery.vehicle.vehicleNumber)}</td>
            <td data-label="Products">${delivery.products.length} · ${delivery.loadedQuantity}/${delivery.products.reduce((sum, item) => sum + item.quantity, 0)}</td>
            <td data-label="Status"><span class="status-pill status-${delivery.status.toLowerCase()}">${escapeHtml(delivery.status.replaceAll('_', ' '))}</span></td>
            <td class="table-actions">${renderDeliveryActions(delivery)}</td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="6">No deliveries found.</td></tr>';
};

const renderDeliveryActions = (delivery) => {
    if (delivery.status === 'ASSIGNED') return `<button class="table-button" type="button" data-action="load" data-id="${delivery._id}">Load</button>`;
    if (delivery.status === 'LOADED') return `<button class="table-button" type="button" data-action="out" data-id="${delivery._id}">Out for delivery</button>`;
    if (delivery.status === 'OUT_FOR_DELIVERY') return `<button class="table-button" type="button" data-action="complete" data-id="${delivery._id}">Complete</button>`;
    return '<span class="completed-label">Completed</span>';
};

const loadReferenceData = async() => {
    const responses = await Promise.all([
        fetch(driversApi),
        fetch(vehiclesApi),
        fetch(retailersApi),
        fetch(productsApi)
    ]);
    if (responses.some((response) => !response.ok)) throw new Error('Unable to load delivery references');

    [drivers, vehicles, retailers, products] = await Promise.all(responses.map((response) => response.json()));
    drivers = drivers.filter((driver) => driver.active);
    vehicles = vehicles.filter((vehicle) => vehicle.active && vehicle.assignedDriver);
    retailers = retailers.filter((retailer) => retailer.active);
    products = products.filter((product) => product.active);

    fillSelect(driverSelect, 'Select driver', drivers, (item) => item.name);
    fillSelect(vehicleSelect, 'Select vehicle', vehicles, (item) => `${item.vehicleNumber} · ${item.vehicleType}`);
    fillSelect(retailerSelect, 'Select retailer', retailers, (item) => `${item.shopName} · ${item.city}`);
    fillSelect(productSelect, 'Select product', products, (item) => `${item.name} · ${item.packSize}`);
};

const loadDeliveries = async() => {
    const response = await fetch(deliveriesApi);
    if (!response.ok) throw new Error('Unable to load deliveries');
    deliveries = await response.json();
    listMessage.textContent = `${deliveries.length} deliver${deliveries.length === 1 ? 'y' : 'ies'}`;
    renderDeliveries();
};

const loadPage = async() => {
    try {
        await loadReferenceData();
        await loadDeliveries();
    } catch (error) {
        listMessage.textContent = error.message;
    }
};

const resetDeliveryForm = () => {
    deliveryForm.reset();
    deliveryProducts = [];
    renderProductLines();
};

document.querySelector('#add-delivery-product').addEventListener('click', () => {
    const product = products.find((item) => item._id === productSelect.value);
    const quantity = Number(quantityInput.value);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
        formMessage.textContent = 'Select a product and enter a quantity.';
        return;
    }
    if (deliveryProducts.some((item) => item.product === product._id)) {
        formMessage.textContent = 'That product is already added.';
        return;
    }

    deliveryProducts.push({ product: product._id, name: product.name, quantity });
    productSelect.value = '';
    quantityInput.value = '';
    formMessage.textContent = '';
    renderProductLines();
});

productLines.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-product]');
    if (button) {
        deliveryProducts.splice(Number(button.dataset.removeProduct), 1);
        renderProductLines();
    }
});

deliveryForm.addEventListener('submit', async(event) => {
    event.preventDefault();
    formMessage.textContent = '';
    if (deliveryProducts.length === 0) {
        formMessage.textContent = 'Add at least one product.';
        return;
    }

    try {
        const response = await fetch(deliveriesApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                driver: driverSelect.value,
                vehicle: vehicleSelect.value,
                retailer: retailerSelect.value,
                products: deliveryProducts.map(({ product, quantity }) => ({ product, quantity }))
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Unable to create delivery');
        }
        formMessage.textContent = 'Delivery assigned.';
        resetDeliveryForm();
        await loadDeliveries();
    } catch (error) {
        formMessage.textContent = error.message;
    }
});

deliveryTableBody.addEventListener('click', async(event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const delivery = deliveries.find((item) => item._id === button.dataset.id);
    if (!delivery) return;

    try {
        if (button.dataset.action === 'load') {
            const response = await fetch(`${deliveriesApi}/${delivery._id}/load`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products: delivery.products.map((item) => ({ product: item.product._id, quantity: item.quantity })) })
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Unable to load delivery');
        }
        if (button.dataset.action === 'out') {
            const response = await fetch(`${deliveriesApi}/${delivery._id}/status`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' })
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Unable to dispatch delivery');
        }
        if (button.dataset.action === 'complete') {
            completingDelivery = delivery;
            completionMessage.textContent = '';
            completionStatus.value = 'DELIVERED';
            renderCompletionLines();
            completionPanel.classList.remove('hidden');
            completionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        await loadDeliveries();
    } catch (error) {
        listMessage.textContent = error.message;
    }
});

document.querySelector('#cancel-completion').addEventListener('click', () => {
    completingDelivery = null;
    completionPanel.classList.add('hidden');
});

document.querySelector('#submit-completion').addEventListener('click', async() => {
    if (!completingDelivery) return;
    const completedProducts = [...completionLines.querySelectorAll('.completion-line')].map((line) => ({
        product: line.dataset.productId,
        deliveredQuantity: Number(line.querySelector('[data-field="deliveredQuantity"]').value),
        returnedQuantity: Number(line.querySelector('[data-field="returnedQuantity"]').value),
        damagedQuantity: Number(line.querySelector('[data-field="damagedQuantity"]').value)
    }));

    const invalidLine = completedProducts.find((item, index) => {
        const loadedQuantity = completingDelivery.products[index].loadedQuantity;
        return [item.deliveredQuantity, item.returnedQuantity, item.damagedQuantity].some((quantity) => !Number.isFinite(quantity) || quantity < 0) ||
            Math.abs(item.deliveredQuantity + item.returnedQuantity + item.damagedQuantity - loadedQuantity) > 0.0000001;
    });
    if (invalidLine) {
        completionMessage.textContent = 'Delivered, returned, and damaged quantities must be valid and add up to the loaded quantity.';
        return;
    }

    try {
        const response = await fetch(`${deliveriesApi}/${completingDelivery._id}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: completionStatus.value, products: completedProducts })
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Unable to complete delivery');
        completionPanel.classList.add('hidden');
        completingDelivery = null;
        await loadDeliveries();
    } catch (error) {
        completionMessage.textContent = error.message;
    }
});

document.querySelector('#refresh-deliveries').addEventListener('click', loadPage);
renderProductLines();
loadPage();