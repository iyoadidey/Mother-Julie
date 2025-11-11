// Toast Notification System
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    if (type === 'info') icon = 'fa-info-circle';
    
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
                clearNewOrderBadge(); // Clear badge when viewing orders page
                initializeOrders().then(() => {
                    startOrderPolling(); // Start polling when switching to orders page
                });
            } else {
                stopOrderPolling(); // Stop polling when leaving orders page
                if (pageId === 'dashboard') {
                    updateAnalytics();
                } else if (pageId === 'products') {
                    initializeProducts();
                } else if (pageId === 'daily' || pageId === 'weekly' || pageId === 'monthly' || pageId === 'yearly') {
                    loadReport(pageId);
                    startReportPolling(pageId);
                } else {
                    stopReportPolling();
                }
            }
        }
    });
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        // Redirect to logout endpoint
        window.location.href = '/admin_logout/';
    }
});

// Image Preview for Add Product
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

// Image Preview for Edit Product
if (document.getElementById('editProductImage')) {
    document.getElementById('editProductImage').addEventListener('change', function(e) {
        const preview = document.getElementById('editImagePreview');
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
}

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

// Initialize products from backend
async function initializeProducts() {
    try {
        const response = await fetch('/api/products/');
        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
        }
        
        const productsData = await response.json();
        console.log('Products loaded from API:', productsData);
        
        products = productsData.map(product => ({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category || '',
            stock: product.stock || product.stock_quantity || 0,
            image: product.image || null,
            size_options: product.size_options || {}
        }));
        
        console.log('Processed products:', products);
        renderAllProductsByCategory();
        updateOutOfStockBadge();
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Failed to load products from server: ' + error.message, 'error');
        products = [];
        // Still render to show the "no products" message
        renderAllProductsByCategory();
        updateOutOfStockBadge(); // Update badge even if products failed to load
    }
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
    if (!container) {
        console.error('allProductsContainer not found!');
        return;
    }
    
    container.innerHTML = '';
    
    console.log('Rendering products. Total products:', products.length);
    
    if (products.length === 0) {
        container.innerHTML = '<div class="no-orders">No products found. Add your first product above!</div>';
        return;
    }
    
    // Group products by category (handle empty categories)
    const productsByCategory = {};
    products.forEach(product => {
        const category = product.category || 'uncategorized';
        if (!productsByCategory[category]) {
            productsByCategory[category] = [];
        }
        productsByCategory[category].push(product);
    });
    
    // Render each category
    const sortedCategories = Object.keys(productsByCategory).sort();
    console.log('Categories to render:', sortedCategories);
    
    sortedCategories.forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';
        
        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = formatCategory(category);
        categorySection.appendChild(categoryTitle);
        
        const categoryProducts = document.createElement('div');
        categoryProducts.className = 'category-products';
        
        console.log(`Rendering ${productsByCategory[category].length} products in category: ${category}`);
        
        productsByCategory[category].forEach(product => {
            const productElement = document.createElement('div');
            productElement.className = 'category-product';
            productElement.setAttribute('data-product-id', product.id);
            
            // Get image URL - use uploaded image, or map to static file, or use default
            let imageUrl = product.image || '';
            if (!imageUrl) {
                // Map product names to their static image files
                const productImageMap = {
                    'Mais Con Yelo': '/static/orders_menupics/mais.png',
                    'Biscoff Classic': '/static/orders_menupics/biscoff.png',
                    'Buko Pandan': '/static/orders_menupics/buko.png',
                    'Mango Graham': '/static/orders_menupics/mango_graham.png',
                    'Ube Macapuno': '/static/orders_menupics/ube_macapuno.png',
                    'Rocky Road': '/static/orders_menupics/rocky_road.png',
                    'Coffee Jelly': '/static/orders_menupics/coffee_jelly.png',
                    'Dulce de Leche': '/static/orders_menupics/dulce_de_leche.png',
                    'Choco Peanut Banana': '/static/orders_menupics/choco_peanut_banana.png',
                    'Cookie Monster': '/static/orders_menupics/cookie_monster.png',
                    'Cheesy Bacon': '/static/orders_menupics/cheesy_bacon.png',
                    'Chili Con Carne': '/static/orders_menupics/chili_con_carne.png',
                    'Triple Cheese': '/static/orders_menupics/triple_cheese.png',
                    'Lasagna Jacket': '/static/orders_menupics/lasagna_jacket.png',
                    'Garlic Bread': '/static/orders_menupics/garlic_bread.png',
                    'Lasagna': '/static/orders_menupics/lasagna.png',
                    'Chicken Wrap': '/static/orders_menupics/hongar_chicken_wrap.png',
                    'Beef Wrap': '/static/orders_menupics/beef_wrap.png',
                    'Kesodilla': '/static/orders_menupics/kesodilla.png',
                    'Chicken Poppers': '/static/orders_menupics/chicken_poppers.png',
                    'Nachos': '/static/orders_menupics/nachos.png'
                };
                
                imageUrl = productImageMap[product.name];
                
                // If no specific mapping, use category defaults
                if (!imageUrl) {
                    const defaultImages = {
                        'desserts': '/static/orders_menupics/dessert.png',
                        'spud': '/static/orders_menupics/spud.png',
                        'pasta_bread': '/static/orders_menupics/pasta.png',
                        'wrap': '/static/orders_menupics/wrap.png',
                        'appetizers': '/static/orders_menupics/appetizer.png'
                    };
                    imageUrl = defaultImages[product.category] || '/static/orders_menupics/menu.png';
                }
            }
            
            productElement.innerHTML = `
                ${product.stock <= 0 ? '<div class="out-of-stock-dot" title="Out of Stock"></div>' : ''}
                <div class="product-image-container">
                    <img src="${imageUrl}" alt="${product.name}" class="product-thumbnail" onerror="this.src='/static/orders_menupics/menu.png'">
                </div>
                <div class="product-name-price">
                    <div class="product-name">${product.name}</div>
                    ${product.size_options && Object.keys(product.size_options).length > 0 
                        ? `<div class="product-price">M: P ${product.size_options.M || product.price} | L: P ${product.size_options.L || product.price}</div>`
                        : `<div class="product-price">P ${product.price}</div>`
                    }
                    <div class="product-stock" style="color: ${product.stock <= 0 ? '#dc3545' : product.stock <= 10 ? '#ffc107' : '#28a745'}; ${product.stock <= 0 ? 'font-weight: bold;' : ''}">Stock: ${product.stock}</div>
                    <div class="product-category">Category: ${formatCategory(product.category || 'uncategorized')}</div>
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
        const response = await fetch('/api/analytics/');
        if (!response.ok) throw new Error('Failed to fetch analytics');
        
        const data = await response.json();
        
        // Update display values
        document.getElementById('totalSales').textContent = `P ${data.total_sales.toFixed(2)}`;
        document.getElementById('totalProductSold').textContent = data.total_products_sold;
        
        // Update percentage changes
        updatePercentageDisplay('salesChange', data.sales_change);
        updatePercentageDisplay('productSoldChange', data.products_change);
        
        // Update order statistics table
        const orderStatsTable = document.getElementById('orderStatsTable');
        if (orderStatsTable) {
            orderStatsTable.innerHTML = '';
            data.order_stats.forEach(order => {
                // Format items list
                let itemsHtml = '';
                if (order.items && order.items.length > 0) {
                    itemsHtml = order.items.map(item => {
                        const sizeText = item.size ? ` (${item.size})` : '';
                        return `${item.name}${sizeText} x${item.quantity}`;
                    }).join('<br>');
                } else {
                    itemsHtml = `${order.items_count} item(s)`;
                }
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.order_id}</td>
                    <td>${order.customer}</td>
                    <td>${order.order_type}</td>
                    <td>${order.order_placed}</td>
                    <td>${order.delivery_pickup_date}</td>
                    <td style="max-width: 250px; font-size: 12px;">${itemsHtml}</td>
                    <td style="font-weight: bold;">Php ${parseFloat(order.total_amount || 0).toFixed(2)}</td>
                    <td><span class="status-badge ${getStatusClass(order.status)}">${formatStatus(order.status)}</span></td>
                    <td>
                        <button class="btn-delete-order" data-order-id="${order.order_id}" title="Delete Order">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                orderStatsTable.appendChild(row);
            });
            
            // Add event listeners to delete buttons
            document.querySelectorAll('.btn-delete-order').forEach(btn => {
                btn.addEventListener('click', function() {
                    const orderId = this.getAttribute('data-order-id');
                    deleteOrderFromStats(orderId);
                });
            });
        }
        
        // Update order count
        const orderStatsCount = document.getElementById('orderStatsCount');
        if (orderStatsCount) {
            orderStatsCount.textContent = `${data.order_count} Orders`;
        }
        
    } catch (error) {
        console.error('Error updating analytics:', error);
        showToast('Failed to load analytics data', 'error');
    }
}

// Delete all orders
async function deleteAllOrders() {
    try {
        const response = await fetch('/api/orders/delete-all/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showToast('All orders have been deleted successfully', 'success');
            // Reload orders to show empty state
            await loadOrdersFromBackend();
            renderActiveOrders();
            updateOrderCount();
            updateAnalytics();
            // Clear viewed orders
            viewedOrderIds.clear();
            localStorage.removeItem('admin_viewed_orders');
            // Reset new orders count
            newOrdersCount = 0;
            updateNewOrderBadge();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete all orders');
        }
    } catch (error) {
        console.error('Error deleting all orders:', error);
        showToast(error.message || 'Failed to delete all orders', 'error');
    }
}

// Delete order from order statistics
async function deleteOrderFromStats(orderId) {
    if (confirm(`Are you sure you want to delete order ${orderId}? This action cannot be undone.`)) {
        try {
            const response = await fetch(`/api/orders/${orderId}/delete/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete order');
            }
            
            // Reload analytics to refresh the table
            await updateAnalytics();
            showToast(`Order ${orderId} deleted successfully!`, 'success');
        } catch (error) {
            console.error('Error deleting order:', error);
            showToast(error.message || 'Failed to delete order', 'error');
        }
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
        'pasta_bread': 'Pasta/Bread',
        'uncategorized': 'Other Products'
    };
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Format status for display
function formatStatus(status, orderType = null) {
    // Special handling for dine-in orders
    if (orderType === 'dine-in') {
        if (status === 'delivered') {
            return 'Complete';
        } else if (status === 'cancelled') {
            return 'Cancel';
        } else {
            return 'In Progress';
        }
    }
    
    // For other order types
    const statusMap = {
        'order_placed': 'Order Placed',
        'preparing': 'Preparing Order',
        'out_for_delivery': 'Out for Delivery',
        'delivered': 'Delivered',
        'ready_for_pickup': 'Ready for Pickup',
        'picked_up': 'Picked Up',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
    
    // Save product directly with FormData (handles file uploads)
    saveProduct(name, price, category, stock, null);
}

// Save product to backend
async function saveProduct(name, price, category, stock, imageData) {
    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('price', parseFloat(price));
        formData.append('category', category);
        formData.append('stock', parseInt(stock));
        
        // If imageData is a File object or base64, handle it
        const imageInput = document.getElementById('productImage');
        if (imageInput.files.length > 0) {
            formData.append('image', imageInput.files[0]);
        }
        
        const response = await fetch('/api/products/create/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create product');
        }
        
        const result = await response.json();
        await initializeProducts(); // Reload products from backend
        updateOutOfStockBadge(); // Update badge count
        resetForm();
        showToast('Product added successfully!', 'success');
    } catch (error) {
        console.error('Error saving product:', error);
        showToast(error.message || 'Failed to add product', 'error');
    }
}

