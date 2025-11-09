// Toast Notification System
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 3000);
}

// Navigation functionality
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        
        // Add active class to clicked nav item
        this.classList.add('active');
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show selected page
        const pageId = this.getAttribute('data-page');
        if (pageId) {
            document.getElementById(pageId).classList.add('active');
            
            // Load data when switching to specific pages
            if (pageId === 'orders') {
                initializeOrders();
            } else if (pageId === 'analytics') {
                updateAnalytics();
            }
        }
    });
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        showToast('You have been logged out successfully.', 'success');
    }
});

// Image Preview
document.getElementById('productImage').addEventListener('change', function(e) {
    const preview = document.getElementById('imagePreview');
    const file = e.target.files[0];
    
    if (file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Product Image">`;
        };
        
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '<span>No image selected</span>';
    }
});

// Product Management functionality
let products = [];
let activeOrders = [];
let editingProductId = null;

// Historical data for accurate percentage calculations
let historicalData = {
    daily: { sales: 0, products: 0 },
    weekly: { sales: 0, products: 0 },
    monthly: { sales: 0, products: 0 },
    yearly: { sales: 0, products: 0 },
    previousTotal: { sales: 0, products: 0 }
};

// Initialize with all the products from your list
function initializeProducts() {
    // Clear any existing products
    products = [];
    
    // Add all products from your list
    addProductFromList("Cheesy Bacon", 159, "spud", 25);
    addProductFromList("Chili Con Carne", 179, "spud", 20);
    addProductFromList("Triple Cheese", 129, "spud", 30);
    addProductFromList("Lasagna Jacket", 179, "spud", 15);
    
    addProductFromList("Nachos", 129, "appetizers", 40);
    addProductFromList("Chicken Poppers & Fries", 179, "appetizers", 35);
    
    addProductFromList("Hongar Chicken", 179, "wrap", 30);
    addProductFromList("Beef Nacho", 169, "wrap", 25);
    addProductFromList("Kesodilla", 99, "wrap", 45);
    
    addProductFromList("Lasagna Pasta", 250, "pasta_bread", 20);
    addProductFromList("Garlic Bread", 69, "pasta_bread", 50);
    
    // Desserts
    addProductFromList("Mais Con Yelo (L)", 130, "desserts", 25);
    addProductFromList("Mais Con Yelo (M)", 110, "desserts", 30);
    addProductFromList("Buko Pandan (L)", 120, "desserts", 20);
    addProductFromList("Buko Pandan (M)", 100, "desserts", 25);
    addProductFromList("Avocado Moto (L)", 180, "desserts", 15);
    addProductFromList("Avocado Moto (M)", 150, "desserts", 20);
    addProductFromList("Mango Graham (L)", 120, "desserts", 30);
    addProductFromList("Mango Graham (M)", 100, "desserts", 35);
    addProductFromList("Ube Macapuno (L)", 140, "desserts", 25);
    addProductFromList("Ube Macapuno (M)", 120, "desserts", 30);
    addProductFromList("Blueberry Delight (L)", 130, "desserts", 20);
    addProductFromList("Blueberry Delight (M)", 115, "desserts", 25);
    addProductFromList("Biscoff Classic (L)", 200, "desserts", 15);
    addProductFromList("Biscoff Classic (M)", 175, "desserts", 20);
    addProductFromList("Coffee Jelly (L)", 120, "desserts", 30);
    addProductFromList("Coffee Jelly (M)", 100, "desserts", 35);
    addProductFromList("Matcha Graham (L)", 130, "desserts", 25);
    addProductFromList("Matcha Graham (M)", 115, "desserts", 30);
    addProductFromList("Rocky Road (L)", 130, "desserts", 20);
    addProductFromList("Rocky Road (M)", 115, "desserts", 25);
    addProductFromList("Cookie Monster Oreo (L)", 130, "desserts", 30);
    addProductFromList("Cookie Monster Oreo (M)", 115, "desserts", 35);
    addProductFromList("Strawberry Slash (L)", 130, "desserts", 25);
    addProductFromList("Strawberry Slash (M)", 115, "desserts", 30);
    
    renderAllProductsByCategory();
}

// Helper function to add products from the list
function addProductFromList(name, price, category, stock) {
    const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name: name,
        price: price,
        category: category,
        stock: stock,
        image: null
    };
    
    products.push(newProduct);
}

