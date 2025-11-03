// Order Management System
let cart = [];
let orderCount = 0;
const deliveryCharge = 50;
let selectedPaymentMethod = 'cash';
let selectedBank = 'bpi';

// DOM Elements
const elements = {
    ordersButton: document.getElementById('ordersButton'),
    billingPanel: document.getElementById('billingPanel'),
    billingClose: document.getElementById('billingClose'),
    billingItems: document.getElementById('billingItems'),
    locationModal: document.getElementById('locationModal'),
    modalClose: document.getElementById('modalClose'),
    toastContainer: null
};

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'success', duration = 3000, orderDetails = null) {
    // Create or get toast container
    if (!elements.toastContainer) {
        elements.toastContainer = document.createElement('div');
        elements.toastContainer.id = 'toastContainer';
        elements.toastContainer.style.cssText = `
            position: fixed;
            top: 120px;
            left: 48%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            pointer-events: none;
            width: 100%;
        `;
        document.body.appendChild(elements.toastContainer);
    }

    // Remove existing toast if any
    const existingToast = elements.toastContainer.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    
    if (orderDetails) {
        toast.className = `toast order-success`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">✓</div>
                <div class="toast-message">
                    <h4>Order Successful!</h4>
                    <p>Your order has been placed successfully</p>
                    <div class="order-details-toast">
                        <p><strong>Type:</strong> ${orderDetails.orderType}</p>
                        <p><strong>Payment:</strong> ${orderDetails.paymentMethod}</p>
                        <p><strong>Total:</strong> ${orderDetails.total}</p>
                    </div>
                </div>
            </div>
        `;
    } else {
        toast.className = `toast ${type}`;
        toast.textContent = message;
    }

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 50);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

function showAddToCartToast(itemName) {
    showToast(`✓ ${itemName} added to cart!`, 'success', 2000);
}

function showOrderSuccessToast(orderDetails) {
    showToast('', 'success', 5000, orderDetails);
}

// ========== PAYMENT METHOD RESTRICTIONS ==========
function updatePaymentMethodsBasedOnOrderType() {
    const orderType = document.querySelector('.order-btn.active').textContent;
    const cashPaymentBtn = document.querySelector('.payment-btn.cash');
    const paymentMethodSection = document.querySelector('.payment-method');
    
    const existingMessages = paymentMethodSection.querySelectorAll('.disclaimer-box');
    existingMessages.forEach(message => message.remove());
    
    if (orderType === 'Pickup' || orderType === 'Delivery') {
        cashPaymentBtn.classList.add('disabled');
        cashPaymentBtn.disabled = true;
        
        const message = document.createElement('div');
        message.className = 'disclaimer-box warning';
        message.innerHTML = `<strong>Payment Notice:</strong> Online payment (GCash or Bank Transfer) is required for ${orderType.toLowerCase()} orders. Cash payment is only available for dine-in orders.`;
        paymentMethodSection.appendChild(message);
        
        if (selectedPaymentMethod === 'cash') {
            selectPaymentMethod('gcash');
        }
    } else {
        cashPaymentBtn.classList.remove('disabled');
        cashPaymentBtn.disabled = false;
        
        const message = document.createElement('div');
        message.className = 'disclaimer-box info';
        message.innerHTML = `<strong>Payment Notice:</strong> Cash payment is available for dine-in orders.`;
        paymentMethodSection.appendChild(message);
    }
}

// ========== LOCATION FUNCTIONS ==========
function initializeLocationModal() {
    const locationModal = document.getElementById('locationModal');
    const locationInput = document.getElementById('locationInput');
    const searchBtn = document.getElementById('searchBtn');
    const suggestions = document.getElementById('suggestions');
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    const locationError = document.getElementById('locationError');

    const metroManilaLocations = [
        "Manila", "Quezon City", "Makati", "Taguig", "Pasig", 
        "Mandaluyong", "San Juan", "Pasay", "Parañaque", 
        "Las Piñas", "Muntinlupa", "Marikina", "Caloocan", 
        "Valenzuela", "Malabon", "Navotas"
    ];

    document.querySelector('.location-search').addEventListener('click', () => {
        locationModal.style.display = 'flex';
        locationInput.focus();
    });

    elements.modalClose.addEventListener('click', () => {
        locationModal.style.display = 'none';
        clearError();
    });

    locationModal.addEventListener('click', (e) => {
        if (e.target === locationModal) {
            locationModal.style.display = 'none';
            clearError();
        }
    });

    function searchLocations() {
        const query = locationInput.value.toLowerCase().trim();
        suggestions.innerHTML = '';
        
        if (query.length === 0) return;
        
        const filtered = metroManilaLocations.filter(location => 
            location.toLowerCase().includes(query)
        );
        
        if (filtered.length === 0) {
            suggestions.innerHTML = '<div class="suggestion-item">No locations found in Metro Manila</div>';
            return;
        }
        
        filtered.forEach(location => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = location;
            div.addEventListener('click', () => selectLocation(location));
            suggestions.appendChild(div);
        });
    }

    function selectLocation(location) {
        document.querySelector('.location .loc-text').textContent = location;
        locationModal.style.display = 'none';
        locationInput.value = '';
        suggestions.innerHTML = '';
        clearError();
        showToast(`Location set to ${location}`, 'success');
    }

    currentLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'error');
            return;
        }
        
        currentLocationBtn.textContent = '📍 Getting Location...';
        currentLocationBtn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                if (isInMetroManila(lat, lng)) {
                    const city = getNearestCity(lat, lng);
                    document.querySelector('.location .loc-text').textContent = city;
                    locationModal.style.display = 'none';
                    clearError();
                    showToast(`Location set to ${city} using GPS`, 'success');
                } else {
                    showToast('Location outside Metro Manila. Please search for Metro Manila locations only.', 'error');
                }
                
                currentLocationBtn.textContent = '📍 Use Current Location';
                currentLocationBtn.disabled = false;
            },
            (error) => {
                showToast('Unable to retrieve your location. Please search manually.', 'error');
                currentLocationBtn.textContent = '📍 Use Current Location';
                currentLocationBtn.disabled = false;
            }
        );
    });

    function isInMetroManila(lat, lng) {
        const metroBounds = { 
            north: 14.85,
            south: 14.35,
            west: 120.90,
            east: 121.20
        };
        return lat >= metroBounds.south && lat <= metroBounds.north && 
               lng >= metroBounds.west && lng <= metroBounds.east;
    }

    function getNearestCity(lat, lng) {
        if (lat >= 14.50 && lat <= 14.70 && lng >= 120.90 && lng <= 121.10) {
            if (lat >= 14.55 && lat <= 14.68 && lng >= 120.95 && lng <= 121.05) {
                return "Manila";
            }
            if (lat > 14.65 && lng > 121.03) {
                return "Quezon City";
            }
            if (lat > 14.63 && lng > 121.08) {
                return "Marikina";
            }
            return "Manila";
        }
        
        const cities = [
            { name: "Manila", lat: 14.5995, lng: 120.9842, priority: 1.2 },
            { name: "Quezon City", lat: 14.6760, lng: 121.0437 },
            { name: "Makati", lat: 14.5547, lng: 121.0244 },
            { name: "Taguig", lat: 14.5176, lng: 121.0509 },
            { name: "Pasig", lat: 14.5764, lng: 121.0851 },
            { name: "Mandaluyong", lat: 14.5794, lng: 121.0359 },
            { name: "San Juan", lat: 14.6019, lng: 121.0355 },
            { name: "Pasay", lat: 14.5378, lng: 121.0014 },
            { name: "Parañaque", lat: 14.4793, lng: 121.0198 },
            { name: "Las Piñas", lat: 14.4446, lng: 120.9936 },
            { name: "Muntinlupa", lat: 14.4081, lng: 121.0405 },
            { name: "Marikina", lat: 14.6507, lng: 121.1029 },
            { name: "Caloocan", lat: 14.6542, lng: 120.9829 },
            { name: "Valenzuela", lat: 14.7004, lng: 120.9830 },
            { name: "Malabon", lat: 14.6626, lng: 120.9562 },
            { name: "Navotas", lat: 14.6661, lng: 120.9440 }
        ];

        let closestCity = cities[0];
        let shortestDistance = calculateDistance(lat, lng, cities[0].lat, cities[0].lng) * (cities[0].priority || 1);

        for (let i = 1; i < cities.length; i++) {
            const priority = cities[i].priority || 1;
            const distance = calculateDistance(lat, lng, cities[i].lat, cities[i].lng) * priority;
            if (distance < shortestDistance) {
                shortestDistance = distance;
                closestCity = cities[i];
            }
        }

        return closestCity.name;
    }

    function calculateDistance(lat1, lng1, lat2, lng2) {
        const latDiff = lat1 - lat2;
        const lngDiff = lng1 - lng2;
        return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    }

    function showError(message) {
        locationError.textContent = message;
        locationError.style.display = 'block';
    }

    function clearError() {
        locationError.style.display = 'none';
    }

    searchBtn.addEventListener('click', searchLocations);
    locationInput.addEventListener('input', searchLocations);
    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchLocations();
    });
}

// ========== PAYMENT FUNCTIONS ==========
function initializePaymentMethods() {
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!this.disabled) {
                const method = this.getAttribute('data-method');
                selectPaymentMethod(method);
            }
        });
    });

    document.querySelectorAll('.bank-option').forEach(option => {
        option.addEventListener('click', function() {
            const bank = this.getAttribute('data-bank');
            selectBank(bank);
        });
    });

    const verifyGCashBtn = document.getElementById('verifyGCash');
    if (verifyGCashBtn) {
        verifyGCashBtn.addEventListener('click', verifyGCashPayment);
    }
    
    const verifyBankBtn = document.getElementById('verifyBank');
    if (verifyBankBtn) {
        verifyBankBtn.addEventListener('click', verifyBankPayment);
    }
    
    selectPaymentMethod('cash');
    selectBank('bpi');
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`.payment-btn[data-method="${method}"]`);
    if (activeBtn && !activeBtn.disabled) {
        activeBtn.classList.add('active');
    }
    
    updatePaymentForms();
}

function selectBank(bank) {
    selectedBank = bank;
    
    document.querySelectorAll('.bank-option').forEach(option => {
        option.classList.remove('active');
    });
    
    const activeOption = document.querySelector(`.bank-option[data-bank="${bank}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }
    
    document.querySelectorAll('.bank-info').forEach(info => {
        info.style.display = 'none';
    });
    
    const activeInfo = document.querySelector(`.bank-info[data-bank="${bank}"]`);
    if (activeInfo) {
        activeInfo.style.display = 'block';
    }
}

function updatePaymentForms() {
    document.querySelectorAll('.payment-note, .payment-form').forEach(element => {
        element.classList.remove('active');
    });
    
    switch(selectedPaymentMethod) {
        case 'cash':
            document.querySelector('.cash-note').classList.add('active');
            break;
        case 'gcash':
            document.querySelector('.gcash-form').classList.add('active');
            updateGCashAmount();
            break;
        case 'bank':
            document.querySelector('.bank-form').classList.add('active');
            break;
    }
}

function updateGCashAmount() {
    const totalElement = document.querySelector('.total');
    const gcashAmount = document.getElementById('gcashAmount');
    
    if (totalElement && gcashAmount) {
        gcashAmount.textContent = totalElement.textContent;
    }
}

function verifyGCashPayment() {
    const gcashNumber = document.getElementById('gcashNumber')?.value.trim();
    const gcashName = document.getElementById('gcashName')?.value.trim();
    
    if (!gcashNumber || !gcashName) {
        showToast('Please fill in all GCash details', 'error');
        return;
    }
    
    if (!/^09\d{9}$/.test(gcashNumber)) {
        showToast('Please enter a valid GCash mobile number (09XXXXXXXXX)', 'error');
        return;
    }
    
    showToast('Verifying GCash payment...', 'info');
    
    setTimeout(() => {
        showToast('GCash payment verified successfully!', 'success');
    }, 2000);
}

function verifyBankPayment() {
    const referenceNumber = document.getElementById('referenceNumber')?.value.trim();
    const senderName = document.getElementById('senderName')?.value.trim();
    
    if (!referenceNumber || !senderName) {
        showToast('Please fill in all bank transfer details', 'error');
        return;
    }
    
    if (referenceNumber.length < 6) {
        showToast('Please enter a valid reference number', 'error');
        return;
    }
    
    showToast('Verifying bank transfer...', 'info');
    
    setTimeout(() => {
        showToast('Bank transfer verified successfully!', 'success');
    }, 2000);
}

// ========== CART FUNCTIONS ==========
function addToCart(cardElement) {
    const itemName = cardElement.querySelector('h3').textContent;
    const itemImage = cardElement.querySelector('img').src;

    let selectedSize = '';
    let price = 0;
    
    const sizeRadios = cardElement.querySelectorAll('input[type="radio"]');
    if (sizeRadios.length > 0) {
        const selectedRadio = Array.from(sizeRadios).find(radio => radio.checked);
        if (selectedRadio) {
            selectedSize = selectedRadio.value;
            const priceText = cardElement.querySelector('.price').textContent;
            const sizePriceMatch = priceText.match(new RegExp(`Php\\s*(\\d+)\\s*\\(${selectedSize}\\)`));
            price = sizePriceMatch ? parseInt(sizePriceMatch[1]) : 0;
        } else {
            showToast('Please select a size', 'error');
            return;
        }
    } else {
        const priceText = cardElement.querySelector('.price').textContent;
        const priceMatch = priceText.match(/Php\s*(\d+)/);
        price = priceMatch ? parseInt(priceMatch[1]) : 0;
    }
    
    const existingItemIndex = cart.findIndex(item => 
        item.name === itemName && item.size === selectedSize
    );
    
    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += 1;
    } else {
        cart.push({
            name: itemName,
            image: itemImage,
            size: selectedSize,
            price: price,
            quantity: 1
        });
    }
    
    orderCount += 1;
    updateOrdersCount();
    updateBillingPanel();
    
    showAddToCartToast(itemName);
}

function updateQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        
        if (cart[index].quantity <= 0) {
            removeFromCart(index);
        } else {
            orderCount += change;
            updateOrdersCount();
            updateBillingPanel();
        }
    }
}