// Edit a product
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    editingProductId = id;
    
    // Hide add section, show edit section
    document.querySelector('.product-management:not(#editProductSection)').style.display = 'none';
    document.getElementById('editProductSection').style.display = 'block';
    
    // Set form values in edit section
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductPrice').value = product.price;
    document.getElementById('editProductCategory').value = product.category;
    document.getElementById('editProductStock').value = product.stock;
    
    // Set size options if category is desserts
    if (product.category === 'desserts') {
        document.getElementById('editSizeOptionsRow').style.display = 'flex';
        if (product.size_options && Object.keys(product.size_options).length > 0) {
            document.getElementById('editSizeM').value = product.size_options.M || '';
            document.getElementById('editSizeL').value = product.size_options.L || '';
        } else {
            // Default to L price if no size options
            document.getElementById('editSizeM').value = '';
            document.getElementById('editSizeL').value = product.price || '';
        }
    } else {
        document.getElementById('editSizeOptionsRow').style.display = 'none';
    }
    
    // Set image preview if exists
    const editPreview = document.getElementById('editImagePreview');
    if (product.image) {
        editPreview.innerHTML = `<img src="${product.image}" alt="Product Image">`;
    } else {
        editPreview.innerHTML = '<span>No image selected</span>';
    }
    
    // Scroll to edit section
    document.getElementById('editProductSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Update a product
function updateProduct() {
    if (editingProductId === null) return;
    
    if (!validateEditProductForm()) {
        showToast('Please fix the errors in the form', 'error');
        return;
    }
    
    const name = document.getElementById('editProductName').value;
    const price = document.getElementById('editProductPrice').value;
    const category = document.getElementById('editProductCategory').value;
    const stock = document.getElementById('editProductStock').value;
    
    // Get size options if category is desserts
    let sizeOptions = {};
    if (category === 'desserts') {
        const sizeM = document.getElementById('editSizeM').value;
        const sizeL = document.getElementById('editSizeL').value;
        if (sizeM && sizeL) {
            sizeOptions = { M: parseFloat(sizeM), L: parseFloat(sizeL) };
        }
    }
    
    // Save updated product directly with FormData (handles file uploads)
    // If no new image is selected, the existing image will be kept
    const existingProduct = products.find(p => p.id === editingProductId);
    const imageData = existingProduct ? existingProduct.image : null;
    saveUpdatedProduct(name, price, category, stock, imageData, sizeOptions);
}

// Save updated product to backend
async function saveUpdatedProduct(name, price, category, stock, imageData, sizeOptions = {}) {
    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('price', parseFloat(price));
        formData.append('category', category);
        formData.append('stock', parseInt(stock));
        
        // Always ensure product remains visible on frontend
        formData.append('show_in_all_menu', 'true');
        formData.append('is_active', 'true');
        
        // Add size options if provided
        if (Object.keys(sizeOptions).length > 0) {
            formData.append('size_options', JSON.stringify(sizeOptions));
        }
        
        // Check if a new image was selected
        const imageInput = document.getElementById('editProductImage');
        if (imageInput.files.length > 0) {
            formData.append('image', imageInput.files[0]);
        }
        
        const response = await fetch(`/api/products/${editingProductId}/update/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update product');
        }
        
        await initializeProducts(); // Reload products from backend
        updateOutOfStockBadge(); // Update badge count
        resetForm();
        showToast('Product updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating product:', error);
        showToast(error.message || 'Failed to update product', 'error');
    }
}

// Delete a product from backend
async function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            const response = await fetch(`/api/products/${id}/delete/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete product');
            }
            
            await initializeProducts(); // Reload products from backend
            updateOutOfStockBadge(); // Update badge count
            showToast('Product deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast(error.message || 'Failed to delete product', 'error');
        }
    }
}