// Get current date in MM/DD/YY format
function getCurrentDate() {
    const now = new Date();
    return `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)}`;
}

// Get current time in HH:MM format
function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

// Get date for different time periods
function getDateForPeriod(period) {
    const now = new Date();
    switch(period) {
        case 'daily':
            return getCurrentDate();
        case 'weekly':
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            return `${(weekAgo.getMonth() + 1).toString().padStart(2, '0')}/${weekAgo.getDate().toString().padStart(2, '0')}/${weekAgo.getFullYear().toString().slice(-2)}`;
        case 'monthly':
            const monthAgo = new Date(now);
            monthAgo.setDate(now.getDate() - 30);
            return `${(monthAgo.getMonth() + 1).toString().padStart(2, '0')}/${monthAgo.getDate().toString().padStart(2, '0')}/${monthAgo.getFullYear().toString().slice(-2)}`;
        case 'yearly':
            const yearAgo = new Date(now);
            yearAgo.setDate(now.getDate() - 365);
            return `${(yearAgo.getMonth() + 1).toString().padStart(2, '0')}/${yearAgo.getDate().toString().padStart(2, '0')}/${yearAgo.getFullYear().toString().slice(-2)}`;
        default:
            return getCurrentDate();
    }
}

// Calculate percentage change
function calculatePercentageChange(current, previous) {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

// Validate product form
function validateProductForm() {
    let isValid = true;
    
    // Reset error states
    document.getElementById('nameError').style.display = 'none';
    document.getElementById('priceError').style.display = 'none';
    document.getElementById('categoryError').style.display = 'none';
    document.getElementById('stockError').style.display = 'none';
    
    document.getElementById('productName').classList.remove('error');
    document.getElementById('productPrice').classList.remove('error');
    document.getElementById('productCategory').classList.remove('error');
    document.getElementById('productStock').classList.remove('error');
    
    // Validate product name
    const name = document.getElementById('productName').value.trim();
    if (!name) {
        document.getElementById('nameError').style.display = 'block';
        document.getElementById('productName').classList.add('error');
        isValid = false;
    }
    
    // Validate price
    const price = parseInt(document.getElementById('productPrice').value);
    if (isNaN(price) || price < 1 || !Number.isInteger(price)) {
        document.getElementById('priceError').style.display = 'block';
        document.getElementById('productPrice').classList.add('error');
        isValid = false;
    }
    
    // Validate category
    const category = document.getElementById('productCategory').value;
    if (!category) {
        document.getElementById('categoryError').style.display = 'block';
        document.getElementById('productCategory').classList.add('error');
        isValid = false;
    }
    
    // Validate stock
    const stock = parseInt(document.getElementById('productStock').value);
    if (isNaN(stock) || stock < 0) {
        document.getElementById('stockError').style.display = 'block';
        document.getElementById('productStock').classList.add('error');
        isValid = false;
    }
    
    return isValid;
}

// Render all products by category in the products page
function renderAllProductsByCategory() {
    const container = document.getElementById('allProductsContainer');
    container.innerHTML = '';
    
    // Group products by category
    const productsByCategory = {};
    products.forEach(product => {
        if (!productsByCategory[product.category]) {
            productsByCategory[product.category] = [];
        }
        productsByCategory[product.category].push(product);
    });
    
    // Render each category
    Object.keys(productsByCategory).forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';
        
        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = formatCategory(category);
        categorySection.appendChild(categoryTitle);
        
        const categoryProducts = document.createElement('div');
        categoryProducts.className = 'category-products';
        
        productsByCategory[category].forEach(product => {
            const productElement = document.createElement('div');
            productElement.className = 'category-product';
            productElement.innerHTML = `
                <div class="product-name-price">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">P ${product.price}</div>
                    <div class="product-stock">Stock: ${product.stock}</div>
                </div>
                <div class="product-actions">
                    <button class="btn-edit" data-id="${product.id}">Edit</button>
                    <button class="btn-delete" data-id="${product.id}">Delete</button>
                </div>
            `;
            categoryProducts.appendChild(productElement);
        });
        
        categorySection.appendChild(categoryProducts);
        container.appendChild(categorySection);
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = parseInt(this.getAttribute('data-id'));
            editProduct(productId);
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = parseInt(this.getAttribute('data-id'));
            deleteProduct(productId);
        });
    });
}

