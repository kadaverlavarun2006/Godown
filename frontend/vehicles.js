const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
const vehiclesApi = `${API_BASE}/vehicles`;
const driversApi = `${API_BASE}/drivers`;
const vehicleForm = document.querySelector('#vehicle-form');
const vehicleTableBody = document.querySelector('#vehicle-table-body');
const vehicleSearch = document.querySelector('#vehicle-search');
const driverSelect = document.querySelector('#assigned-driver');
const listMessage = document.querySelector('#vehicle-list-message');
const formMessage = document.querySelector('#vehicle-form-message');
const formTitle = document.querySelector('#vehicle-form-title');
const submitVehicle = document.querySelector('#submit-vehicle');
const cancelEdit = document.querySelector('#cancel-vehicle-edit');

let vehicles = [];
let drivers = [];
let editingVehicleId = null;

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const renderDriverOptions = () => {
    const options = drivers.map((driver) => `<option value="${driver._id}">${escapeHtml(driver.name)} (${escapeHtml(driver.phone)})</option>`).join('');
    driverSelect.innerHTML = `<option value="">No driver assigned</option>${options}`;
};

const assignedDriverName = (vehicle) => vehicle.assignedDriver && vehicle.assignedDriver.name || 'Unassigned';

const renderVehicles = () => {
        const query = vehicleSearch.value.trim().toLowerCase();
        const filteredVehicles = vehicles.filter((vehicle) => [
            vehicle.vehicleNumber,
            vehicle.vehicleType,
            vehicle.capacity,
            assignedDriverName(vehicle)
        ].some((field) => String(field).toLowerCase().includes(query)));

        vehicleTableBody.innerHTML = filteredVehicles.length ? filteredVehicles.map((vehicle) => `
        <tr>
            <td data-label="Vehicle number"><strong>${escapeHtml(vehicle.vehicleNumber)}</strong></td>
            <td data-label="Type">${escapeHtml(vehicle.vehicleType)}</td>
            <td data-label="Capacity">${escapeHtml(vehicle.capacity)}</td>
            <td data-label="Assigned driver"><span class="assignment-label ${vehicle.assignedDriver ? 'assigned' : 'unassigned'}">${escapeHtml(assignedDriverName(vehicle))}</span></td>
            <td class="table-actions">
                <button class="table-button" type="button" data-action="edit" data-id="${vehicle._id}">Edit</button>
                <button class="table-button" type="button" data-action="assign" data-id="${vehicle._id}">${vehicle.assignedDriver ? 'Change driver' : 'Assign driver'}</button>
                ${vehicle.assignedDriver ? `<button class="table-button danger" type="button" data-action="unassign" data-id="${vehicle._id}">Unassign</button>` : ''}
            </td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="5">No vehicles found.</td></tr>';
};

const loadDrivers = async() => {
    const response = await fetch(driversApi);
    if (!response.ok) {
        throw new Error('Unable to load drivers');
    }

    drivers = (await response.json()).filter((driver) => driver.active);
    renderDriverOptions();
};

const loadVehicles = async() => {
    try {
        const response = await fetch(vehiclesApi);
        if (!response.ok) {
            throw new Error('Unable to load vehicles');
        }

        vehicles = await response.json();
        listMessage.textContent = `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`;
        renderVehicles();
    } catch (error) {
        listMessage.textContent = error.message;
    }
};

const loadPage = async() => {
    try {
        await loadDrivers();
        await loadVehicles();
    } catch (error) {
        listMessage.textContent = error.message;
    }
};

const resetForm = () => {
    vehicleForm.reset();
    editingVehicleId = null;
    formTitle.textContent = 'Add vehicle';
    submitVehicle.textContent = 'Add vehicle';
    cancelEdit.classList.add('hidden');
};

const startEdit = (vehicle, assignmentOnly = false) => {
    editingVehicleId = vehicle._id;
    vehicleForm.elements.vehicleNumber.value = vehicle.vehicleNumber;
    vehicleForm.elements.vehicleType.value = vehicle.vehicleType;
    vehicleForm.elements.capacity.value = vehicle.capacity;
    driverSelect.value = vehicle.assignedDriver ? vehicle.assignedDriver._id : '';
    formTitle.textContent = assignmentOnly ? 'Assign driver' : 'Edit vehicle';
    submitVehicle.textContent = assignmentOnly ? 'Save assignment' : 'Save changes';
    cancelEdit.classList.remove('hidden');
    (assignmentOnly ? driverSelect : vehicleForm.elements.vehicleNumber).focus();
};

vehicleForm.addEventListener('submit', async(event) => {
    event.preventDefault();
    formMessage.textContent = '';

    const isEditing = Boolean(editingVehicleId);
    const endpoint = isEditing ? `${vehiclesApi}/${editingVehicleId}` : vehiclesApi;
    const method = isEditing ? 'PUT' : 'POST';
    const formData = Object.fromEntries(new FormData(vehicleForm).entries());
    const payload = {
        vehicleNumber: formData.vehicleNumber,
        vehicleType: formData.vehicleType,
        capacity: Number(formData.capacity),
        assignedDriver: formData.assignedDriver || null
    };

    try {
        const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Unable to save vehicle');
        }

        formMessage.textContent = isEditing ? 'Vehicle updated.' : 'Vehicle added.';
        resetForm();
        await loadPage();
    } catch (error) {
        formMessage.textContent = error.message;
    }
});

cancelEdit.addEventListener('click', resetForm);
vehicleSearch.addEventListener('input', renderVehicles);

vehicleTableBody.addEventListener('click', async(event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
        return;
    }

    const vehicle = vehicles.find((item) => item._id === button.dataset.id);
    if (!vehicle) {
        return;
    }

    if (button.dataset.action === 'edit') {
        startEdit(vehicle);
        return;
    }

    if (button.dataset.action === 'assign') {
        startEdit(vehicle, true);
        return;
    }

    if (button.dataset.action === 'unassign' && window.confirm(`Unassign the driver from ${vehicle.vehicleNumber}?`)) {
        try {
            const response = await fetch(`${vehiclesApi}/${vehicle._id}/assignment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: null })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Unable to unassign driver');
            }

            await loadVehicles();
        } catch (error) {
            listMessage.textContent = error.message;
        }
    }
});

loadPage();