// Validate edit product form
function validateEditProductForm() {
    let isValid = true;
    
    // Reset error states
    document.getElementById('editNameError').style.display = 'none';
    document.getElementById('editPriceError').style.display = 'none';
    document.getElementById('editCategoryError').style.display = 'none';
    document.getElementById('editStockError').style.display = 'none';
    
    document.getElementById('editProductName').classList.remove('error');
    document.getElementById('editProductPrice').classList.remove('error');
    document.getElementById('editProductCategory').classList.remove('error');
    document.getElementById('editProductStock').classList.remove('error');
    
    // Validate product name
    const name = document.getElementById('editProductName').value.trim();
    if (!name) {
        document.getElementById('editNameError').style.display = 'block';
        document.getElementById('editProductName').classList.add('error');
        isValid = false;
    }
    
    // Validate price
    const price = parseInt(document.getElementById('editProductPrice').value);
    if (isNaN(price) || price < 1 || !Number.isInteger(price)) {
        document.getElementById('editPriceError').style.display = 'block';
        document.getElementById('editProductPrice').classList.add('error');
        isValid = false;
    }
    
    // Validate category
    const category = document.getElementById('editProductCategory').value;
    if (!category) {
        document.getElementById('editCategoryError').style.display = 'block';
        document.getElementById('editProductCategory').classList.add('error');
        isValid = false;
    }
    
    // Validate stock
    const stock = parseInt(document.getElementById('editProductStock').value);
    if (isNaN(stock) || stock < 0) {
        document.getElementById('editStockError').style.display = 'block';
        document.getElementById('editProductStock').classList.add('error');
        isValid = false;
    }
    
    return isValid;
}