// Get status class for styling
function getStatusClass(status) {
    switch(status) {
        case 'order_placed': return 'status-pending';
        case 'preparing': return 'status-preparing';
        case 'out_for_delivery': return 'status-preparing';
        case 'ready_for_pickup': return 'status-preparing';
        case 'delivered': return 'status-completed';
        case 'picked_up': return 'status-completed';
        default: return 'status-pending';
    }
}

// Update analytics with real data from backend
async function updateAnalytics() {
    try {
        const response = await fetch('/api/orders/all/');
        if (!response.ok) throw new Error('Failed to fetch orders');
        
        const allOrders = await response.json();
        
        // Calculate current totals
        const currentTotalSales = allOrders.reduce((sum, order) => sum + order.total_amount, 0);
        const currentTotalProducts = allOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        
        // Calculate period-specific data
        const currentDate = getCurrentDate();
        const dailySales = allOrders.filter(order => {
            const orderDate = new Date(order.created_at).toLocaleDateString();
            return orderDate === currentDate;
        }).reduce((sum, order) => sum + order.total_amount, 0);
        
        const dailyProducts = allOrders.filter(order => {
            const orderDate = new Date(order.created_at).toLocaleDateString();
            return orderDate === currentDate;
        }).reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        
        // Update display values
        document.getElementById('totalSales').textContent = `P ${currentTotalSales.toFixed(2)}`;
        document.getElementById('totalProductSold').textContent = currentTotalProducts;
        
        document.getElementById('dailySales').textContent = `P ${dailySales.toFixed(2)}`;
        document.getElementById('dailyProductSold').textContent = dailyProducts;
        
        // Update order count
        document.getElementById('orderCount').textContent = `${allOrders.length} Orders`;
        document.getElementById('allOrderCount').textContent = `${allOrders.length} Total Orders`;
        
        // Update historical data for next calculation
        historicalData.previousTotal = { sales: currentTotalSales, products: currentTotalProducts };
        historicalData.daily = { sales: dailySales, products: dailyProducts };
        
    } catch (error) {
        console.error('Error updating analytics:', error);
        showToast('Failed to load analytics data', 'error');
    }
}

// Update percentage display with proper formatting
function updatePercentageDisplay(elementId, percentage) {
    const element = document.getElementById(elementId);
    const isPositive = percentage >= 0;
    const absPercentage = Math.abs(percentage);
    
    element.innerHTML = `<i class="fas ${isPositive ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${absPercentage.toFixed(1)}%`;
    element.className = `metric-change ${isPositive ? '' : 'negative'}`;
}

// Format category for display
function formatCategory(category) {
    const categoryMap = {
        'desserts': 'Desserts',
        'spud': 'Spud',
        'wrap': 'Wrap',
        'appetizers': 'Appetizers',
        'pasta_bread': 'Pasta/Bread'
    };
    return categoryMap[category] || category;
}

// Format status for display
function formatStatus(status) {
    const statusMap = {
        'order_placed': 'Order Placed',
        'preparing': 'Preparing Order',
        'out_for_delivery': 'Out for Delivery',
        'delivered': 'Delivered',
        'ready_for_pickup': 'Ready for Pickup',
        'picked_up': 'Picked Up'
    };
    return statusMap[status] || status;
}

// Add a new product
function addProduct() {
    if (!validateProductForm()) {
        showToast('Please fix the errors in the form', 'error');
        return;
    }
    
    const name = document.getElementById('productName').value;
    const price = document.getElementById('productPrice').value;
    const category = document.getElementById('productCategory').value;
    const stock = document.getElementById('productStock').value;
    const imageInput = document.getElementById('productImage');
    
    // Handle image
    let imageData = null;
    if (imageInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imageData = e.target.result;
            saveProduct(name, price, category, stock, imageData);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        saveProduct(name, price, category, stock, null);
    }
}

// Save product to the list
function saveProduct(name, price, category, stock, imageData) {
    const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name: name,
        price: parseInt(price),
        category: category,
        stock: parseInt(stock),
        image: imageData
    };
    
    products.push(newProduct);
    renderAllProductsByCategory();
    resetForm();
    showToast('Product added successfully!', 'success');
}