function removeFromCart(index) {
    if (cart[index]) {
        orderCount -= cart[index].quantity;
        cart.splice(index, 1);
        
        if (cart.length === 0) orderCount = 0;
        
        updateOrdersCount();
        updateBillingPanel();
        showToast('Item removed from cart', 'warning');
    }
}

function updateOrdersCount() {
    const ordersCountElement = document.querySelector('.orders-count');
    if (ordersCountElement) {
        ordersCountElement.textContent = orderCount;
    }
}

// ========== BILLING PANEL FUNCTIONS ==========
function toggleBillingPanel(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (!elements.billingPanel.classList.contains('open')) {
        elements.billingPanel.classList.add('open');
        elements.ordersButton.classList.add('hidden');
        updateBillingPanel();
    }
}

function closeBillingPanel() {
    elements.billingPanel.classList.remove('open');
    elements.ordersButton.classList.remove('hidden');
}

function updateBillingPanel() {
    if (!elements.billingPanel.classList.contains('open')) return;
    
    const subtotalElement = document.querySelector('.subtotal');
    const totalElement = document.querySelector('.total');
    const deliveryFeeRow = document.querySelector('.delivery-fee-row');
    const orderType = document.querySelector('.order-btn.active').textContent;
    
    elements.billingItems.innerHTML = '';
    
    if (orderType === 'Delivery') {
        deliveryFeeRow.style.display = 'flex';
    } else {
        deliveryFeeRow.style.display = 'none';
    }
    
    if (cart.length === 0) {
        elements.billingItems.innerHTML = `
            <div class="empty-cart-message">
                <div class="empty-icon">🛒</div>
                <p>No items in cart</p>
                <small>Add some delicious items to get started!</small>
            </div>
        `;
        subtotalElement.textContent = 'Php 0.00';
        const total = orderType === 'Delivery' ? deliveryCharge : 0;
        totalElement.textContent = `Php ${total.toFixed(2)}`;
        return;
    }
    
    let subtotal = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'billing-item';
        itemElement.innerHTML = `
            <div class="item-info">
                <div class="item-name">${item.name} ${item.size ? `(${item.size})` : ''}</div>
                <div class="item-price">Php ${item.price.toFixed(2)} each</div>
            </div>
            <div class="item-controls">
                <button class="quantity-btn minus" data-index="${index}" data-change="-1">-</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-btn plus" data-index="${index}" data-change="1">+</button>
                <button class="remove-btn" data-index="${index}">✕</button>
            </div>
        `;
        elements.billingItems.appendChild(itemElement);
    });
    
    const fee = orderType === 'Delivery' ? deliveryCharge : 0;
    const total = subtotal + fee;
    
    subtotalElement.textContent = `Php ${subtotal.toFixed(2)}`;
    totalElement.textContent = `Php ${total.toFixed(2)}`;
    
    // Add event listeners to the new quantity buttons
    initializeBillingPanelEvents();
}

