// admin_dashboard.js - Updated to use shared_data.js

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
            
            // Refresh data when switching to specific pages
            if (pageId === 'products') {
                renderProducts();
            } else if (pageId === 'orders') {
                renderOrders();
            } else if (pageId === 'dashboard') {
                updateDashboardMetrics();
            }
        }
    });
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', function() {
    showToast(
        'Confirm Logout', 
        'Are you sure you want to logout?', 
        'warning', 
        0,
        [
            {
                text: 'Cancel',
                action: () => console.log('Logout cancelled')
            },
            {
                text: 'Logout',
                action: () => {
                    // Clear admin session and redirect to login
                    localStorage.removeItem('adminLoggedIn');
                    showToast('Success', 'You have been logged out successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = '/signin/'; // Redirect to login page
                    }, 1500);
                }
            }
        ]
    );
});

// Product Management functionality
let editingProductId = null;
let currentImage = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is admin (additional security)
    if (!localStorage.getItem('adminLoggedIn')) {
        window.location.href = '/login/';
        return;
    }
    
    initializeProducts();
    setupEventListeners();
    initializeImagePreview();
    initializeSizeOptions();
    updateDashboardMetrics();
    
    // Listen for order updates from orders menu
    window.addEventListener('ordersUpdated', function() {
        if (document.getElementById('orders').classList.contains('active')) {
            renderOrders();
        }
        updateDashboardMetrics();
    });
});

function setupEventListeners() {
    // Form submission
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (editingProductId) {
                updateProduct();
            } else {
                addProduct();
            }
        });
    }
    
    // Category change listener for size options
    const categorySelect = document.getElementById('productCategory');
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            toggleSizeOptions(this.value);
        });
    }
    
    // Image upload
    const productImage = document.getElementById('productImage');
    if (productImage) {
        productImage.addEventListener('change', handleImageUpload);
    }
    
    // Prevent negative values in inputs
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            if (this.value < 0) this.value = 0;
        });
    });
}

