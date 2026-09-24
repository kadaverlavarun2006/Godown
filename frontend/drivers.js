const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
const driversApi = `${API_BASE}/drivers`;
const driverForm = document.querySelector('#driver-form');
const driverTableBody = document.querySelector('#driver-table-body');
const driverSearch = document.querySelector('#driver-search');
const listMessage = document.querySelector('#driver-list-message');
const formMessage = document.querySelector('#driver-form-message');
const formTitle = document.querySelector('#driver-form-title');
const submitDriver = document.querySelector('#submit-driver');
const cancelEdit = document.querySelector('#cancel-driver-edit');

let drivers = [];
let editingDriverId = null;

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const renderDrivers = () => {
    const query = driverSearch.value.trim().toLowerCase();
    const filteredDrivers = drivers.filter((driver) => [
        driver.name,
        driver.phone,
        driver.licenseNumber
    ].some((field) => field.toLowerCase().includes(query)));

    driverTableBody.innerHTML = filteredDrivers.length ? filteredDrivers.map((driver) => `
        <tr>
            <td data-label="Name"><strong>${escapeHtml(driver.name)}</strong></td>
            <td data-label="Phone">${escapeHtml(driver.phone)}</td>
            <td data-label="License number">${escapeHtml(driver.licenseNumber)}</td>
            <td data-label="Status"><span class="status-pill ${driver.active ? 'status-active' : 'status-inactive'}">${driver.active ? 'Active' : 'Inactive'}</span></td>
            <td class="table-actions">
                <button class="table-button" type="button" data-action="edit" data-id="${driver._id}">Edit</button>
                <button class="table-button ${driver.active ? 'danger' : ''}" type="button" data-action="status" data-id="${driver._id}">${driver.active ? 'Deactivate' : 'Activate'}</button>
            </td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="5">No drivers found.</td></tr>';
};

const loadDrivers = async() => {
    try {
        const response = await fetch(driversApi);
        if (!response.ok) {
            throw new Error('Unable to load drivers');
        }

        drivers = await response.json();
        listMessage.textContent = `${drivers.length} driver${drivers.length === 1 ? '' : 's'}`;
        renderDrivers();
    } catch (error) {
        listMessage.textContent = error.message;
    }
};

const resetForm = () => {
    driverForm.reset();
    editingDriverId = null;
    formTitle.textContent = 'Add driver';
    submitDriver.textContent = 'Add driver';
    cancelEdit.classList.add('hidden');
};

const startEdit = (driver) => {
    editingDriverId = driver._id;
    driverForm.elements.name.value = driver.name;
    driverForm.elements.phone.value = driver.phone;
    driverForm.elements.licenseNumber.value = driver.licenseNumber;
    formTitle.textContent = 'Edit driver';
    submitDriver.textContent = 'Save changes';
    cancelEdit.classList.remove('hidden');
    driverForm.elements.name.focus();
};

driverForm.addEventListener('submit', async(event) => {
    event.preventDefault();
    formMessage.textContent = '';

    const isEditing = Boolean(editingDriverId);
    const endpoint = isEditing ? `${driversApi}/${editingDriverId}` : driversApi;
    const method = isEditing ? 'PUT' : 'POST';
    const payload = Object.fromEntries(new FormData(driverForm).entries());

    try {
        const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Unable to save driver');
        }

        formMessage.textContent = isEditing ? 'Driver updated.' : 'Driver added.';
        resetForm();
        await loadDrivers();
    } catch (error) {
        formMessage.textContent = error.message;
    }
});

cancelEdit.addEventListener('click', resetForm);
driverSearch.addEventListener('input', renderDrivers);

driverTableBody.addEventListener('click', async(event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
        return;
    }

    const driver = drivers.find((item) => item._id === button.dataset.id);
    if (!driver) {
        return;
    }

    if (button.dataset.action === 'edit') {
        startEdit(driver);
        return;
    }

    if (button.dataset.action === 'status') {
        const nextStatus = !driver.active;
        const action = nextStatus ? 'activate' : 'deactivate';
        if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${driver.name}?`)) {
            return;
        }

        try {
            const response = await fetch(`${driversApi}/${driver._id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextStatus })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Unable to update driver status');
            }

            await loadDrivers();
        } catch (error) {
            listMessage.textContent = error.message;
        }
    }
});

loadDrivers();