// Reset form
function resetForm() {
    // Reset add product form
    document.getElementById('productName').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreview').innerHTML = '<span>No image selected</span>';
    
    // Reset edit product form
    document.getElementById('editProductName').value = '';
    document.getElementById('editProductPrice').value = '';
    document.getElementById('editProductCategory').value = '';
    document.getElementById('editProductStock').value = '';
    document.getElementById('editProductImage').value = '';
    document.getElementById('editImagePreview').innerHTML = '<span>No image selected</span>';
    document.getElementById('editSizeM').value = '';
    document.getElementById('editSizeL').value = '';
    document.getElementById('editSizeOptionsRow').style.display = 'none';
    
    // Reset error states - add form
    document.getElementById('nameError').style.display = 'none';
    document.getElementById('priceError').style.display = 'none';
    document.getElementById('categoryError').style.display = 'none';
    document.getElementById('stockError').style.display = 'none';
    
    document.getElementById('productName').classList.remove('error');
    document.getElementById('productPrice').classList.remove('error');
    document.getElementById('productCategory').classList.remove('error');
    document.getElementById('productStock').classList.remove('error');
    
    // Reset error states - edit form
    document.getElementById('editNameError').style.display = 'none';
    document.getElementById('editPriceError').style.display = 'none';
    document.getElementById('editCategoryError').style.display = 'none';
    document.getElementById('editStockError').style.display = 'none';
    
    document.getElementById('editProductName').classList.remove('error');
    document.getElementById('editProductPrice').classList.remove('error');
    document.getElementById('editProductCategory').classList.remove('error');
    document.getElementById('editProductStock').classList.remove('error');
    
    // Show add section, hide edit section
    document.querySelector('.product-management:not(#editProductSection)').style.display = 'block';
    document.getElementById('editProductSection').style.display = 'none';
    
    editingProductId = null;
}

// Cancel edit
function cancelEdit() {
    resetForm();
}

// ========== ORDER MANAGEMENT WITH BACKEND INTEGRATION ==========

// Order Management Functions
let lastOrderCount = 0;
let lastOrderIds = new Set();
let newOrdersCount = 0;
let viewedOrderIds = new Set(); // Track viewed orders

async function initializeOrders() {
    await loadOrdersFromBackend();
    
    // Load viewed orders from localStorage
    const savedViewedOrders = localStorage.getItem('admin_viewed_orders');
    if (savedViewedOrders) {
        viewedOrderIds = new Set(JSON.parse(savedViewedOrders));
    }
    
    renderActiveOrders();
    updateOrderCount();
    updateAnalytics();
    
    // Store initial order count and IDs for comparison
    lastOrderCount = activeOrders.length;
    lastOrderIds = new Set(activeOrders.map(order => order.id));
    
    // Initialize badge (should be 0 when viewing orders page)
    updateNewOrderBadge();
}

