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
function showToast(message, type = 'success', duration = 3000) {
    // Create or get toast container
    if (!elements.toastContainer) {
        elements.toastContainer = document.createElement('div');
        elements.toastContainer.id = 'toastContainer';
        elements.toastContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            pointer-events: none;
        `;
        document.body.appendChild(elements.toastContainer);
    }

    // Remove existing toast if any
    const existingToast = elements.toastContainer.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 50);

    // Auto remove
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

// ========== LOCATION FUNCTIONS ==========
function initializeLocationModal() {
    const locationModal = document.getElementById('locationModal');
    const locationInput = document.getElementById('locationInput');
    const searchBtn = document.getElementById('searchBtn');
    const suggestions = document.getElementById('suggestions');
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    const locationError = document.getElementById('locationError');

    // Metro Manila locations only
    const metroManilaLocations = [
        "Manila", "Quezon City", "Makati", "Taguig", "Pasig", 
        "Mandaluyong", "San Juan", "Pasay", "Parañaque", 
        "Las Piñas", "Muntinlupa", "Marikina", "Caloocan", 
        "Valenzuela", "Malabon", "Navotas"
    ];

    // Open location modal
    document.querySelector('.location-search').addEventListener('click', () => {
        locationModal.style.display = 'flex';
        locationInput.focus();
    });

    // Close modal
    elements.modalClose.addEventListener('click', () => {
        locationModal.style.display = 'none';
        clearError();
    });

    // Close modal when clicking outside
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

    // Current location button
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
        // Metro Manila approximate bounds
        const metroBounds = { 
            north: 14.8, 
            south: 14.3, 
            west: 120.9, 
            east: 121.2 
        };
        return lat >= metroBounds.south && lat <= metroBounds.north && 
               lng >= metroBounds.west && lng <= metroBounds.east;
    }

    function getNearestCity(lat, lng) {
        // Simple approximation for Metro Manila cities
        if (lat > 14.6 && lng > 121.0) return "Pasig";
        if (lat > 14.55 && lng < 121.0) return "Manila";
        if (lat < 14.5) return "Muntinlupa";
        return "Makati";
    }

    function showError(message) {
        locationError.textContent = message;
        locationError.style.display = 'block';
    }

    function clearError() {
        locationError.style.display = 'none';
    }

    // Event listeners for location modal
    searchBtn.addEventListener('click', searchLocations);
    locationInput.addEventListener('input', searchLocations);
    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchLocations();
    });
}

// ========== PAYMENT FUNCTIONS ==========
function initializePaymentMethods() {
    console.log('Initializing payment methods...');
    
    // Payment method selection
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const method = this.getAttribute('data-method');
            selectPaymentMethod(method);
        });
    });

    // Bank selection
    document.querySelectorAll('.bank-option').forEach(option => {
        option.addEventListener('click', function() {
            const bank = this.getAttribute('data-bank');
            selectBank(bank);
        });
    });

    // GCash verification
    const verifyGCashBtn = document.getElementById('verifyGCash');
    if (verifyGCashBtn) {
        verifyGCashBtn.addEventListener('click', verifyGCashPayment);
    }
    
    // Bank transfer verification
    const verifyBankBtn = document.getElementById('verifyBank');
    if (verifyBankBtn) {
        verifyBankBtn.addEventListener('click', verifyBankPayment);
    }
    
    // Initialize with cash payment
    selectPaymentMethod('cash');
    selectBank('bpi');
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    
    // Update UI
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`.payment-btn[data-method="${method}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Update payment forms
    updatePaymentForms();
}

function selectBank(bank) {
    selectedBank = bank;
    
    // Update UI
    document.querySelectorAll('.bank-option').forEach(option => {
        option.classList.remove('active');
    });
    
    const activeOption = document.querySelector(`.bank-option[data-bank="${bank}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }
    
    // Show corresponding bank details
    document.querySelectorAll('.bank-info').forEach(info => {
        info.style.display = 'none';
    });
    
    const activeInfo = document.querySelector(`.bank-info[data-bank="${bank}"]`);
    if (activeInfo) {
        activeInfo.style.display = 'block';
    }
}

function updatePaymentForms() {
    // Hide all payment forms and notes
    document.querySelectorAll('.payment-note, .payment-form').forEach(element => {
        element.classList.remove('active');
    });
    
    // Show selected payment method
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

    // Get selected size and price
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
    
    // Check if item already exists in cart
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
    
    // Show add to cart toast
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
    
    // Show/hide delivery fee based on order type
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
                <button class="quantity-btn minus" onclick="updateQuantity(${index}, -1)">-</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-btn plus" onclick="updateQuantity(${index}, 1)">+</button>
                <button class="remove-btn" onclick="removeFromCart(${index})">✕</button>
            </div>
        `;
        elements.billingItems.appendChild(itemElement);
    });
    
    // Apply delivery fee only for delivery orders
    const fee = orderType === 'Delivery' ? deliveryCharge : 0;
    const total = subtotal + fee;
    
    subtotalElement.textContent = `Php ${subtotal.toFixed(2)}`;
    totalElement.textContent = `Php ${total.toFixed(2)}`;
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
    
    // Show success message
    showToast(`Order placed successfully! Order Type: ${orderType}, Payment: ${paymentDetails}, Total: ${total}`, 'success', 5000);
    
    // Clear cart and reset
    cart = [];
    orderCount = 0;
    updateOrdersCount();
    updateBillingPanel();
    closeBillingPanel();
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    // Initialize location modal
    initializeLocationModal();
    
    // Initialize payment methods
    initializePaymentMethods();
    
    // Add to cart events
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.card');
            addToCart(card);
        });
    });

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
    document.addEventListener('click', function(e) {
        if (elements.billingPanel.classList.contains('open') && 
            !elements.billingPanel.contains(e.target) && 
            e.target !== elements.ordersButton) {
            closeBillingPanel();
        }
    });

    // Order type selection
    document.querySelectorAll('.order-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.order-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            updateBillingPanel();
        });
    });

    // Process order button
    const processOrderBtn = document.querySelector('.process-order');
    if (processOrderBtn) {
        processOrderBtn.addEventListener('click', processOrder);
    }

    // Set default order type
    document.querySelector('.order-btn[data-type="dine-in"]').classList.add('active');
});