// ========== BILLING PANEL EVENT HANDLERS ==========
function initializeBillingPanelEvents() {
    // Remove any existing event listeners first to prevent duplicates
    const newBillingItems = elements.billingItems.cloneNode(true);
    elements.billingItems.parentNode.replaceChild(newBillingItems, elements.billingItems);
    elements.billingItems = newBillingItems;
    
    // Add event delegation for quantity buttons and remove buttons
    elements.billingItems.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent event from bubbling up
        
        const target = e.target;
        
        // Handle quantity buttons
        if (target.classList.contains('quantity-btn')) {
            const index = parseInt(target.getAttribute('data-index'));
            const change = parseInt(target.getAttribute('data-change'));
            updateQuantity(index, change);
        }
        
        // Handle remove buttons
        if (target.classList.contains('remove-btn')) {
            const index = parseInt(target.getAttribute('data-index'));
            removeFromCart(index);
        }
    });
}

// Update your updateQuantity and removeFromCart functions to remove the onclick attributes
function updateQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        
        if (cart[index].quantity <= 0) {
            removeFromCart(index);
        } else {
            orderCount += change;
            updateOrdersCount();
            updateBillingPanel(); // This will re-render the panel
        }
    }
}

function removeFromCart(index) {
    if (cart[index]) {
        orderCount -= cart[index].quantity;
        cart.splice(index, 1);
        
        if (cart.length === 0) orderCount = 0;
        
        updateOrdersCount();
        updateBillingPanel(); // This will re-render the panel
        showToast('Item removed from cart', 'warning');
    }
}