// Convert datetime to Philippine time (UTC+8 / Asia/Manila)
// Note: Django already converts to Philippine time, so we just need to format it
function convertToPhilippineTime(dateString) {
    try {
        // Django sends datetime as 'YYYY-MM-DD HH:MM:SS' already in Philippine time
        // Parse it and format for display
        const [datePart, timePart] = dateString.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');
        
        // Format date as MM/DD/YYYY
        const formattedDate = `${month}/${day}/${year}`;
        
        // Format time as HH:MM:SS AM/PM
        let hours = parseInt(hour, 10);
        const minutes = minute.padStart(2, '0');
        const seconds = second.padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        const formattedHours = String(hours).padStart(2, '0');
        const formattedTime = `${formattedHours}:${minutes}:${seconds} ${ampm}`;
        
        return {
            date: formattedDate,
            time: formattedTime
        };
    } catch (error) {
        console.error('Error converting to Philippine time:', error, dateString);
        // Fallback: try to parse as Date object
        try {
            const date = new Date(dateString);
            return {
                date: date.toLocaleDateString('en-US'),
                time: date.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
        } catch (e) {
            return {
                date: 'N/A',
                time: 'N/A'
            };
        }
    }
}

async function loadOrdersFromBackend() {
    try {
        const response = await fetch('/api/orders/all/');
        if (response.ok) {
            const ordersData = await response.json();
            
            // Convert backend data to frontend format
            activeOrders = ordersData.map(order => {
                const phTime = convertToPhilippineTime(order.created_at);
                return {
                    id: order.order_id,
                    customer: order.customer_name,
                    orderType: order.order_type,
                    paymentMethod: order.payment_method || 'Cash',
                    paymentStatus: 'Paid',
                    total: order.total_amount,
                    status: order.status,
                    date: phTime.date,
                    time: phTime.time,
                    items: order.items || []
                };
            });
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
        
        // Check if order is new (not viewed yet)
        const isNewOrder = !viewedOrderIds.has(order.id);
        
        const statusDisplay = formatStatus(order.status, order.orderType);
        const totalItems = order.items.reduce((total, item) => total + item.quantity, 0);
        
        orderCard.innerHTML = `
            <div class="order-details-section" style="position: relative;">
                ${isNewOrder ? '<div class="new-order-indicator" title="New Order"></div>' : ''}
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
                    <span class="detail-value">${order.date} at ${order.time}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Order Type:</span>
                    <span class="detail-value">${order.orderType === 'dine-in' ? 'Dine In' : order.orderType === 'pickup' ? 'Pickup' : order.orderType === 'delivery' ? 'Delivery' : order.orderType}</span>
                </div>
                ${order.orderType !== 'dine-in' ? `
                <div class="detail-row">
                    <span class="detail-label">${order.orderType === 'delivery' ? 'Delivery Address:' : 'Pickup Location:'}</span>
                    <span class="detail-value">${order.orderType === 'delivery' ? 'Customer Address' : 'Store Location'}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">Total Amount:</span>
                    <span class="detail-value">Php ${parseFloat(order.total || 0).toFixed(2)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">No. of Items:</span>
                    <span class="detail-value">${totalItems} items</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value status-badge ${order.status === 'delivered' || order.status === 'picked_up' || (order.orderType === 'dine-in' && order.status === 'delivered') ? 'status-completed' : order.status === 'cancelled' ? 'status-cancelled' : 'status-preparing'}">${statusDisplay}</span>
                </div>
                <div class="detail-row" style="border-bottom: none; padding-bottom: 0;">
                    <span class="detail-label" style="display: block; width: 100%; margin-bottom: 8px;">Order Items:</span>
                    <div class="order-items-list" style="width: 100%;">
                        ${order.items && order.items.length > 0 ? order.items.map(item => {
                            const itemName = item.name || item.product_name || 'Unknown Item';
                            const itemSize = item.size || '';
                            const itemQuantity = item.quantity || 1;
                            const itemPrice = parseFloat(item.price || item.unit_price || 0);
                            const itemTotal = itemPrice * itemQuantity;
                            
                            return `
                                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px;">
                                    <span>${itemName}${itemSize ? ` (${itemSize})` : ''} x${itemQuantity}</span>
                                    <span style="font-weight: bold; color: #333;">Php ${itemTotal.toFixed(2)}</span>
                                </div>
                            `;
                        }).join('') : '<div style="padding: 6px 0; color: #666; font-size: 13px;">No items found</div>'}
                    </div>
                </div>
            </div>
            
            ${order.orderType !== 'dine-in' ? `
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
            
            ${(order.orderType === 'pickup' && order.status === 'picked_up') || (order.orderType === 'delivery' && order.status === 'delivered') || order.status === 'cancelled' ? '' : `
            <div class="order-management">
                <div class="order-status">
                    <label for="status-${order.id}">Update Status:</label>
                    <select id="status-${order.id}" class="status-select" data-order-id="${order.id}">
                        ${getStatusOptions(order.orderType, order.status)}
                    </select>
                </div>
                <div class="order-actions">
                    <button class="btn btn-danger btn-cancel" data-order-id="${order.id}">Cancel Order</button>
                </div>
            </div>
            `}
            ` : `
            <div class="status-indicator">
                <div class="status-title">CURRENT STATUS</div>
                <div class="current-status">${statusDisplay}</div>
                <div class="status-details">${getStatusDetails(order.status, order.orderType)}</div>
            </div>
            
            ${order.status !== 'delivered' && order.status !== 'cancelled' ? `
            <div class="order-management">
                <div class="order-actions" style="justify-content: center;">
                    <button class="btn btn-success btn-complete" data-order-id="${order.id}">
                        Mark as Complete
                    </button>
                    <button class="btn btn-danger btn-cancel" data-order-id="${order.id}">Cancel Order</button>
                </div>
            </div>
            ` : ''}
            `}
        `;
        container.appendChild(orderCard);
        
        // Mark order as viewed when clicked
        orderCard.addEventListener('click', function() {
            if (isNewOrder) {
                viewedOrderIds.add(order.id);
                // Save to localStorage
                localStorage.setItem('admin_viewed_orders', JSON.stringify([...viewedOrderIds]));
                // Remove the indicator
                const indicator = orderCard.querySelector('.new-order-indicator');
                if (indicator) {
                    indicator.remove();
                }
                // Update new orders count if needed
                updateNewOrderBadge();
            }
        });
    });
    
    // Add event listener for delete all orders button
    const deleteAllBtn = document.getElementById('deleteAllOrdersBtn');
    if (deleteAllBtn) {
        // Remove any existing event listeners by cloning the button
        const newDeleteAllBtn = deleteAllBtn.cloneNode(true);
        deleteAllBtn.parentNode.replaceChild(newDeleteAllBtn, deleteAllBtn);
        
        // Add single event listener
        newDeleteAllBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Single confirmation - exit immediately if cancelled
            if (!confirm('⚠️ WARNING: Are you sure you want to delete ALL orders? This action cannot be undone and will permanently remove all order data from the database.')) {
                return; // User clicked Cancel - exit immediately
            }
            
            // Confirmation passed - proceed with deletion
            await deleteAllOrders();
        });
    }
    
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
    // Special handling for dine-in orders
    if (orderType === 'dine-in') {
        if (status === 'delivered') {
            return 'This order has been completed.';
        } else if (status === 'cancelled') {
            return 'This order has been cancelled.';
        } else {
            return 'Your order is being prepared.';
        }
    }
    
    const statusDetails = {
        'order_placed': 'Your order has been placed and is being processed.',
        'preparing': 'Your order is being prepared.',
        'out_for_delivery': 'Your order is out for delivery.',
        'delivered': 'Your order has been successfully delivered.',
        'ready_for_pickup': 'Your order is ready for pickup at our store.',
        'picked_up': 'Your order has been picked up.',
        'cancelled': 'This order has been cancelled.'
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
        
        // Determine status based on order type
        let newStatus;
        if (order.orderType === 'dine-in') {
            newStatus = 'delivered'; // Use 'delivered' status for dine-in completed orders
        } else if (order.orderType === 'delivery') {
            newStatus = 'delivered';
        } else {
            newStatus = 'picked_up';
        }
        
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
                showToast(`Order #${orderId} marked as ${formatStatus(newStatus, order.orderType)}`, 'success');
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
    if (!confirm('Are you sure you want to cancel this order?')) {
        return; // User clicked Cancel on confirmation dialog - exit immediately
    }
    
    // Find the order and update UI immediately for instant feedback
    const orderIndex = activeOrders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) {
        showToast('Order not found', 'error');
        return;
    }
    
    // Optimistically update the UI immediately
    activeOrders[orderIndex].status = 'cancelled';
    renderActiveOrders();
    updateOrderCount();
    
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
            // Update analytics after successful API call
            updateAnalytics();
            showToast(`Order #${orderId} has been cancelled`, 'success');
        } else {
            // Revert the optimistic update if API call failed
            const error = await response.json();
            throw new Error(error.error || 'Failed to cancel order');
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        // Revert the optimistic update
        const order = activeOrders.find(o => o.id === orderId);
        if (order) {
            // Try to reload from backend to get actual status
            await loadOrdersFromBackend();
            renderActiveOrders();
            updateOrderCount();
        }
        showToast(error.message || 'Failed to cancel order', 'error');
    }
}

function updateOrderCount() {
    document.getElementById('activeOrderCount').textContent = `${activeOrders.length} Active Orders`;
}

// Load report data
async function loadReport(period) {
    try {
        const response = await fetch(`/api/reports/${period}/`);
        if (!response.ok) throw new Error('Failed to fetch report');
        
        const data = await response.json();
        
        // Update display based on period
        const salesElement = document.getElementById(`${period}Sales`);
        const productsElement = document.getElementById(`${period}ProductSold`);
        const salesChangeElement = document.getElementById(`${period}Change`);
        const productsChangeElement = document.getElementById(`${period}ProductChange`);
        
        if (salesElement) {
            salesElement.textContent = `P ${data.sales.toFixed(2)}`;
        }
        if (productsElement) {
            productsElement.textContent = data.products_sold;
        }
        if (salesChangeElement) {
            updatePercentageDisplay(`${period}Change`, data.sales_change);
        }
        if (productsChangeElement) {
            updatePercentageDisplay(`${period}ProductChange`, data.products_change);
        }
        
        // Display products list
        renderProductsList(period, data.products_list || []);
    } catch (error) {
        console.error(`Error loading ${period} report:`, error);
        showToast(`Failed to load ${period} report`, 'error');
    }
}

// Start polling for report updates
function startReportPolling(period) {
    // Clear any existing interval
    if (reportPollInterval) {
        clearInterval(reportPollInterval);
    }
    
    currentReportPeriod = period;
    
    // Poll every 5 seconds for real-time updates
    reportPollInterval = setInterval(async () => {
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === period) {
            await loadReport(period);
        }
    }, 5000); // Poll every 5 seconds
}

// Stop polling for report updates
function stopReportPolling() {
    if (reportPollInterval) {
        clearInterval(reportPollInterval);
        reportPollInterval = null;
    }
    currentReportPeriod = null;
}

// Render products list for reports
function renderProductsList(period, productsList) {
    const container = document.getElementById(`${period}ProductsList`);
    if (!container) return;
    
    if (productsList.length === 0) {
        container.innerHTML = '<div class="no-orders">No products sold in this period</div>';
        return;
    }
    
    // Create table for products
    let html = `
        <div style="overflow-x: auto;">
            <table class="orders-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="text-align: left; padding: 12px 15px; border-bottom: 2px solid #e0e0e0; color: #666; font-weight: 600; background-color: #f9f9f9;">Product Name</th>
                        <th style="text-align: center; padding: 12px 15px; border-bottom: 2px solid #e0e0e0; color: #666; font-weight: 600; background-color: #f9f9f9;">Quantity Sold</th>
                        <th style="text-align: center; padding: 12px 15px; border-bottom: 2px solid #e0e0e0; color: #666; font-weight: 600; background-color: #f9f9f9;">Orders</th>
                        <th style="text-align: right; padding: 12px 15px; border-bottom: 2px solid #e0e0e0; color: #666; font-weight: 600; background-color: #f9f9f9;">Revenue</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    productsList.forEach((product, index) => {
        const rowStyle = index % 2 === 0 ? 'background-color: #fff;' : 'background-color: #f9f9f9;';
        html += `
            <tr style="border-bottom: 1px solid #f0f0f0; ${rowStyle}">
                <td style="padding: 12px 15px; font-weight: 500; color: #333;">${product.name}</td>
                <td style="padding: 12px 15px; text-align: center; color: #666;">${product.quantity}</td>
                <td style="padding: 12px 15px; text-align: center; color: #666;">${product.orders}</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold; color: #28a745;">Php ${product.revenue.toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
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

// Show/hide size options when category changes in edit form
document.getElementById('editProductCategory').addEventListener('change', function() {
    if (this.value === 'desserts') {
        document.getElementById('editSizeOptionsRow').style.display = 'flex';
    } else {
        document.getElementById('editSizeOptionsRow').style.display = 'none';
    }
});

// Update out-of-stock badge count
function updateOutOfStockBadge() {
    const badge = document.getElementById('outOfStockBadge');
    if (!badge) return;
    
    // Count products with 0 stock
    const outOfStockCount = products.filter(p => p.stock <= 0).length;
    
    if (outOfStockCount > 0) {
        badge.textContent = outOfStockCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// Update new order badge count
function updateNewOrderBadge() {
    const badge = document.getElementById('newOrderBadge');
    if (!badge) {
        console.error('newOrderBadge element not found!');
        return;
    }
    
    if (newOrdersCount > 0) {
        badge.textContent = newOrdersCount;
        badge.style.display = 'inline-block';
        console.log(`Badge updated: ${newOrdersCount} new orders`);
    } else {
        badge.style.display = 'none';
    }
}

// Clear new order badge when viewing orders page
function clearNewOrderBadge() {
    newOrdersCount = 0;
    updateNewOrderBadge();
}

// Real-time stock update function
async function updateProductStocksInAdmin(updatedStocks) {
    if (!updatedStocks || Object.keys(updatedStocks).length === 0) return;
    
    // Update the products array with new stock values
    Object.keys(updatedStocks).forEach(productId => {
        const stockInfo = updatedStocks[productId];
        const productIndex = products.findIndex(p => p.id == productId);
        if (productIndex !== -1) {
            products[productIndex].stock = stockInfo.stock;
            // Update the display for this product
            updateProductStockDisplay(productId, stockInfo.stock);
        }
    });
    
    // Update out-of-stock badge
    updateOutOfStockBadge();
    
    // Re-render products if on products page
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'products') {
        renderAllProductsByCategory();
    }
}

// Update stock display for a specific product
function updateProductStockDisplay(productId, newStock) {
    // Find the product element and update its stock display
    const productElements = document.querySelectorAll(`[data-product-id="${productId}"]`);
    productElements.forEach(element => {
        const stockElement = element.querySelector('.product-stock');
        if (stockElement) {
            stockElement.textContent = `Stock: ${newStock}`;
            
            // Update visual indicator if stock is low or out
            if (newStock <= 0) {
                stockElement.style.color = '#dc3545';
                stockElement.style.fontWeight = 'bold';
            } else if (newStock <= 10) {
                stockElement.style.color = '#ffc107';
            } else {
                stockElement.style.color = '#28a745';
            }
        }
    });
}

// Poll for new orders (check every 3 seconds if on orders page)
let orderPollInterval = null;

// Poll for stock updates (check every 5 seconds if on products page)
let stockUpdateInterval = null;

// Poll for report updates
let reportPollInterval = null;
let currentReportPeriod = null;

function startStockPolling() {
    // Clear any existing interval
    if (stockUpdateInterval) {
        clearInterval(stockUpdateInterval);
    }
    
    // Only poll if on products page
    stockUpdateInterval = setInterval(async () => {
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'products') {
            // Refresh products to get latest stock
            await initializeProducts();
            updateOutOfStockBadge(); // Update badge after refresh
        }
    }, 5000); // Poll every 5 seconds
}

function stopStockPolling() {
    if (stockUpdateInterval) {
        clearInterval(stockUpdateInterval);
        stockUpdateInterval = null;
    }
}

// Poll for new orders
async function pollForNewOrders() {
    try {
        const response = await fetch('/api/orders/all/');
        if (response.ok) {
            const ordersData = await response.json();
            
            // Convert to frontend format
            const currentOrderIds = new Set(ordersData.map(order => order.order_id));
            
            // Check for new orders (only if we have previous orders to compare)
            if (lastOrderIds.size > 0) {
                const newOrderIds = [...currentOrderIds].filter(id => !lastOrderIds.has(id));
                
                if (newOrderIds.length > 0) {
                    // New orders detected!
                    const newOrders = ordersData.filter(order => newOrderIds.includes(order.order_id));
                    
                    // Update new orders count (only count unviewed new orders)
                    const unviewedNewOrders = newOrderIds.filter(id => !viewedOrderIds.has(id));
                    newOrdersCount += unviewedNewOrders.length;
                    updateNewOrderBadge();
                    
                    console.log(`New orders detected: ${newOrderIds.length}, Total new orders: ${newOrdersCount}`);
                    
                    // Update last known orders immediately (before reloading)
                    lastOrderCount = ordersData.length;
                    lastOrderIds = new Set(ordersData.map(order => order.order_id));
                    
                    // Reload orders to show new ones (only if on orders page)
                    const activePage = document.querySelector('.page.active');
                    if (activePage && activePage.id === 'orders') {
                        await loadOrdersFromBackend();
                        renderActiveOrders();
                        updateOrderCount();
                        updateAnalytics();
                    }
                }
            } else {
                // First time loading - just update the last known orders
                lastOrderCount = ordersData.length;
                lastOrderIds = new Set(ordersData.map(order => order.order_id));
            }
        }
    } catch (error) {
        console.error('Error polling for new orders:', error);
    }
}

function startOrderPolling() {
    // Clear any existing interval
    if (orderPollInterval) {
        clearInterval(orderPollInterval);
    }
    
    // Poll regardless of which page is active (to show badge on all pages)
    orderPollInterval = setInterval(async () => {
        await pollForNewOrders();
    }, 3000); // Poll every 3 seconds
}

function stopOrderPolling() {
    if (orderPollInterval) {
        clearInterval(orderPollInterval);
        orderPollInterval = null;
    }
}

// Listen for order creation events (if using custom events)
window.addEventListener('orderCreated', async function(event) {
    if (event.detail && event.detail.updated_stocks) {
        updateProductStocksInAdmin(event.detail.updated_stocks);
    }
});

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await initializeProducts(); // Wait for products to load first
    updateOutOfStockBadge(); // Update badge on initial load
    await initializeOrders(); // Wait for orders to load first
    updateAnalytics();
    
    // Start polling for stock updates
    startStockPolling();
    
    // Start polling for new orders
    startOrderPolling();
    
    // Stop polling when page is hidden
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopStockPolling();
            stopOrderPolling();
            stopReportPolling();
        } else {
            startStockPolling();
            startOrderPolling();
            // Update badge when page becomes visible again
            updateOutOfStockBadge();
            // Resume report polling if on a report page
            const activePage = document.querySelector('.page.active');
            if (activePage && (activePage.id === 'daily' || activePage.id === 'weekly' || activePage.id === 'monthly' || activePage.id === 'yearly')) {
                startReportPolling(activePage.id);
            }
        }
    });
});