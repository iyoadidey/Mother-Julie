// shared_data.js - Shared Data Management for Mother Julie Admin Dashboard and Orders Menu

// Shared products data with localStorage persistence
let sharedProducts = JSON.parse(localStorage.getItem('motherJulieProducts')) || [
    { 
        id: 1, 
        name: "Mais Con Yelo", 
        price: 130, 
        category: "desserts", 
        stock: 15,
        image: "/static/orders_menupics/mais_conyelo.png",
        sizeOptions: { "L": 130, "M": 110 }
    },
    { 
        id: 2, 
        name: "Biscoff Classic", 
        price: 200, 
        category: "desserts", 
        stock: 8,
        image: "/static/orders_menupics/biscoff_classic.png",
        sizeOptions: { "L": 200, "M": 175 }
    },
    { 
        id: 3, 
        name: "Buko Pandan", 
        price: 120, 
        category: "desserts", 
        stock: 12,
        image: "/static/orders_menupics/buko_pandan.png",
        sizeOptions: { "L": 120, "M": 100 }
    },
    { 
        id: 4, 
        name: "Cheesy Bacon", 
        price: 159, 
        category: "spuds", 
        stock: 20,
        image: "/static/orders_menupics/cheesy_bacon.png"
    },
    { 
        id: 5, 
        name: "Chili Con Carne", 
        price: 179, 
        category: "spuds", 
        stock: 18,
        image: "/static/orders_menupics/chili_con_carne.png"
    },
    { 
        id: 6, 
        name: "Garlic Bread", 
        price: 90, 
        category: "pasta", 
        stock: 25,
        image: "/static/orders_menupics/garlic_bread.png"
    },
    { 
        id: 7, 
        name: "Chicken Wrap", 
        price: 180, 
        category: "wrap", 
        stock: 15,
        image: "/static/orders_menupics/chicken_wrap.png"
    },
    { 
        id: 8, 
        name: "Mozzarella Sticks", 
        price: 150, 
        category: "appetizers", 
        stock: 22,
        image: "/static/orders_menupics/mozzarella_sticks.png"
    }
];

// Shared orders data with localStorage persistence
let sharedOrders = JSON.parse(localStorage.getItem('motherJulieOrders')) || [];

// ========== DATA PERSISTENCE FUNCTIONS ==========

function saveProducts() {
    try {
        localStorage.setItem('motherJulieProducts', JSON.stringify(sharedProducts));
        console.log('Products saved to localStorage');
    } catch (error) {
        console.error('Error saving products to localStorage:', error);
    }
}

function saveOrders() {
    try {
        localStorage.setItem('motherJulieOrders', JSON.stringify(sharedOrders));
        console.log('Orders saved to localStorage');
    } catch (error) {
        console.error('Error saving orders to localStorage:', error);
    }
}

// ========== PRODUCT MANAGEMENT FUNCTIONS ==========

function getProducts() {
    return [...sharedProducts];
}

function getProductById(id) {
    const product = sharedProducts.find(product => product.id === id);
    return product ? { ...product } : null;
}

function getProductByName(name) {
    const product = sharedProducts.find(product => product.name === name);
    return product ? { ...product } : null;
}

function addProduct(productData) {
    try {
        const newId = sharedProducts.length > 0 ? Math.max(...sharedProducts.map(p => p.id)) + 1 : 1;
        
        let productImage = productData.image;
        if (!productImage || productImage.startsWith('data:')) {
            const defaultImages = {
                'desserts': '/static/orders_menupics/default_dessert.png',
                'spuds': '/static/orders_menupics/default_spud.png',
                'pasta': '/static/orders_menupics/default_pasta.png',
                'wrap': '/static/orders_menupics/default_wrap.png',
                'appetizers': '/static/orders_menupics/default_appetizer.png'
            };
            productImage = defaultImages[productData.category] || '/static/orders_menupics/default_food.png';
        }
        
        const newProduct = { 
            ...productData, 
            id: newId,
            stock: productData.stock || 0,
            image: productImage
        };
        
        sharedProducts.push(newProduct);
        saveProducts();
        dispatchProductUpdateEvent();
        
        console.log('Product added successfully:', newProduct);
        return { ...newProduct };
    } catch (error) {
        console.error('Error adding product:', error);
        throw error;
    }
}

function updateProduct(id, updatedProduct) {
    try {
        const index = sharedProducts.findIndex(p => p.id === id);
        if (index !== -1) {
            const existingImage = sharedProducts[index].image;
            const finalImage = updatedProduct.image && !updatedProduct.image.startsWith('data:') 
                ? updatedProduct.image 
                : existingImage;
            
            sharedProducts[index] = { 
                ...updatedProduct, 
                id: id,
                image: finalImage
            };
            saveProducts();
            dispatchProductUpdateEvent();
            
            console.log('Product updated successfully:', sharedProducts[index]);
            return true;
        }
        console.warn('Product not found for update:', id);
        return false;
    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
}

function deleteProduct(id) {
    try {
        const index = sharedProducts.findIndex(p => p.id === id);
        if (index !== -1) {
            const deletedProduct = sharedProducts.splice(index, 1)[0];
            saveProducts();
            dispatchProductUpdateEvent();
            
            console.log('Product deleted successfully:', deletedProduct);
            return true;
        }
        console.warn('Product not found for deletion:', id);
        return false;
    } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
    }
}

// ========== ORDER MANAGEMENT FUNCTIONS ==========

function getOrders() {
    return [...sharedOrders];
}