// ========== ORDER PROCESSING ==========
function processOrder() {
    if (cart.length === 0) {
        showToast('Your cart is empty!', 'error');
        return;
    }
    
    const orderType = document.querySelector('.order-btn.active').textContent;
    const total = document.querySelector('.total').textContent;
    
    let paymentDetails = '';
    if (selectedPaymentMethod === 'gcash') {
        const gcashNumber = document.getElementById('gcashNumber')?.value || '';
        paymentDetails = `GCash: ${gcashNumber}`;
    } else if (selectedPaymentMethod === 'bank') {
        const bank = selectedBank.toUpperCase();
        const reference = document.getElementById('referenceNumber')?.value || '';
        paymentDetails = `Bank: ${bank}, Ref: ${reference}`;
    } else {
        paymentDetails = 'Cash';
    }
    
    const orderDetails = {
        orderType: orderType,
        paymentMethod: selectedPaymentMethod,
        total: total
    };
    
    showOrderSuccessToast(orderDetails);
    
    cart = [];
    orderCount = 0;
    updateOrdersCount();
    updateBillingPanel();
    closeBillingPanel();
}

// ========== SIDEBAR NAVIGATION ==========
function initializeSidebarNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const categories = document.querySelectorAll('.category');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            
            // Remove active class from all nav items
            navItems.forEach(navItem => navItem.classList.remove('active'));
            
            // Add active class to clicked nav item
            this.classList.add('active');
            
            // Hide all categories
            categories.forEach(category => category.classList.remove('active'));
            
            // Show target category
            const targetCategory = document.getElementById(targetId);
            if (targetCategory) {
                targetCategory.classList.add('active');
                
                // Update header logo and title
                updateHeaderForCategory(targetId);
                
                // If it's a specific category (not "all"), populate it
                if (targetId !== 'all') {
                    populateCategory(targetId);
                }
            }
        });
    });
}

