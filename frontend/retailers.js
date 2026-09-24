const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
const retailersApi = `${API_BASE}/retailers`;
const retailerForm = document.querySelector('#retailer-form');
const retailerTableBody = document.querySelector('#retailer-table-body');
const retailerSearch = document.querySelector('#retailer-search');
const listMessage = document.querySelector('#retailer-list-message');
const formMessage = document.querySelector('#retailer-form-message');
const formTitle = document.querySelector('#retailer-form-title');
const submitRetailer = document.querySelector('#submit-retailer');
const cancelEdit = document.querySelector('#cancel-retailer-edit');

let retailers = [];
let editingRetailerId = null;

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const renderRetailers = () => {
    const query = retailerSearch.value.trim().toLowerCase();
    const filteredRetailers = retailers.filter((retailer) => [
        retailer.shopName,
        retailer.ownerName,
        retailer.phone,
        retailer.address,
        retailer.city,
        retailer.gstNumber
    ].some((field) => field.toLowerCase().includes(query)));

    retailerTableBody.innerHTML = filteredRetailers.length ? filteredRetailers.map((retailer) => `
        <tr>
            <td data-label="Shop name"><strong>${escapeHtml(retailer.shopName)}</strong></td>
            <td data-label="Owner">${escapeHtml(retailer.ownerName)}</td>
            <td data-label="Phone">${escapeHtml(retailer.phone)}</td>
            <td data-label="City">${escapeHtml(retailer.city)}</td>
            <td data-label="GST number">${escapeHtml(retailer.gstNumber)}</td>
            <td data-label="Status"><span class="status-pill ${retailer.active ? 'status-active' : 'status-inactive'}">${retailer.active ? 'Active' : 'Inactive'}</span></td>
            <td class="table-actions">
                <button class="table-button" type="button" data-action="edit" data-id="${retailer._id}">Edit</button>
                <button class="table-button ${retailer.active ? 'danger' : ''}" type="button" data-action="status" data-id="${retailer._id}">${retailer.active ? 'Deactivate' : 'Activate'}</button>
            </td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="7">No retailers found.</td></tr>';
};

const loadRetailers = async() => {
    try {
        const response = await fetch(retailersApi);
        if (!response.ok) {
            throw new Error('Unable to load retailers');
        }

        retailers = await response.json();
        listMessage.textContent = `${retailers.length} retailer${retailers.length === 1 ? '' : 's'}`;
        renderRetailers();
    } catch (error) {
        listMessage.textContent = error.message;
    }
};

const resetForm = () => {
    retailerForm.reset();
    editingRetailerId = null;
    formTitle.textContent = 'Add retailer';
    submitRetailer.textContent = 'Add retailer';
    cancelEdit.classList.add('hidden');
};

const startEdit = (retailer) => {
    editingRetailerId = retailer._id;
    retailerForm.elements.shopName.value = retailer.shopName;
    retailerForm.elements.ownerName.value = retailer.ownerName;
    retailerForm.elements.phone.value = retailer.phone;
    retailerForm.elements.address.value = retailer.address;
    retailerForm.elements.city.value = retailer.city;
    retailerForm.elements.gstNumber.value = retailer.gstNumber;
    formTitle.textContent = 'Edit retailer';
    submitRetailer.textContent = 'Save changes';
    cancelEdit.classList.remove('hidden');
    retailerForm.elements.shopName.focus();
};

retailerForm.addEventListener('submit', async(event) => {
    event.preventDefault();
    formMessage.textContent = '';

    const isEditing = Boolean(editingRetailerId);
    const endpoint = isEditing ? `${retailersApi}/${editingRetailerId}` : retailersApi;
    const method = isEditing ? 'PUT' : 'POST';
    const payload = Object.fromEntries(new FormData(retailerForm).entries());

    try {
        const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Unable to save retailer');
        }

        formMessage.textContent = isEditing ? 'Retailer updated.' : 'Retailer added.';
        resetForm();
        await loadRetailers();
    } catch (error) {
        formMessage.textContent = error.message;
    }
});

cancelEdit.addEventListener('click', resetForm);
retailerSearch.addEventListener('input', renderRetailers);

retailerTableBody.addEventListener('click', async(event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
        return;
    }

    const retailer = retailers.find((item) => item._id === button.dataset.id);
    if (!retailer) {
        return;
    }

    if (button.dataset.action === 'edit') {
        startEdit(retailer);
        return;
    }

    if (button.dataset.action === 'status') {
        const nextStatus = !retailer.active;
        const action = nextStatus ? 'activate' : 'deactivate';
        if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${retailer.shopName}?`)) {
            return;
        }

        try {
            const response = await fetch(`${retailersApi}/${retailer._id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextStatus })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Unable to update retailer status');
            }

            await loadRetailers();
        } catch (error) {
            listMessage.textContent = error.message;
        }
    }
});

loadRetailers();