// Edit a product
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    editingProductId = id;
    
    // Set form values
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productStock').value = product.stock;
    
    // Set image preview if exists
    const preview = document.getElementById('imagePreview');
    if (product.image) {
        preview.innerHTML = `<img src="${product.image}" alt="Product Image">`;
    } else {
        preview.innerHTML = '<span>No image selected</span>';
    }
    
    // Show update and cancel buttons
    document.getElementById('addProduct').style.display = 'none';
    document.getElementById('updateProduct').style.display = 'inline-block';
    document.getElementById('cancelEdit').style.display = 'inline-block';
}

// Update a product
function updateProduct() {
    if (editingProductId === null) return;
    
    if (!validateProductForm()) {
        showToast('Please fix the errors in the form', 'error');
        return;
    }
    
    const name = document.getElementById('productName').value;
    const price = document.getElementById('productPrice').value;
    const category = document.getElementById('productCategory').value;
    const stock = document.getElementById('productStock').value;
    const imageInput = document.getElementById('productImage');
    
    // Handle image
    let imageData = null;
    if (imageInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imageData = e.target.result;
            saveUpdatedProduct(name, price, category, stock, imageData);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        // Keep existing image if no new image selected
        const existingProduct = products.find(p => p.id === editingProductId);
        imageData = existingProduct ? existingProduct.image : null;
        saveUpdatedProduct(name, price, category, stock, imageData);
    }
}

// Save updated product
function saveUpdatedProduct(name, price, category, stock, imageData) {
    const productIndex = products.findIndex(p => p.id === editingProductId);
    if (productIndex !== -1) {
        products[productIndex] = {
            id: editingProductId,
            name: name,
            price: parseInt(price),
            category: category,
            stock: parseInt(stock),
            image: imageData
        };
    }
    
    renderAllProductsByCategory();
    resetForm();
    showToast('Product updated successfully!', 'success');
}

// Delete a product
function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        products = products.filter(p => p.id !== id);
        renderAllProductsByCategory();
        showToast('Product deleted successfully!', 'success');
    }
}

// Reset form
function resetForm() {
    document.getElementById('productName').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreview').innerHTML = '<span>No image selected</span>';
    
    // Reset error states
    document.getElementById('nameError').style.display = 'none';
    document.getElementById('priceError').style.display = 'none';
    document.getElementById('categoryError').style.display = 'none';
    document.getElementById('stockError').style.display = 'none';
    
    document.getElementById('productName').classList.remove('error');
    document.getElementById('productPrice').classList.remove('error');
    document.getElementById('productCategory').classList.remove('error');
    document.getElementById('productStock').classList.remove('error');
    
    document.getElementById('addProduct').style.display = 'inline-block';
    document.getElementById('updateProduct').style.display = 'none';
    document.getElementById('cancelEdit').style.display = 'none';
    
    editingProductId = null;
}

// Cancel edit
function cancelEdit() {
    resetForm();
}

// ========== ORDER MANAGEMENT WITH BACKEND INTEGRATION ==========

// Order Management Functions
async function initializeOrders() {
    await loadOrdersFromBackend();
    renderActiveOrders();
    updateOrderCount();
    updateAnalytics();
}

async function loadOrdersFromBackend() {
    try {
        const response = await fetch('/api/orders/all/');
        if (response.ok) {
            const ordersData = await response.json();
            
            // Convert backend data to frontend format
            activeOrders = ordersData.map(order => ({
                id: order.order_id,
                customer: order.customer_name,
                orderType: order.order_type,
                paymentMethod: order.payment_method || 'Cash',
                paymentStatus: 'Paid',
                total: order.total_amount,
                status: order.status,
                date: new Date(order.created_at).toLocaleDateString(),
                time: new Date(order.created_at).toLocaleTimeString(),
                items: order.items || []
            }));
        } else {
            throw new Error('Failed to load orders');
        }
    } catch (error) {
        console.error('Error loading orders from backend:', error);
        showToast('Failed to load orders from server', 'error');
        activeOrders = [];
    }
}