function initializeImagePreview() {
    const preview = document.getElementById('imagePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-image"></i>
                <div>No image selected</div>
            </div>
        `;
    }
}

function initializeSizeOptions() {
    // Initial setup
    toggleSizeOptions(document.getElementById('productCategory').value);
}

function toggleSizeOptions(category) {
    const sizeOptionsContainer = document.getElementById('sizeOptionsContainer');
    const singlePriceContainer = document.getElementById('singlePriceContainer');
    
    if (category === 'desserts') {
        // Show size options for desserts
        sizeOptionsContainer.style.display = 'block';
        singlePriceContainer.style.display = 'none';
        
        // Make size inputs required
        document.getElementById('priceLarge').required = true;
        document.getElementById('priceMedium').required = true;
        document.getElementById('productPrice').required = false;
    } else {
        // Hide size options for other categories
        sizeOptionsContainer.style.display = 'none';
        singlePriceContainer.style.display = 'block';
        
        // Make single price required
        document.getElementById('priceLarge').required = false;
        document.getElementById('priceMedium').required = false;
        document.getElementById('productPrice').required = true;
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        // Validate file type
        if (!file.type.match('image.*')) {
            showToast('Invalid File', 'Please select a valid image file (JPEG, PNG, GIF)', 'error');
            return;
        }
        
        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('File Too Large', 'Image size should be less than 2MB', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImage = e.target.result;
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button type="button" class="remove-image" onclick="removeImage()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            showToast('Image Uploaded', 'Product image uploaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
    }
}

function removeImage() {
    currentImage = null;
    const preview = document.getElementById('imagePreview');
    const fileInput = document.getElementById('productImage');
    
    preview.innerHTML = `
        <div class="placeholder">
            <i class="fas fa-image"></i>
            <div>No image selected</div>
        </div>
    `;
    
    if (fileInput) {
        fileInput.value = '';
    }
    showToast('Image Removed', 'Product image has been removed', 'info');
}

function initializeProducts() {
    renderProducts();
}

function renderProducts() {
    const productList = document.getElementById('productList');
    const products = window.sharedData.getProducts();
    
    if (productList) {
        productList.innerHTML = '';
        
        if (products.length === 0) {
            productList.innerHTML = `
                <div class="no-products" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-box-open" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No products found. Add your first product!</p>
                </div>
            `;
            return;
        }
        
        products.forEach(product => {
            const priceDisplay = product.category === 'desserts' && product.sizeOptions
                ? `Large: ₱${product.sizeOptions.L} | Medium: ₱${product.sizeOptions.M}`
                : `₱${product.price}`;
                
            const productRow = document.createElement('div');
            productRow.className = 'product-row';
            productRow.innerHTML = `
                <div class="product-info">
                    <img src="${product.image}" alt="${product.name}" class="product-image-small" 
                         onerror="this.src='/static/orders_menupics/default_food.png'">
                    <div class="product-details">
                        <div class="product-name">${product.name}</div>
                        <div class="product-category">${formatCategory(product.category)}</div>
                        <div class="product-price-stock">${priceDisplay} | Stock: ${product.stock}</div>
                    </div>
                </div>
                <div class="product-actions">
                    <button class="btn-edit" data-id="${product.id}">Edit</button>
                    <button class="btn-delete" data-id="${product.id}">Delete</button>
                </div>
            `;
            productList.appendChild(productRow);
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
}

function formatCategory(category) {
    const categoryMap = {
        'desserts': 'Desserts',
        'spuds': 'Spud',
        'wrap': 'Wrap',
        'appetizers': 'Appetizers',
        'pasta': 'Pasta/Bread'
    };
    return categoryMap[category] || category;
}

function addProduct() {
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const stock = document.getElementById('productStock').value;
    
    let priceData;
    
    if (category === 'desserts') {
        const priceLarge = document.getElementById('priceLarge').value;
        const priceMedium = document.getElementById('priceMedium').value;
        
        if (!priceLarge || !priceMedium) {
            showToast('Missing Information', 'Please fill in both size prices for desserts', 'error');
            return;
        }
        
        priceData = {
            price: parseFloat(priceLarge), // Use large price as main price
            sizeOptions: {
                "L": parseFloat(priceLarge),
                "M": parseFloat(priceMedium)
            }
        };
    } else {
        const singlePrice = document.getElementById('productPrice').value;
        if (!singlePrice) {
            showToast('Missing Information', 'Please fill in the product price', 'error');
            return;
        }
        priceData = {
            price: parseFloat(singlePrice),
            sizeOptions: null
        };
    }
    
    if (!name || !category || !stock) {
        showToast('Missing Information', 'Please fill in all fields', 'error');
        return;
    }
    
    if (stock < 0) {
        showToast('Invalid Values', 'Stock cannot be negative', 'error');
        return;
    }
    
    const productData = {
        name: name,
        category: category,
        stock: parseInt(stock),
        ...priceData,
        image: currentImage || window.sharedData.getDefaultImageForCategory(category)
    };
    
    try {
        window.sharedData.addProduct(productData);
        renderProducts();
        resetForm();
        showToast('Success', 'Product added successfully!', 'success');
    } catch (error) {
        showToast('Error', 'Failed to add product: ' + error.message, 'error');
    }
}

function editProduct(id) {
    const product = window.sharedData.getProductById(id);
    if (!product) {
        showToast('Error', 'Product not found', 'error');
        return;
    }
    
    editingProductId = id;
    
    // Set form values
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productStock').value = product.stock;
    
    // Set price based on category
    if (product.category === 'desserts' && product.sizeOptions) {
        document.getElementById('priceLarge').value = product.sizeOptions.L || '';
        document.getElementById('priceMedium').value = product.sizeOptions.M || '';
    } else {
        document.getElementById('productPrice').value = product.price || '';
    }
    
    // Set image preview
    currentImage = product.image;
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `
        <img src="${product.image}" alt="Preview" onerror="this.src='/static/orders_menupics/default_food.png'">
        <button type="button" class="remove-image" onclick="removeImage()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Show update and cancel buttons
    document.getElementById('addProduct').style.display = 'none';
    document.getElementById('updateProduct').style.display = 'inline-block';
    document.getElementById('cancelEdit').style.display = 'inline-block';
    
    // Ensure size options are shown/hidden correctly
    toggleSizeOptions(product.category);
    
    showToast('Edit Mode', 'Product loaded for editing', 'info');
}

function updateProduct() {
    if (editingProductId === null) return;
    
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const stock = document.getElementById('productStock').value;
    
    let priceData;
    
    if (category === 'desserts') {
        const priceLarge = document.getElementById('priceLarge').value;
        const priceMedium = document.getElementById('priceMedium').value;
        
        if (!priceLarge || !priceMedium) {
            showToast('Missing Information', 'Please fill in both size prices for desserts', 'error');
            return;
        }
        
        priceData = {
            price: parseFloat(priceLarge),
            sizeOptions: {
                "L": parseFloat(priceLarge),
                "M": parseFloat(priceMedium)
            }
        };
    } else {
        const singlePrice = document.getElementById('productPrice').value;
        if (!singlePrice) {
            showToast('Missing Information', 'Please fill in the product price', 'error');
            return;
        }
        priceData = {
            price: parseFloat(singlePrice),
            sizeOptions: null
        };
    }
    
    if (!name || !category || !stock) {
        showToast('Missing Information', 'Please fill in all fields', 'error');
        return;
    }
    
    if (stock < 0) {
        showToast('Invalid Values', 'Stock cannot be negative', 'error');
        return;
    }
    
    const updatedProduct = {
        name: name,
        category: category,
        stock: parseInt(stock),
        ...priceData,
        image: currentImage // Keep current image or use the existing one from edit
    };
    
    try {
        window.sharedData.updateProduct(editingProductId, updatedProduct);
        renderProducts();
        resetForm();
        showToast('Success', 'Product updated successfully!', 'success');
    } catch (error) {
        showToast('Error', 'Failed to update product: ' + error.message, 'error');
    }
}

function deleteProduct(id) {
    const product = window.sharedData.getProductById(id);
    if (!product) return;
    
    showToast(
        'Confirm Delete', 
        `Are you sure you want to delete "${product.name}"?`, 
        'warning', 
        0,
        [
            {
                text: 'Cancel',
                action: () => console.log('Delete cancelled')
            },
            {
                text: 'Delete',
                action: () => {
                    try {
                        window.sharedData.deleteProduct(id);
                        renderProducts();
                        showToast('Success', 'Product deleted successfully!', 'success');
                    } catch (error) {
                        showToast('Error', 'Failed to delete product: ' + error.message, 'error');
                    }
                }
            }
        ]
    );
}

function resetForm() {
    document.getElementById('productName').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('priceLarge').value = '';
    document.getElementById('priceMedium').value = '';
    
    document.getElementById('addProduct').style.display = 'inline-block';
    document.getElementById('updateProduct').style.display = 'none';
    document.getElementById('cancelEdit').style.display = 'none';
    
    // Reset to default size options state
    toggleSizeOptions('');
    
    editingProductId = null;
    currentImage = null;
    removeImage();
}

function cancelEdit() {
    resetForm();
    showToast('Edit Cancelled', 'Product editing has been cancelled', 'info');
}

// Order Management Functions
function renderOrders() {
    const ordersTable = document.querySelector('#orders .orders-table tbody');
    const totalOrdersCount = document.getElementById('totalOrdersCount');
    const orders = window.sharedData.getOrders();
    
    if (totalOrdersCount) {
        totalOrdersCount.textContent = `${orders.length} Total Orders`;
    }
    
    if (ordersTable) {
        ordersTable.innerHTML = '';
        
        if (orders.length === 0) {
            ordersTable.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                        <i class="fas fa-shopping-cart" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>No orders yet. Orders will appear here when customers place them.</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Sort orders by timestamp (newest first)
        const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        sortedOrders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            const formattedDate = orderDate.toLocaleDateString();
            const formattedTime = orderDate.toLocaleTimeString();
            
            const itemsText = order.items 
                ? order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')
                : 'No items';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.orderNumber || order.id}</td>
                <td>${order.customerName || 'Walk-in Customer'}</td>
                <td>${itemsText}</td>
                <td>₱${order.totalAmount || 0}</td>
                <td>
                    <span class="status-badge status-${order.status || 'pending'}">
                        ${(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                    </span>
                </td>
                <td>${formattedDate}</td>
                <td>${formattedTime}</td>
                <td>
                    <button class="btn-edit" onclick="updateOrderStatus(${order.id}, 'completed')">Complete</button>
                    <button class="btn-delete" onclick="deleteOrder(${order.id})">Delete</button>
                </td>
            `;
            ordersTable.appendChild(row);
        });
    }
}

function updateOrderStatus(orderId, status) {
    try {
        window.sharedData.updateOrderStatus(orderId, status);
        renderOrders();
        updateDashboardMetrics();
        showToast('Success', `Order marked as ${status}`, 'success');
    } catch (error) {
        showToast('Error', 'Failed to update order status: ' + error.message, 'error');
    }
}

function deleteOrder(orderId) {
    showToast(
        'Confirm Delete', 
        'Are you sure you want to delete this order?', 
        'warning', 
        0,
        [
            {
                text: 'Cancel',
                action: () => console.log('Order deletion cancelled')
            },
            {
                text: 'Delete',
                action: () => {
                    try {
                        window.sharedData.deleteOrder(orderId);
                        renderOrders();
                        updateDashboardMetrics();
                        showToast('Success', 'Order deleted successfully!', 'success');
                    } catch (error) {
                        showToast('Error', 'Failed to delete order: ' + error.message, 'error');
                    }
                }
            }
        ]
    );
}

// Dashboard Metrics
function updateDashboardMetrics() {
    const totalSales = document.getElementById('totalSales');
    const totalProducts = document.getElementById('totalProducts');
    const pendingOrders = document.getElementById('pendingOrders');
    const recentOrdersCount = document.getElementById('recentOrdersCount');
    
    const orders = window.sharedData.getOrders();
    const products = window.sharedData.getProducts();
    const pendingOrdersCount = window.sharedData.getPendingOrdersCount();
    const totalRevenue = window.sharedData.getTotalSales();
    
    if (totalSales) totalSales.textContent = `₱${totalRevenue.toLocaleString()}`;
    if (totalProducts) totalProducts.textContent = products.length;
    if (pendingOrders) pendingOrders.textContent = `${pendingOrdersCount} Pending`;
    if (recentOrdersCount) {
        const todayOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            const today = new Date();
            return orderDate.toDateString() === today.toDateString();
        }).length;
        recentOrdersCount.textContent = `${todayOrders} New Orders Today`;
    }
    
    // Update top products and low stock
    updateTopProducts();
    updateLowStock();
}

function updateTopProducts() {
    const topProductsContainer = document.getElementById('topProducts');
    if (!topProductsContainer) return;
    
    const products = window.sharedData.getTopSellingProducts(3);
    
    topProductsContainer.innerHTML = '';
    products.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'product-item';
        productItem.innerHTML = `
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}" 
                     onerror="this.src='/static/orders_menupics/default_food.png'" 
                     style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
            </div>
            <div class="product-details">
                <div class="product-name">${product.name}</div>
                <div class="product-info">${formatCategory(product.category)}</div>
            </div>
            <div class="product-stock">Stock: ${product.stock}</div>
        `;
        topProductsContainer.appendChild(productItem);
    });
}

function updateLowStock() {
    const stockInventory = document.getElementById('stockInventory');
    if (!stockInventory) return;
    
    const lowStockProducts = window.sharedData.getLowStockProducts(5);
    
    stockInventory.innerHTML = '';
    if (lowStockProducts.length === 0) {
        stockInventory.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">All products have sufficient stock</div>';
        return;
    }
    
    lowStockProducts.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'product-item';
        productItem.innerHTML = `
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}" 
                     onerror="this.src='/static/orders_menupics/default_food.png'" 
                     style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
            </div>
            <div class="product-details">
                <div class="product-name">${product.name}</div>
                <div class="product-info">${formatCategory(product.category)}</div>
            </div>
            <div class="product-stock" style="color: #F44336;">${product.stock} left</div>
        `;
        stockInventory.appendChild(productItem);
    });
}

// Toast Notification System (keep your existing toast system)
function showToast(title, message, type = 'info', duration = 3000, actions = []) {
    // ... (keep your existing toast implementation)
    // This is the same as your previous implementation
}

function removeToast(toast) {
    toast.remove();
}

function clearAllToasts() {
    const toastContainer = document.querySelector('.toast-container');
    if (toastContainer) {
        toastContainer.innerHTML = '';
    }
}

function handleLogin(username, password) {
    // Your existing login logic...
    
    // Check if it's an admin account
    const adminAccounts = [
        { username: "admin", password: "admin123" },
        { username: "julie", password: "motherjulie" }
    ];
    
    const isAdmin = adminAccounts.some(admin => 
        admin.username === username && admin.password === password
    );
    
    if (isAdmin) {
        // Set admin session and redirect to admin dashboard
        localStorage.setItem('adminLoggedIn', 'true');
        window.location.href = '/admin_dashboard/'; // Adjust path as needed
    } else {
        // Regular user login
        // Your existing user login logic...
    }
}

// In the logout function - update the redirect path:
setTimeout(() => {
    window.location.href = 'signin.html'; // Changed from '/login/'
}, 1500);