function createOrder(orderData) {
    try {
        const newOrder = {
            id: Date.now(),
            ...orderData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'pending',
            orderNumber: generateOrderNumber()
        };
        
        sharedOrders.push(newOrder);
        saveOrders();
        dispatchOrderUpdateEvent();
        
        console.log('Order created successfully:', newOrder);
        return { ...newOrder };
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
}

function updateOrderStatus(orderId, status) {
    try {
        const order = sharedOrders.find(o => o.id === orderId);
        if (order) {
            order.status = status;
            order.updatedAt = new Date().toISOString();
            saveOrders();
            dispatchOrderUpdateEvent();
            
            console.log('Order status updated:', orderId, status);
            return true;
        }
        console.warn('Order not found for status update:', orderId);
        return false;
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
}

function deleteOrder(orderId) {
    try {
        const index = sharedOrders.findIndex(o => o.id === orderId);
        if (index !== -1) {
            const deletedOrder = sharedOrders.splice(index, 1)[0];
            saveOrders();
            dispatchOrderUpdateEvent();
            
            console.log('Order deleted successfully:', deletedOrder);
            return true;
        }
        console.warn('Order not found for deletion:', orderId);
        return false;
    } catch (error) {
        console.error('Error deleting order:', error);
        throw error;
    }
}

// ========== UTILITY FUNCTIONS ==========

function generateOrderNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp.slice(-6)}-${random}`;
}

function getOrdersByStatus(status) {
    return sharedOrders.filter(order => order.status === status);
}

function getPendingOrdersCount() {
    return sharedOrders.filter(order => order.status === 'pending').length;
}

function getTotalSales() {
    return sharedOrders
        .filter(order => order.status === 'completed')
        .reduce((total, order) => total + (order.totalAmount || 0), 0);
}

function getLowStockProducts(threshold = 10) {
    return sharedProducts.filter(product => product.stock <= threshold);
}

function getTopSellingProducts(limit = 5) {
    return [...sharedProducts]
        .sort((a, b) => b.stock - a.stock)
        .slice(0, limit);
}

function getDefaultImageForCategory(category) {
    const defaultImages = {
        'desserts': '/static/orders_menupics/default_dessert.png',
        'spuds': '/static/orders_menupics/default_spud.png',
        'pasta': '/static/orders_menupics/default_pasta.png',
        'wrap': '/static/orders_menupics/default_wrap.png',
        'appetizers': '/static/orders_menupics/default_appetizer.png'
    };
    return defaultImages[category] || '/static/orders_menupics/default_food.png';
}

function isValidImagePath(imagePath) {
    if (!imagePath) return false;
    if (imagePath.startsWith('data:')) return true;
    if (imagePath.startsWith('/static/')) return true;
    if (imagePath.startsWith('http')) return true;
    return false;
}

function validateProduct(productData) {
    const errors = [];
    if (!productData.name?.trim()) errors.push('Product name is required');
    if (!productData.price || productData.price < 0) errors.push('Valid price is required');
    if (!productData.category?.trim()) errors.push('Category is required');
    if (productData.stock === undefined || productData.stock < 0) errors.push('Valid stock quantity is required');
    return errors;
}

function validateOrder(orderData) {
    const errors = [];
    if (!orderData.items?.length) errors.push('Order must contain at least one item');
    if (!orderData.totalAmount || orderData.totalAmount < 0) errors.push('Valid total amount is required');
    return errors;
}

// ========== EVENT SYSTEM ==========

function dispatchProductUpdateEvent() {
    try {
        const event = new CustomEvent('productsUpdated', {
            detail: { products: getProducts() }
        });
        window.dispatchEvent(event);
    } catch (error) {
        console.error('Error dispatching product update event:', error);
    }
}

function dispatchOrderUpdateEvent() {
    try {
        const event = new CustomEvent('ordersUpdated', {
            detail: { orders: getOrders() }
        });
        window.dispatchEvent(event);
    } catch (error) {
        console.error('Error dispatching order update event:', error);
    }
}

// Cross-tab synchronization
window.addEventListener('storage', function(e) {
    if (e.key === 'motherJulieProducts') {
        try {
            sharedProducts = JSON.parse(e.newValue) || [];
            dispatchProductUpdateEvent();
        } catch (error) {
            console.error('Error syncing products from storage event:', error);
        }
    }
    
    if (e.key === 'motherJulieOrders') {
        try {
            sharedOrders = JSON.parse(e.newValue) || [];
            dispatchOrderUpdateEvent();
        } catch (error) {
            console.error('Error syncing orders from storage event:', error);
        }
    }
});

// ========== INITIALIZATION ==========

function initializeData() {
    if (sharedProducts.length === 0) {
        console.log('Initializing sample products data');
        saveProducts();
    }
    
    if (sharedOrders.length === 0) {
        console.log('Initializing empty orders data');
        saveOrders();
    }
}

// Auto-initialize when the script loads
initializeData();

// ========== GLOBAL EXPORTS ==========

window.sharedData = {
    // Product functions
    getProducts,
    getProductById,
    getProductByName,
    addProduct,
    updateProduct,
    deleteProduct,
    
    // Order functions
    getOrders,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    
    // Utility functions
    getOrdersByStatus,
    getPendingOrdersCount,
    getTotalSales,
    getLowStockProducts,
    getTopSellingProducts,
    getDefaultImageForCategory,
    isValidImagePath,
    
    // Validation functions
    validateProduct,
    validateOrder,
    
    // Data (read-only access)
    get products() { return getProducts(); },
    get orders() { return getOrders(); }
};

// Backward compatibility
window.getProducts = getProducts;
window.getProductById = getProductById;
window.createOrder = createOrder;
window.getDefaultImageForCategory = getDefaultImageForCategory;

console.log('Shared data system initialized successfully');