function renderActiveOrders() {
    const container = document.getElementById('ordersContainer');
    const typeFilter = document.getElementById('orderTypeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Filter orders
    let filteredOrders = activeOrders;
    
    if (typeFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.orderType === typeFilter);
    }
    
    if (statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }
    
    container.innerHTML = '';
    
    if (filteredOrders.length === 0) {
        container.innerHTML = '<div class="no-orders">No orders match the selected filters</div>';
        return;
    }
    
    // Sort orders by date and time (newest first)
    const sortedOrders = [...filteredOrders].sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateB - dateA;
    });

    sortedOrders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        
        const statusDisplay = formatStatus(order.status);
        const totalItems = order.items.reduce((total, item) => total + item.quantity, 0);
        
        orderCard.innerHTML = `
            <div class="order-details-section">
                <h3>Order Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Order ID:</span>
                    <span class="detail-value">${order.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Customer:</span>
                    <span class="detail-value">${order.customer}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Order Placed:</span>
                    <span class="detail-value">${order.date}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">${order.orderType === 'delivery' ? 'Delivery Address:' : 'Pickup Location:'}</span>
                    <span class="detail-value">${order.orderType === 'delivery' ? 'Customer Address' : 'Store Location'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">No. of Items:</span>
                    <span class="detail-value">${totalItems} items</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value status-badge ${order.status === 'delivered' || order.status === 'picked_up' ? 'status-completed' : 'status-preparing'}">${statusDisplay}</span>
                </div>
            </div>
            
            <div class="tracking-section">
                <h3>Order Tracking</h3>
                <div class="tracking-steps">
                    ${getTrackingSteps(order.orderType, order.status)}
                </div>
            </div>
            
            <div class="status-indicator">
                <div class="status-title">CURRENT STATUS</div>
                <div class="current-status">${statusDisplay}</div>
                <div class="status-details">${getStatusDetails(order.status, order.orderType)}</div>
            </div>
            
            <div class="order-management">
                <div class="order-status">
                    <label for="status-${order.id}">Update Status:</label>
                    <select id="status-${order.id}" class="status-select" data-order-id="${order.id}">
                        ${getStatusOptions(order.orderType, order.status)}
                    </select>
                </div>
                <div class="order-actions">
                    <button class="btn btn-success btn-complete" data-order-id="${order.id}" ${order.status === 'delivered' || order.status === 'picked_up' ? 'disabled' : ''}>
                        ${order.orderType === 'delivery' ? 'Mark as Delivered' : 'Mark as Picked Up'}
                    </button>
                    <button class="btn btn-danger btn-cancel" data-order-id="${order.id}">Cancel Order</button>
                </div>
            </div>
        `;
        container.appendChild(orderCard);
    });
    
    // Add event listeners
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', function() {
            const orderId = this.getAttribute('data-order-id');
            updateOrderStatus(orderId, this.value);
        });
    });
    
    document.querySelectorAll('.btn-complete').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            completeOrder(orderId);
        });
    });
    
    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            cancelOrder(orderId);
        });
    });
}

function getTrackingSteps(orderType, currentStatus) {
    let steps = '';
    
    if (orderType === 'delivery') {
        const deliverySteps = [
            { status: 'order_placed', label: 'Order Placed' },
            { status: 'preparing', label: 'Preparing Order' },
            { status: 'out_for_delivery', label: 'Out for Delivery' },
            { status: 'delivered', label: 'Delivered' }
        ];
        
        deliverySteps.forEach(step => {
            const isActive = isStepActive(step.status, currentStatus, deliverySteps);
            steps += `
                <div class="tracking-step ${isActive ? 'active' : ''}">
                    <div class="step-title">${step.label}</div>
                </div>
            `;
        });
    } else {
        const pickupSteps = [
            { status: 'order_placed', label: 'Order Placed' },
            { status: 'preparing', label: 'Preparing Order' },
            { status: 'ready_for_pickup', label: 'Ready for Pickup' },
            { status: 'picked_up', label: 'Picked Up' }
        ];
        
        pickupSteps.forEach(step => {
            const isActive = isStepActive(step.status, currentStatus, pickupSteps);
            steps += `
                <div class="tracking-step ${isActive ? 'active' : ''}">
                    <div class="step-title">${step.label}</div>
                </div>
            `;
        });
    }
    
    return steps;
}

function isStepActive(stepStatus, currentStatus, steps) {
    const stepIndex = steps.findIndex(step => step.status === stepStatus);
    const currentIndex = steps.findIndex(step => step.status === currentStatus);
    return stepIndex <= currentIndex;
}

