const productsApi = 'http://localhost:5000/api/products';
const productForm = document.querySelector('#product-form');
const productTableBody = document.querySelector('#product-table-body');
const productSearch = document.querySelector('#product-search');
const listMessage = document.querySelector('#list-message');
const formMessage = document.querySelector('#form-message');
const formTitle = document.querySelector('#form-title');
const submitProduct = document.querySelector('#submit-product');
const cancelEdit = document.querySelector('#cancel-edit');

let products = [];
let editingProductId = null;

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
}).format(value);

const getFormData = () => ({
    name: productForm.elements.name.value.trim(),
    category: productForm.elements.category.value.trim(),
    packSize: productForm.elements.packSize.value.trim(),
    sellingPrice: Number(productForm.elements.sellingPrice.value)
});

const renderProducts = () => {
        const query = productSearch.value.trim().toLowerCase();
        const filteredProducts = products.filter((product) => [
            product.name,
            product.category,
            product.packSize
        ].some((field) => field.toLowerCase().includes(query)));

        productTableBody.innerHTML = filteredProducts.length ? filteredProducts.map((product) => `
        <tr>
            <td data-label="Name"><strong>${escapeHtml(product.name)}</strong></td>
            <td data-label="Category">${escapeHtml(product.category)}</td>
            <td data-label="Pack size">${escapeHtml(product.packSize)}</td>
            <td data-label="Price">${formatPrice(product.sellingPrice)}</td>
            <td data-label="Status"><span class="status-pill ${product.active ? 'status-active' : 'status-inactive'}">${product.active ? 'Active' : 'Inactive'}</span></td>
            <td class="table-actions">
                <button class="table-button" type="button" data-action="edit" data-id="${product._id}">Edit</button>
                ${product.active ? `<button class="table-button danger" type="button" data-action="deactivate" data-id="${product._id}">Deactivate</button>` : ''}
            </td>
        </tr>
    `).join('') : '<tr><td class="empty-state" colspan="6">No products found.</td></tr>';
};

const loadProducts = async () => {
    try {
        const response = await fetch(productsApi);
        if (!response.ok) {
            throw new Error('Unable to load products');
        }

        products = await response.json();
        listMessage.textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
        renderProducts();
    } catch (error) {
        listMessage.textContent = error.message;
    }
};

const resetForm = () => {
    productForm.reset();
    editingProductId = null;
    formTitle.textContent = 'Add product';
    submitProduct.textContent = 'Add product';
    cancelEdit.classList.add('hidden');
};

const startEdit = (product) => {
    editingProductId = product._id;
    productForm.elements.name.value = product.name;
    productForm.elements.category.value = product.category;
    productForm.elements.packSize.value = product.packSize;
    productForm.elements.sellingPrice.value = product.sellingPrice;
    formTitle.textContent = 'Edit product';
    submitProduct.textContent = 'Save changes';
    cancelEdit.classList.remove('hidden');
    productForm.elements.name.focus();
};

productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = '';

    const isEditing = Boolean(editingProductId);
    const endpoint = isEditing ? `${productsApi}/${editingProductId}` : productsApi;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getFormData())
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Unable to save product');
        }

        formMessage.textContent = isEditing ? 'Product updated.' : 'Product added.';
        resetForm();
        await loadProducts();
    } catch (error) {
        formMessage.textContent = error.message;
    }
});

cancelEdit.addEventListener('click', resetForm);
productSearch.addEventListener('input', renderProducts);

productTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
        return;
    }

    const product = products.find((item) => item._id === button.dataset.id);
    if (!product) {
        return;
    }

    if (button.dataset.action === 'edit') {
        startEdit(product);
        return;
    }

    if (button.dataset.action === 'deactivate' && window.confirm(`Deactivate ${product.name}?`)) {
        try {
            const response = await fetch(`${productsApi}/${product._id}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error('Unable to deactivate product');
            }

            await loadProducts();
        } catch (error) {
            listMessage.textContent = error.message;
        }
    }
});

loadProducts();