// ========== UPDATE HEADER LOGO AND TITLE ==========
function updateHeaderForCategory(categoryId) {
    const titleLogo = document.getElementById('titleLogo');
    const pageTitle = document.getElementById('pageTitle');
    
    // Map category IDs to their respective logos and titles
    const categoryData = {
        'all': {
            logo: STATIC_URLS.menu,
            title: 'ALL MENU'
        },
        'desserts': {
            logo: STATIC_URLS.dessert,
            title: 'DESSERTS'
        },
        'spuds': {
            logo: STATIC_URLS.spud,
            title: 'SPUDS'
        },
        'pasta': {
            logo: STATIC_URLS.pasta,
            title: 'PASTA / BREAD'
        },
        'wrap': {
            logo: STATIC_URLS.wrap,
            title: 'WRAP'
        },
        'appetizers': {
            logo: STATIC_URLS.nachos,
            title: 'APPETIZERS'
        }
    };
    
    const category = categoryData[categoryId];
    if (category) {
        titleLogo.src = category.logo;
        titleLogo.alt = category.title;
        pageTitle.textContent = category.title;
    }
}

// ========== SIDEBAR NAVIGATION ==========
function initializeSidebarNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const categories = document.querySelectorAll('.category');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            
            // Remove active class from all nav items
            navItems.forEach(navItem => navItem.classList.remove('active'));
            
            // Add active class to clicked nav item
            this.classList.add('active');
            
            // Hide all categories
            categories.forEach(category => category.classList.remove('active'));
            
            // Show target category
            const targetCategory = document.getElementById(targetId);
            if (targetCategory) {
                targetCategory.classList.add('active');
                
                // Update header logo and title
                updateHeaderForCategory(targetId);
                
                // If it's a specific category (not "all"), populate it
                if (targetId !== 'all') {
                    populateCategory(targetId);
                }
            }
        });
    });
}

