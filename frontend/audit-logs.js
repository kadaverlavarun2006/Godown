const API_BASE = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase)
    ? AUTH_CONFIG.apiBase
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://godown-backend-b3e9.onrender.com/api');
const auditApi = `${API_BASE}/audit-logs`;
const auditTable = document.querySelector('#audit-table');
const auditMessage = document.querySelector('#audit-message');
const auditFrom = document.querySelector('#audit-from');
const auditTo = document.querySelector('#audit-to');
const auditAction = document.querySelector('#audit-action');
const auditEntity = document.querySelector('#audit-entity');
const auditUser = document.querySelector('#audit-user');

const actions = ['STOCK_ADDED', 'STOCK_ADJUSTED', 'DELIVERY_CREATED', 'DELIVERY_DISPATCHED', 'DELIVERY_COMPLETED', 'INVOICE_GENERATED', 'PAYMENT_UPDATED', 'RETURN_RECORDED'];
const entities = ['StockTransaction', 'Delivery', 'Invoice'];

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const prettyValue = (value) => value ? JSON.stringify(value, null, 2) : '-';
const setTodayRange = () => {
    const today = new Date();
    const dateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    auditFrom.value = dateValue(from);
    auditTo.value = dateValue(today);
};

const getParams = () => {
    const params = new URLSearchParams();
    if (auditFrom.value) params.set('from', auditFrom.value);
    if (auditTo.value) params.set('to', auditTo.value);
    if (auditAction.value) params.set('action', auditAction.value);
    if (auditEntity.value) params.set('entity', auditEntity.value);
    if (auditUser.value) params.set('user', auditUser.value);
    return params;
};

const renderLogs = (logs) => {
        auditMessage.textContent = `${logs.length} log${logs.length === 1 ? '' : 's'}`;
        auditTable.innerHTML = `
        <thead><tr><th>Date</th><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Reason</th><th>Values</th></tr></thead>
        <tbody>${logs.length ? logs.map((log) => `
            <tr>
                <td>${escapeHtml(new Date(log.date).toLocaleDateString('en-IN'))}</td>
                <td>${escapeHtml(log.time)}</td>
                <td>${escapeHtml(log.user)}</td>
                <td><span class="status-pill status-active">${escapeHtml(log.action)}</span></td>
                <td>${escapeHtml(log.entity)}<br><small>${escapeHtml(log.entityId)}</small></td>
                <td>${escapeHtml(log.reason || '-')}</td>
                <td><details><summary>View changes</summary><div class="audit-values"><strong>Old</strong><pre>${escapeHtml(prettyValue(log.oldValue))}</pre><strong>New</strong><pre>${escapeHtml(prettyValue(log.newValue))}</pre></div></details></td>
            </tr>
        `).join('') : `<tr><td class="empty-state" colspan="7">No audit logs found.</td></tr>`}</tbody>
    `;
};

const loadLogs = async() => {
    auditMessage.textContent = 'Loading audit logs...';
    const response = await fetch(`${auditApi}?${getParams()}`);
    if (!response.ok) throw new Error('Unable to load audit logs');
    renderLogs(await response.json());
};

actions.forEach((action) => auditAction.insertAdjacentHTML('beforeend', `<option value="${action}">${action}</option>`));
entities.forEach((entity) => auditEntity.insertAdjacentHTML('beforeend', `<option value="${entity}">${entity}</option>`));
setTodayRange();
document.querySelector('#refresh-audit').addEventListener('click', () => loadLogs().catch((error) => { auditMessage.textContent = error.message; }));
[auditFrom, auditTo, auditAction, auditEntity].forEach((control) => control.addEventListener('change', () => loadLogs().catch((error) => { auditMessage.textContent = error.message; })));
auditUser.addEventListener('input', () => loadLogs().catch((error) => { auditMessage.textContent = error.message; }));
loadLogs().catch((error) => { auditMessage.textContent = error.message; });