function getStatusDetails(status, orderType) {
    const statusDetails = {
        'order_placed': 'Your order has been placed and is being processed.',
        'preparing': 'Your order is being prepared.',
        'out_for_delivery': 'Your order is out for delivery.',
        'delivered': 'Your order has been successfully delivered.',
        'ready_for_pickup': 'Your order is ready for pickup at our store.',
        'picked_up': 'Your order has been picked up.'
    };
    
    return statusDetails[status] || 'Order status updated.';
}

function getStatusOptions(orderType, currentStatus) {
    let options = '';
    
    if (orderType === 'delivery') {
        const statuses = [
            { value: 'order_placed', label: 'Order Placed' },
            { value: 'preparing', label: 'Preparing Order' },
            { value: 'out_for_delivery', label: 'Out for Delivery' },
            { value: 'delivered', label: 'Delivered' }
        ];
        
        statuses.forEach(status => {
            const selected = status.value === currentStatus ? 'selected' : '';
            options += `<option value="${status.value}" ${selected}>${status.label}</option>`;
        });
    } else {
        const statuses = [
            { value: 'order_placed', label: 'Order Placed' },
            { value: 'preparing', label: 'Preparing Order' },
            { value: 'ready_for_pickup', label: 'Ready for Pickup' },
            { value: 'picked_up', label: 'Picked Up' }
        ];
        
        statuses.forEach(status => {
            const selected = status.value === currentStatus ? 'selected' : '';
            options += `<option value="${status.value}" ${selected}>${status.label}</option>`;
        });
    }
    
    return options;
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`/api/orders/${orderId}/update-status/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            const orderIndex = activeOrders.findIndex(order => order.id === orderId);
            if (orderIndex !== -1) {
                activeOrders[orderIndex].status = newStatus;
                renderActiveOrders();
                showToast(`Order #${orderId} status updated to ${formatStatus(newStatus)}`, 'success');
            }
        } else {
            throw new Error('Failed to update status');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        showToast('Failed to update order status', 'error');
    }
}

async function completeOrder(orderId) {
    try {
        const order = activeOrders.find(order => order.id === orderId);
        if (!order) return;
        
        const newStatus = order.orderType === 'delivery' ? 'delivered' : 'picked_up';
        
        const response = await fetch(`/api/orders/${orderId}/update-status/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            const orderIndex = activeOrders.findIndex(order => order.id === orderId);
            if (orderIndex !== -1) {
                activeOrders[orderIndex].status = newStatus;
                activeOrders[orderIndex].paymentStatus = 'Paid';
                
                renderActiveOrders();
                updateOrderCount();
                updateAnalytics();
                showToast(`Order #${orderId} marked as ${formatStatus(newStatus)}`, 'success');
            }
        } else {
            throw new Error('Failed to complete order');
        }
    } catch (error) {
        console.error('Error completing order:', error);
        showToast('Failed to complete order', 'error');
    }
}

async function cancelOrder(orderId) {
    if (confirm('Are you sure you want to cancel this order?')) {
        try {
            const response = await fetch(`/api/orders/${orderId}/update-status/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ status: 'cancelled' })
            });
            
            if (response.ok) {
                const orderIndex = activeOrders.findIndex(order => order.id === orderId);
                if (orderIndex !== -1) {
                    activeOrders.splice(orderIndex, 1);
                    renderActiveOrders();
                    updateOrderCount();
                    updateAnalytics();
                    showToast(`Order #${orderId} has been cancelled`, 'success');
                }
            } else {
                throw new Error('Failed to cancel order');
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            showToast('Failed to cancel order', 'error');
        }
    }
}

function updateOrderCount() {
    document.getElementById('activeOrderCount').textContent = `${activeOrders.length} Active Orders`;
}

// CSRF Token helper
function getCSRFToken() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
    return csrfToken ? csrfToken.value : '';
}

// Event listeners for order management
document.getElementById('orderTypeFilter').addEventListener('change', renderActiveOrders);
document.getElementById('statusFilter').addEventListener('change', renderActiveOrders);

// Event listeners for product management
document.getElementById('addProduct').addEventListener('click', addProduct);
document.getElementById('updateProduct').addEventListener('click', updateProduct);
document.getElementById('cancelEdit').addEventListener('click', cancelEdit);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeProducts();
    initializeOrders();
    updateAnalytics();
});