function populateCategory(categoryId) {
    const categoryGrid = document.getElementById(categoryId + 'CategoryGrid');
    
    if (!categoryGrid) return;
    
    categoryGrid.innerHTML = '';
    
    const categoryItems = getCategoryItems(categoryId);
    
    categoryItems.forEach(item => {
        const card = createMenuItemCard(item);
        categoryGrid.appendChild(card);
    });
}

function getCategoryItems(categoryId) {
    const menuData = {
        desserts: [
            {
                name: "Mais Con Yelo",
                image: STATIC_URLS.maisConYelo,
                price: "Php 110 (M) • Php 130 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 110, checked: true },
                    { value: "L", price: 130, checked: false }
                ]
            },
            {
                name: "Biscoff Classic",
                image: STATIC_URLS.biscoffClassic,
                price: "Php 175 (M) • Php 200 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 175, checked: true },
                    { value: "L", price: 200, checked: false }
                ]
            },
            {
                name: "Buko Pandan",
                image: STATIC_URLS.bukoPandan,
                price: "Php 100 (M) • Php 120 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 100, checked: true },
                    { value: "L", price: 120, checked: false }
                ]
            },
            {
                name: "Mango Graham",
                image: STATIC_URLS.mangoGraham,
                price: "Php 150 (M) • Php 180 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 150, checked: true },
                    { value: "L", price: 180, checked: false }
                ]
            },
            {
                name: "Ube Macapuno",
                image: STATIC_URLS.ubeMacapuno,
                price: "Php 130 (M) • Php 160 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 130, checked: true },
                    { value: "L", price: 160, checked: false }
                ]
            },
            {
                name: "Rocky Road",
                image: STATIC_URLS.rockyRoad,
                price: "Php 140 (M) • Php 170 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 140, checked: true },
                    { value: "L", price: 170, checked: false }
                ]
            },
            {
                name: "Coffee Jelly",
                image: STATIC_URLS.coffeeJelly,
                price: "Php 115 (M) • Php 140 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 115, checked: true },
                    { value: "L", price: 140, checked: false }
                ]
            },
            {
                name: "Cookie Monster",
                image: STATIC_URLS.cookieMonster,
                price: "Php 160 (M) • Php 190 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 160, checked: true },
                    { value: "L", price: 190, checked: false }
                ]
            }
        ],
        spuds: [
            {
                name: "Cheesy Bacon",
                image: STATIC_URLS.cheesyBacon,
                price: "Php 159",
                hasSizes: false
            },
            {
                name: "Chili Con Carne",
                image: STATIC_URLS.chiliConCarne,
                price: "Php 179",
                hasSizes: false
            }
        ],
        pasta: [
            {
                name: "Lasagna",
                image: STATIC_URLS.lasagna,
                price: "Php 250",
                hasSizes: false
            },
            {
                name: "Garlic Bread",
                image: STATIC_URLS.garlicBread,
                price: "Php 99",
                hasSizes: false
            }
        ],
        wrap: [
            {
                name: "Chicken Wrap",
                image: STATIC_URLS.chickenWrap,
                price: "Php 169",
                hasSizes: false
            },
            {
                name: "Veggie Wrap",
                image: STATIC_URLS.veggieWrap,
                price: "Php 139",
                hasSizes: false
            }
        ],
        appetizers: [
            {
                name: "Chicken Poppers",
                image: STATIC_URLS.chickenPoppers,
                price: "Php 149",
                hasSizes: false
            }
        ]
    };
    
    return menuData[categoryId] || [];
}

function createMenuItemCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    
    let sizesHtml = '';
    if (item.hasSizes) {
        sizesHtml = `
            <div class="size-select">
                ${item.sizes.map((size, index) => `
                    <label>
                        <input type="radio" name="${item.name.toLowerCase().replace(/\s+/g, '-')}-size" 
                               value="${size.value}" ${size.checked ? 'checked' : ''}>
                        ${size.value}
                    </label>
                `).join('')}
            </div>
        `;
    }
    
    card.innerHTML = `
        <img src="${item.image}" alt="${item.name}">
        <div class="card-body">
            <h3>${item.name}</h3>
            <div class="availability">Available</div>
            ${sizesHtml}
            <div class="price">${item.price}</div>
        </div>
        <button class="add-to-cart" data-item-id="${item.name.toLowerCase().replace(/\s+/g, '-')}">
            <img src="${STATIC_URLS.addToCart}" alt="Add to Cart" class="cart-icon">
        </button>
    `;
    
    return card;
}

// ========== EVENT DELEGATION FOR ADD TO CART ==========
function initializeAddToCartDelegation() {
    // Use event delegation on the document level
    document.addEventListener('click', function(e) {
        const addToCartBtn = e.target.closest('.add-to-cart');
        if (addToCartBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const card = addToCartBtn.closest('.card');
            if (card) {
                addToCart(card);
            }
        }
    });
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeLocationModal();
    initializePaymentMethods();
    initializeSidebarNavigation();
    initializeAddToCartDelegation(); // ONLY this handles add to cart

    // Orders button
    if (elements.ordersButton) {
        elements.ordersButton.addEventListener('click', toggleBillingPanel);
    }
    
    // Billing panel close
    elements.billingClose.addEventListener('click', function(e) {
        e.stopPropagation();
        closeBillingPanel();
    });

    // Close billing panel when clicking outside
// Close billing panel when clicking outside (but not on quantity/remove buttons)
    document.addEventListener('click', function(e) {
        if (elements.billingPanel.classList.contains('open') && 
        !elements.billingPanel.contains(e.target) && 
        e.target !== elements.ordersButton &&
        !e.target.closest('.quantity-btn') && // Add this line
        !e.target.closest('.remove-btn')) {   // Add this line
        closeBillingPanel();
    }
});

    // Order type selection
    document.querySelectorAll('.order-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.order-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            updateBillingPanel();
            updatePaymentMethodsBasedOnOrderType();
        });
    });

    // Process order button
    const processOrderBtn = document.querySelector('.process-order');
    if (processOrderBtn) {
        processOrderBtn.addEventListener('click', processOrder);
    }

    // Set default order type
    document.querySelector('.order-btn[data-type="dine-in"]').classList.add('active');
    
    // Initialize payment restrictions
    updatePaymentMethodsBasedOnOrderType();
});