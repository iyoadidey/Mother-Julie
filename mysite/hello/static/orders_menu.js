// ========== PAYMONGO CONFIGURATION ==========
const PAYMONGO_PUBLIC_KEY = 'pk_test_your_public_key_here'; // Replace with your actual public key
const PAYMONGO_SECRET_KEY = 'sk_test_your_secret_key_here'; // Replace with your actual secret key (use only on backend)

// For frontend-only demo, we'll use the public key
// In production, create payment intents on your backend!

// GLOBAL INITMAP FUNCTION - MUST be at the top level
window.initMap = function() {
    console.log(' Google Maps API loaded successfully');
    // The map will be initialized when the modal opens
};


// Order Management System
let cart = JSON.parse(localStorage.getItem('motherJulieCart')) || [];
let orderCount = cart.reduce((total, item) => total + item.quantity, 0) || 0;
let deliveryCharge = 0;  // Dynamic delivery fee - will be calculated via Lalamove API
let deliveryRouteKm = null;
let selectedPaymentMethod = 'cash';
let selectedBank = 'bpi';
let selectedDeliveryLocation = null;  // Store selected location for delivery calculation
const DELIVERY_LOCATION_STORAGE_KEY = 'motherJulieSelectedDeliveryLocation';

// Fixed pickup point for delivery estimates
const DELIVERY_PICKUP_POINT = {
    name: '1983 Old Torres St, Tondo, Manila, 1012 Metro Manila',
    lat: 14.5869,
    lng: 120.9799
};

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

// ========== CART PERSISTENCE FUNCTIONS ==========
function saveCartToStorage() {
    localStorage.setItem('motherJulieCart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('motherJulieCart');
    if (!savedCart) return;
    try {
        cart = JSON.parse(savedCart);
        if (!Array.isArray(cart)) throw new Error('invalid cart shape');
        orderCount = cart.reduce((total, item) => total + item.quantity, 0);
        updateOrdersCount();
    } catch (e) {
        console.error('Invalid motherJulieCart in localStorage, clearing:', e);
        localStorage.removeItem('motherJulieCart');
        cart = [];
        orderCount = 0;
        updateOrdersCount();
    }
}

function clearCartFromStorage() {
    localStorage.removeItem('motherJulieCart');
    cart = [];
    orderCount = 0;
    updateOrdersCount();
    updateBillingPanel();
}

function saveDeliveryLocation(location) {
    localStorage.setItem(DELIVERY_LOCATION_STORAGE_KEY, JSON.stringify(location));
}

function loadDeliveryLocation() {
    const savedLocation = localStorage.getItem(DELIVERY_LOCATION_STORAGE_KEY);
    if (!savedLocation) return null;

    try {
        return JSON.parse(savedLocation);
    } catch (error) {
        console.error('Error parsing saved delivery location:', error);
        localStorage.removeItem(DELIVERY_LOCATION_STORAGE_KEY);
        return null;
    }
}

function updateTopbarLocation(address) {
    const locText = document.querySelector('.loc-text');
    if (!locText) return;

    if (!address) {
        locText.textContent = 'Manila';
        return;
    }

    const cityMatch = address.match(/([^,]+)/);
    locText.textContent = cityMatch ? cityMatch[1].trim() : address;
}

// ========== MINIMALIST TOAST NOTIFICATIONS ==========
function showToast(message, type = 'success', duration = 3000) {
    console.log(' DEBUG: showToast called - message:', message, 'type:', type, 'duration:', duration);
    
    // Create toast container if it doesn't exist
    if (!elements.toastContainer) {
        elements.toastContainer = document.createElement('div');
        elements.toastContainer.id = 'toastContainer';
        elements.toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(elements.toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Simple minimalist content
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        </div>
        <div class="toast-progress"></div>
    `;

    // Add to container
    elements.toastContainer.appendChild(toast);

    // Show toast with animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    // Auto remove after duration
    const autoRemove = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Pause auto-remove on hover
    toast.addEventListener('mouseenter', () => {
        clearTimeout(autoRemove);
        toast.querySelector('.toast-progress').style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
        setTimeout(() => {
            removeToast(toast);
        }, 1000);
    });
}

function removeToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        
        // Hide container if no toasts left
        const toastContainer = document.getElementById('toastContainer');
        if (toastContainer && toastContainer.children.length === 0) {
            toastContainer.style.display = 'none';
        }
    }, 300);
}

function getMinimalSuccessMessage(orderType, paymentMethod) {
    const baseMessages = {
        'dine-in': 'Order placed! Pay at cashier',
        'pickup': 'Order placed! Redirecting to Pickup page',
        'delivery': 'Order placed! Redirecting to Delivery page'
    };
    
    return baseMessages[orderType] || 'Order placed successfully!';
}

async function calculateDeliveryFee(destination) {
    try {
        console.log('DEBUG calculateDeliveryFee destination:', destination);

        if (!destination || !destination.lat || !destination.lng) {
            deliveryCharge = 0;
            deliveryRouteKm = null;
            return;
        }

        showToast(`Calculating delivery fee from ${DELIVERY_PICKUP_POINT.name}...`, 'info', 3000);

        let routeDistanceKm = null;
        if (window.google?.maps?.DirectionsService) {
            try {
                const directionsService = new google.maps.DirectionsService();
                const directionsResult = await directionsService.route({
                    origin: new google.maps.LatLng(DELIVERY_PICKUP_POINT.lat, DELIVERY_PICKUP_POINT.lng),
                    destination: new google.maps.LatLng(destination.lat, destination.lng),
                    travelMode: google.maps.TravelMode.DRIVING,
                });

                const routeLeg = directionsResult?.routes?.[0]?.legs?.[0];
                const routeMeters = routeLeg?.distance?.value;
                if (routeMeters) {
                    routeDistanceKm = routeMeters / 1000;
                }
            } catch (directionsError) {
                console.warn('Directions API unavailable, falling back to coordinate estimate:', directionsError);
            }
        }

        const response = await fetch('/api/calculate-delivery-fee/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: { lat: DELIVERY_PICKUP_POINT.lat, lng: DELIVERY_PICKUP_POINT.lng },
                destination: { lat: destination.lat, lng: destination.lng },
                distance_km: routeDistanceKm
            })
        });

        let data = null;
        try {
            data = await response.json();
        } catch (jsonErr) {
            console.error('JSON parse error from calculate-delivery-fee:', jsonErr);
            throw new Error(`Lalamove response NOT JSON (status ${response.status}).`);
        }

        console.log('DEBUG Lalamove API response:', response.status, data);

        if (!response.ok) {
            const errorDetails = data && (data.error || data.details || JSON.stringify(data));
            throw new Error(`Lalamove API failed ${response.status}: ${errorDetails}`);
        }

        if (!data.success) {
            throw new Error(data.error || 'Unable to calculate delivery fee.');
        }

        deliveryCharge = Number(data.deliveryFee) || 0;
        deliveryRouteKm = Number(data.distanceKm || routeDistanceKm || 0) || null;
        updateBillingPanel();

        const sourceNote = routeDistanceKm ? '' : ' Using map-coordinate estimate.';
        showToast(`Delivery fee ${deliveryCharge > 0 ? 'set to' : 'reset to'} Php ${deliveryCharge.toFixed(2)}.${sourceNote}`, 'success', 3000);
    } catch (err) {
        console.error('Delivery fee calculation error:', err);
        deliveryCharge = 0;
        deliveryRouteKm = null;
        updateBillingPanel();
        showToast(`Could not calculate delivery fee. ${err.message}`, 'error', 8000);
    }
}

function handleOrderError(error) {
    let errorMessage = 'Failed to process order';
    if (error.message.includes('CSRF token')) {
        errorMessage = 'Please refresh and try again';
    } else if (error.message.includes('Network')) {
        errorMessage = 'Network error - check connection';
    } else {
        errorMessage = error.message;
    }
    
    showToast(errorMessage, 'error');
    
    // Use fallback if backend fails
    setTimeout(() => {
        processOrderFallback();
    }, 1000);
}

// ========== PAYMENT METHOD RESTRICTIONS ==========
function updatePaymentMethodsBasedOnOrderType() {
    const orderType = document.querySelector('.order-btn.active').dataset.type;
    const cashPaymentBtn = document.querySelector('.payment-btn.cash');
    const qrPaymentBtn = document.querySelector('.payment-btn.qr');
    const paymentMethodSection = document.querySelector('.payment-method');
    
    const existingMessages = paymentMethodSection.querySelectorAll('.disclaimer-box');
    existingMessages.forEach(message => message.remove());
    
    if (orderType === 'pickup' || orderType === 'delivery') {
        cashPaymentBtn.classList.add('disabled');
        cashPaymentBtn.disabled = true;
        
        // Enable QR payment for pickup/delivery
        qrPaymentBtn.classList.remove('disabled');
        qrPaymentBtn.disabled = false;
        
        const message = document.createElement('div');
        message.className = 'disclaimer-box warning';
        message.innerHTML = `<strong>Payment Notice:</strong> QR PH payment is required for ${orderType} orders. Cash payment is only available for dine-in orders.`;
        paymentMethodSection.appendChild(message);
        
        if (selectedPaymentMethod === 'cash') {
            selectPaymentMethod('qr');
        }
    } else {
        cashPaymentBtn.classList.remove('disabled');
        cashPaymentBtn.disabled = false;
        
        // QR also available for dine-in
        qrPaymentBtn.classList.remove('disabled');
        qrPaymentBtn.disabled = false;
        
        const message = document.createElement('div');
        message.className = 'disclaimer-box info';
        message.innerHTML = `<strong>Payment Notice:</strong> Cash or QR PH payment accepted.`;
        paymentMethodSection.appendChild(message);

        // Ensure dine-in uses cash by default to avoid unwanted QR hang with previous state
        if (selectedPaymentMethod !== 'cash') {
            selectPaymentMethod('cash');
        }
    }
}

// ========== STATIC QR PH PAYMENT FUNCTIONS ==========
let qrPaymentCheckInterval = null;

async function initializeQRPayment() {
    const totalElement = document.querySelector('.total');
    const amount = parseFloat(totalElement.textContent.replace(/[^0-9.]/g, ''));
    
    if (amount < 1) {
        showToast('Minimum amount is 1.00', 'error');
        return;
    }
    
    const qrDisplay = document.querySelector('.qr-display');
    qrDisplay.innerHTML = '<div class="qr-loading">Loading business QR code...</div>';

    const qrResult = await generateQRPhCode();
    const qrImageUrl =
        qrResult?.attributes?.image_url ||
        qrResult?.attributes?.qr_image_url ||
        qrResult?.attributes?.code?.image_url ||
        qrResult?.image_url ||
        null;
    const qrCodeId = qrResult?.id || qrResult?.attributes?.code?.id || 'business-static-qr';

    if (!qrImageUrl) {
        throw new Error('Business QR image is missing');
    }

    displayQRCode(qrImageUrl, amount, qrCodeId);
    localStorage.setItem('paymentVerificationStatus', JSON.stringify({
        method: 'qr',
        status: 'awaiting_customer_confirmation',
        timestamp: new Date().toISOString()
    }));

    const processOrderBtn = document.querySelector('.process-order');
    if (processOrderBtn) {
        processOrderBtn.disabled = false;
    }
}

async function generateQRPhCode() {
    const staticImageUrl = (typeof STATIC_URLS !== 'undefined' && STATIC_URLS.qrPh)
        ? STATIC_URLS.qrPh
        : '/static/orders_menupics/menu.png';

    return {
        id: 'static-qrph',
        attributes: {
            image_url: staticImageUrl
        }
    };
}

function displayQRCode(imageUrl, amount, codeId) {
    const qrDisplay = document.querySelector('.qr-display');
    
    qrDisplay.innerHTML = `
        <div class="qr-code-container">
            <img src="${imageUrl}" alt="QR Ph Code" class="qr-code-image">
            <div class="qr-amount">Amount: ${amount.toFixed(2)}</div>
            <div class="qr-instructions">
                <p>1. Open your banking app or e-wallet</p>
                <p>2. Scan the QR code above</p>
                <p>3. Send the exact amount shown above</p>
                <p>4. Enter your payment reference number below</p>
                <p>5. Tap "I Have Paid" after sending payment</p>
            </div>
            <input type="text" class="qr-reference-input" id="qrReferenceInput" placeholder="Enter payment reference number">
            <div class="qr-status checking">
                Waiting for customer confirmation
            </div>
            <button type="button" class="qr-retry-btn" onclick="confirmManualQRPayment()">I Have Paid</button>
        </div>
    `;
    
    // Store QR code info
    localStorage.setItem('currentQRCode', JSON.stringify({
        codeId: codeId,
        amount: amount,
        timestamp: new Date().toISOString(),
        type: 'business_static_qr'
    }));
}

function confirmManualQRPayment() {
    const qrInfo = JSON.parse(localStorage.getItem('currentQRCode') || '{}');
    const referenceInput = document.getElementById('qrReferenceInput');
    const paymentReference = (referenceInput?.value || '').trim().toUpperCase();
    const referencePattern = /^MJ[a-zA-Z0-9]{4,28}$/i;

    if (!paymentReference) {
        showToast('Please enter your payment reference number first.', 'error');
        if (referenceInput) {
            referenceInput.focus();
        }
        return;
    }
    if (!referencePattern.test(paymentReference)) {
        showToast('Reference must start with MJ and use 6-30 letters or numbers only.', 'error');
        if (referenceInput) {
            referenceInput.focus();
        }
        return;
    }
    if (referenceInput) {
        referenceInput.value = paymentReference;
    }

    const paymentDetails = {
        method: 'qr',
        paymentIntentId: qrInfo.codeId || 'business-static-qr',
        amount: document.querySelector('.total').textContent,
        timestamp: new Date().toISOString(),
        status: 'customer_marked_paid',
        verificationMode: 'manual_business_confirmation',
        paymentReference: paymentReference
    };

    localStorage.setItem('verifiedQRPayment', JSON.stringify(paymentDetails));
    localStorage.setItem('paymentVerificationStatus', JSON.stringify({
        method: 'qr',
        status: 'manual_confirmed',
        timestamp: new Date().toISOString()
    }));

    const statusEl = document.querySelector('.qr-status');
    if (statusEl) {
        statusEl.textContent = 'Payment marked as sent. Business confirmation is manual.';
    }

    const processOrderBtn = document.querySelector('.process-order');
    if (processOrderBtn) {
        processOrderBtn.disabled = false;
    }

    showToast('Payment marked as sent. You can place your order now.', 'success');
}

function startPaymentStatusCheck(paymentIntentId) {
    // Clear any existing interval
    if (qrPaymentCheckInterval) {
        clearInterval(qrPaymentCheckInterval);
    }
    
    let attempts = 0;
    const maxAttempts = 60; // Check for 60 seconds initially
    
    qrPaymentCheckInterval = setInterval(async () => {
        attempts++;
        
        try {
            // Check payment status via webhook simulation or API
            const status = await checkPaymentStatus(paymentIntentId);
            
            if (status === 'succeeded') {
                clearInterval(qrPaymentCheckInterval);
                handleSuccessfulQRPayment(paymentIntentId);
            } else if (status === 'failed' || status === 'expired') {
                clearInterval(qrPaymentCheckInterval);
                handleFailedQRPayment(status);
            } else if (attempts >= maxAttempts) {
                // Check if still waiting but within 30-minute expiry
                const qrInfo = JSON.parse(localStorage.getItem('currentQRCode') || '{}');
                const elapsed = new Date() - new Date(qrInfo.timestamp);
                
                if (elapsed > 30 * 60 * 1000) { // 30 minutes expired [citation:2]
                    clearInterval(qrPaymentCheckInterval);
                    handleFailedQRPayment('expired');
                }
            }
            
            // Update status message
            updateQRStatusMessage(`Waiting for payment... (${attempts}s)`);
            
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 1000);
}

async function checkPaymentStatus(paymentIntentId) {
    const response = await fetch(`/api/payment-intent/${paymentIntentId}/status/`);
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error || 'Failed to check payment status');
    }
    
    return data.status;
}

function handleSuccessfulQRPayment(paymentIntentId) {
    // Save payment details
    const paymentDetails = {
        method: 'qr',
        paymentIntentId: paymentIntentId,
        amount: document.querySelector('.total').textContent,
        timestamp: new Date().toISOString(),
        status: 'verified'
    };
    
    localStorage.setItem('verifiedQRPayment', JSON.stringify(paymentDetails));
    localStorage.setItem('paymentVerificationStatus', JSON.stringify({
        method: 'qr',
        status: 'verified',
        timestamp: new Date().toISOString()
    }));
    
    // Update UI
    const qrForm = document.querySelector('.qr-form');
    const qrDisplay = qrForm.querySelector('.qr-display');
    
    qrDisplay.innerHTML = `
        <div class="payment-success">
            <span class="success-icon"></span>
            <div>
                <strong>Payment Successful!</strong><br>
                Amount: ${document.querySelector('.total').textContent}<br>
                Reference: ${paymentIntentId.slice(-8)}
            </div>
        </div>
    `;
    
    // Enable place order button
    const processOrderBtn = document.querySelector('.process-order');
    if (processOrderBtn) {
        processOrderBtn.disabled = false;
    }
    
    showToast(' Payment successful! You can now place your order.', 'success');
}

function handleFailedQRPayment(reason) {
    const qrForm = document.querySelector('.qr-form');
    const qrDisplay = qrForm.querySelector('.qr-display');
    
    let message = 'Payment failed. Please try again.';
    if (reason === 'expired') {
        message = 'QR code expired. Please generate a new one.';
    }
    
    qrDisplay.innerHTML = `
        <div class="qr-error">
            <span class="error-icon"></span>
            <p>${message}</p>
            <button class="qr-retry-btn" onclick="initializeQRPayment()">Generate New QR</button>
        </div>
    `;
    
    // Clear stored data
    localStorage.removeItem('currentQRCode');
}

function updateQRStatusMessage(message) {
    const statusEl = document.querySelector('.qr-status');
    if (statusEl) {
        statusEl.innerHTML = `
            <span class="loading-spinner"></span>
            ${message}
        `;
    }
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

    selectPaymentMethod('cash');
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

function updatePaymentForms() {
    document.querySelectorAll('.payment-note, .payment-form').forEach(element => {
        element.classList.remove('active');
    });
    
    switch(selectedPaymentMethod) {
        case 'cash':
            document.querySelector('.cash-note').classList.add('active');
            // Clear any QR payment state
            if (qrPaymentCheckInterval) {
                clearInterval(qrPaymentCheckInterval);
                qrPaymentCheckInterval = null;
            }
            break;
        case 'qr':
            document.querySelector('.qr-form').classList.add('active');
            initializeQRPayment();
            break;
    }
}

// Legacy placeholder to preserve the function name; real processOrder is defined later.
async function processOrder() {
    // This placeholder is intentionally empty.
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

    const processOrderBtn = document.querySelector('.process-order');
    if (processOrderBtn) {
        processOrderBtn.disabled = true;
    }

    switch(selectedPaymentMethod) {
        case 'cash':
            document.querySelector('.cash-note').classList.add('active');
            if (processOrderBtn) {
                processOrderBtn.disabled = false;
            }
            break;
        case 'qr':
            document.querySelector('.qr-form').classList.add('active');
            if (processOrderBtn) {
                processOrderBtn.disabled = false;
            }
            break;
        case 'gcash':
            document.querySelector('.gcash-form').classList.add('active');
            updateGCashAmount();
            if (processOrderBtn) {
                processOrderBtn.disabled = false;
            }
            break;
        case 'bank':
            document.querySelector('.bank-form').classList.add('active');
            if (processOrderBtn) {
                processOrderBtn.disabled = false;
            }
            break;
        default:
            // if payment method is unknown, keep button disabled as safety
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

// ========== CART FUNCTIONS ==========
function addToCart(cardElement) {
    const itemName = cardElement.querySelector('h3').textContent;
    const itemImage = cardElement.querySelector('img').src;
    const productId = cardElement.getAttribute('data-product-id');
    
    // Check if out of stock
    const availabilityEl = cardElement.querySelector('.availability');
    if (availabilityEl && availabilityEl.textContent === 'Out of Stock') {
        showToast(`${itemName} is out of stock`, 'error');
        return;
    }

    let selectedSize = '';
    let price = 0;
    
    const sizeRadios = cardElement.querySelectorAll('input[type="radio"]');
    if (sizeRadios.length > 0) {
        const selectedRadio = Array.from(sizeRadios).find(radio => radio.checked);
        if (selectedRadio) {
            selectedSize = selectedRadio.value;
            // Get price from data attribute if available
            price = parseFloat(selectedRadio.getAttribute('data-size-price')) || 0;
            if (price === 0) {
                // Fallback to parsing from price text
                const priceText = cardElement.querySelector('.price').textContent;
                const sizePriceMatch = priceText.match(new RegExp(`Php\\s*(\\d+)\\s*\\(${selectedSize}\\)`));
                price = sizePriceMatch ? parseInt(sizePriceMatch[1]) : 0;
            }
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
            id: productId,
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
    saveCartToStorage();
    
    showToast(` ${itemName} added`, 'success');
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
            saveCartToStorage();
        }
    }
}

function removeFromCart(index) {
    if (cart[index]) {
        const itemName = cart[index].name;
        orderCount -= cart[index].quantity;
        cart.splice(index, 1);
        
        if (cart.length === 0) orderCount = 0;
        
        updateOrdersCount();
        updateBillingPanel();
        saveCartToStorage();
        showToast(` ${itemName} removed`, 'info');
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
    const deliveryFeeElement = document.querySelector('.delivery-charge');
    const deliveryFeeNote = document.getElementById('deliveryFeeNote');
    const orderType = document.querySelector('.order-btn.active').dataset.type;
    
    elements.billingItems.innerHTML = '';
    
    if (orderType === 'delivery') {
        deliveryFeeRow.style.display = 'flex';
        if (deliveryFeeNote) {
            deliveryFeeNote.style.display = 'block';
        }
        // Show calculating state
        if (deliveryCharge === 0) {
            deliveryFeeElement.textContent = 'Php Calculating...';
        } else {
            const routeSuffix = deliveryRouteKm ? ` (${deliveryRouteKm.toFixed(1)} km route)` : '';
            deliveryFeeElement.textContent = `Php ${deliveryCharge.toFixed(2)}${routeSuffix}`;
        }
    } else {
        deliveryFeeRow.style.display = 'none';
        if (deliveryFeeNote) {
            deliveryFeeNote.style.display = 'none';
        }
        deliveryRouteKm = null;
    }
    
    if (cart.length === 0) {
        elements.billingItems.innerHTML = `
            <div class="empty-cart-message">
                <div class="empty-icon"></div>
                <p>No items in cart</p>
                <small>Add some delicious items to get started!</small>
            </div>
        `;
        subtotalElement.textContent = 'Php 0.00';
        const total = orderType === 'delivery' ? deliveryCharge : 0;
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
                <button class="quantity-btn minus" data-index="${index}" aria-label="Decrease quantity">−</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-btn plus" data-index="${index}" aria-label="Increase quantity">+</button>
                <button class="remove-btn" data-index="${index}" aria-label="Remove item">🗑</button>
            </div>
        `;
        elements.billingItems.appendChild(itemElement);
    });
    
    const fee = orderType === 'delivery' ? deliveryCharge : 0;
    const total = subtotal + fee;
    
    subtotalElement.textContent = `Php ${subtotal.toFixed(2)}`;
    totalElement.textContent = `Php ${total.toFixed(2)}`;
    
    initializeBillingPanelEvents();
}

// ========== BILLING PANEL EVENT HANDLERS ==========
function initializeBillingPanelEvents() {
    const newBillingItems = elements.billingItems.cloneNode(true);
    elements.billingItems.parentNode.replaceChild(newBillingItems, elements.billingItems);
    elements.billingItems = newBillingItems;
    
    elements.billingItems.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const target = e.target;
        const index = parseInt(target.getAttribute('data-index'));
        
        if (target.classList.contains('minus')) {
            updateQuantity(index, -1);
        } else if (target.classList.contains('plus')) {
            updateQuantity(index, 1);
        } else if (target.classList.contains('remove-btn')) {
            removeFromCart(index);
        }
    });
}

// ========== ORDER PROCESSING ==========
async function processOrder() {
    console.log('processOrder called');
    
    if (cart.length === 0) {
        showToast('Your cart is empty!', 'error');
        return;
    }

    const orderType = document.querySelector('.order-btn.active').dataset.type;
    const total = document.querySelector('.total').textContent;
    
    console.log('Order Type:', orderType);
    console.log('Payment Method:', selectedPaymentMethod);
    console.log('Cart items:', cart);
    
    // Prepare order data with payment verification
    const orderData = {
        items: cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            size: item.size || ''
        })),
        totalAmount: parseFloat(total.replace(/[^0-9.]/g, '')),
        orderType: orderType,
        paymentMethod: selectedPaymentMethod,
        customerName: window.currentUsername || 'Guest',
        customerEmail: window.currentUserEmail || '',
        paymentReference: selectedPaymentMethod === 'qr'
            ? (getVerifiedPaymentDetails()?.paymentReference || '')
            : '',
        paymentVerified: selectedPaymentMethod !== 'cash',
        paymentDetails: selectedPaymentMethod !== 'cash' ? 
            getVerifiedPaymentDetails() : null
    };

    if (selectedPaymentMethod === 'qr') {
        localStorage.setItem('pendingQrOrder', JSON.stringify(orderData));
        window.location.href = '/qr-payment/';
        return;
    }
    
    console.log('Sending order data:', orderData);
    
    try {
        const csrfToken = getCSRFToken();
        console.log('CSRF Token:', csrfToken);
        
        if (!csrfToken) {
            throw new Error('CSRF token not found. Please refresh the page and try again.');
        }
        
        const response = await fetch('/api/orders/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(orderData)
        });
        
        console.log('Response status:', response.status);
        
        let result;
        try {
            const responseText = await response.text();
            console.log('Response text:', responseText);
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            throw new Error('Invalid response from server');
        }
        
        console.log('Response result:', result);
        
        if (result.success) {
            console.log('Order created successfully with ID:', result.orderId);
            
            // Update product stocks if provided
            if (result.updated_stocks) {
                updateProductStocks(result.updated_stocks);
            }
            
            handleSuccessfulOrder(result.orderId, orderType, total);
        } else {
            throw new Error(result.error || 'Failed to create order');
        }
    } catch (error) {
        console.error('Order processing error:', error);
        handleOrderError(error);
    }
}

// ========== SUCCESSFUL ORDER HANDLING ==========
function handleSuccessfulOrder(orderId, orderType, total) {
    console.log(' DEBUG: handleSuccessfulOrder STARTED');
    console.log(' DEBUG: orderId=', orderId, 'orderType=', orderType, 'total=', total);
    
    // Save order data
    const trackingData = {
        orderId: orderId,
        items: cart,
        orderType: orderType,
        paymentMethod: selectedPaymentMethod,
        total: total,
        orderPlaced: new Date().toLocaleString(),
        status: 'order_placed',
        paymentVerified: selectedPaymentMethod !== 'cash',
        paymentDetails: getVerifiedPaymentDetails()
    };
    
    localStorage.setItem('currentOrder', JSON.stringify(trackingData));
    saveOrderToHistory(trackingData);
    
    // Clear cart and payment verification
    clearCartFromStorage();
    if (selectedPaymentMethod === 'gcash') {
        clearGCashVerification();
    } else if (selectedPaymentMethod === 'bank') {
        clearBankVerification();
    }
    
    closeBillingPanel();
    
    console.log(' DEBUG: About to show PROCESSING toast');
    showToast('Processing your order...', 'info', 2000);
    
    console.log(' DEBUG: Setting 2-second timeout for SUCCESS toast');
    setTimeout(() => {
        console.log(' DEBUG: 2-second timeout FIRED');
        
        const successMessage = getMinimalSuccessMessage(orderType, selectedPaymentMethod);
        console.log(' DEBUG: successMessage =', successMessage);
        
        console.log(' DEBUG: About to show SUCCESS toast');
        showToast(successMessage, 'success', 3000);
        
        setTimeout(() => {
            console.log(' DEBUG: Redirect timeout fired');
            redirectToOrderPage(orderType, orderId);
        }, 1500);
    }, 2000);
}

// ========== FALLBACK ORDER PROCESSING ==========
function processOrderFallback() {
    console.log('Using fallback order processing');
    
    if (cart.length === 0) {
        showToast('Cart is empty', 'error');
        return;
    }
    
    const orderType = document.querySelector('.order-btn.active').dataset.type;
    const total = document.querySelector('.total').textContent;
    
    // Create a simple order ID
    const orderId = 'MJ' + Date.now();
    
    // Prepare tracking data
    const trackingData = {
        orderId: orderId,
        items: cart,
        orderType: orderType,
        paymentMethod: selectedPaymentMethod,
        total: total,
        orderPlaced: new Date().toLocaleString(),
        status: 'order_placed',
        paymentVerified: selectedPaymentMethod !== 'cash',
        paymentDetails: getVerifiedPaymentDetails()
    };
    
    // Save to localStorage
    localStorage.setItem('currentOrder', JSON.stringify(trackingData));
    saveOrderToHistory(trackingData);
    
    // Show success message
    const successMessage = getMinimalSuccessMessage(orderType, selectedPaymentMethod);
    showToast(successMessage, 'success', 3000);
    
    // Clear cart and verification
    clearCartFromStorage();
    if (selectedPaymentMethod === 'gcash') {
        clearGCashVerification();
    } else if (selectedPaymentMethod === 'bank') {
        clearBankVerification();
    }
    
    closeBillingPanel();
    
    // Redirect
    setTimeout(() => {
        redirectToOrderPage(orderType, orderId);
    }, 1000);
}

function redirectToOrderPage(orderType, orderId) {
    console.log(' DEBUG: redirectToOrderPage called - orderType:', orderType, 'orderId:', orderId);
    
    if (orderType === 'delivery') {
        console.log(' DEBUG: Redirecting to DELIVERY page');
        window.location.href = `/delivery/?orderId=${orderId}`;
    } else if (orderType === 'pickup' || orderType === 'dine-in') {
        console.log(' DEBUG: Redirecting to PICKUP page');
        window.location.href = `/pick_up/?orderId=${orderId}`;
    } else {
        console.log(' DEBUG: Dine-in order - staying on current page');
        window.location.href = '/orders_menu/';
    }
}

// ========== CSRF TOKEN HELPER ==========
function getCSRFToken() {
    let csrfToken = '';
    
    // Method 1: From hidden input field
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    if (csrfInput) {
        csrfToken = csrfInput.value;
    }

    return csrfToken;
}

function getVerifiedPaymentDetails() {
    // Return structured payment details for verified non-cash methods
    const method = selectedPaymentMethod;
    if (method === 'qr') {
        const verified = localStorage.getItem('verifiedQRPayment');
        if (!verified) return null;

        try {
            return JSON.parse(verified);
        } catch (e) {
            console.error('Could not parse verified QR payment data:', e);
            return null;
        }
    }

    if (method === 'gcash') {
        const store = localStorage.getItem('verifiedGCashPayment');
        if (!store) return null;

        try {
            return JSON.parse(store);
        } catch (e) {
            console.error('Could not parse verified GCash payment data:', e);
            return null;
        }
    }

    if (method === 'bank') {
        const store = localStorage.getItem('verifiedBankPayment');
        if (!store) return null;

        try {
            return JSON.parse(store);
        } catch (e) {
            console.error('Could not parse verified Bank payment data:', e);
            return null;
        }
    }

    // Cash and other methods are not verified by payment details
    return null;
}
    
// ========== SAVE ORDER TO HISTORY ==========
function saveOrderToHistory(orderData) {
    let orderHistory = JSON.parse(localStorage.getItem('motherJulieOrderHistory')) || [];
    orderHistory.unshift(orderData);
    
    if (orderHistory.length > 50) {
        orderHistory = orderHistory.slice(0, 50);
    }
    
    localStorage.setItem('motherJulieOrderHistory', JSON.stringify(orderHistory));
}

// ========== LOCATION FUNCTIONS ==========
function initializeLocationModal() {
    const locationModal = document.getElementById('locationModal');
    const locationInput = document.getElementById('locationInput');
    const searchBtn = document.getElementById('searchBtn');
    const suggestions = document.getElementById('suggestions');
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    const showMapBtn = document.getElementById('showMapBtn');
    const mapContainer = document.getElementById('mapContainer');
    const locationError = document.getElementById('locationError');
    const confirmLocationBtn = document.getElementById('confirmLocationBtn');
    const cancelLocationBtn = document.getElementById('cancelLocationBtn');
    const modalClose = document.getElementById('modalClose');
    const selectedLocationDisplay = document.getElementById('selectedLocationDisplay');

    let map;
    let marker;
    let geocoder;
    let autocomplete;
    let selectedLocation = null;
    let isMapVisible = false;
    let locationSearchTimeout = null;

    function normalizeLatLng(location) {
        if (!location) return null;

        const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
        const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return null;
        }

        return { lat, lng };
    }

    // ========== OPEN MODAL ==========
    document.querySelector('.location-search').addEventListener('click', () => {
        locationModal.style.display = 'flex';
        locationInput.focus();
    });

    // ========== CLOSE MODAL FUNCTIONS ==========
    modalClose.addEventListener('click', () => closeModal());
    cancelLocationBtn.addEventListener('click', () => closeModal());

    locationModal.addEventListener('click', (e) => {
        if (e.target === locationModal) closeModal();
    });

    function closeModal() {
        locationModal.style.display = 'none';
        resetModal();
    }

    function resetModal() {
        if (locationInput) locationInput.value = '';
        if (suggestions) suggestions.innerHTML = '';
        if (locationError) locationError.innerHTML = '';
        if (confirmLocationBtn) confirmLocationBtn.disabled = true;
        if (selectedLocationDisplay) selectedLocationDisplay.innerHTML = '';
        
        // Hide map if visible
        if (mapContainer && mapContainer.classList.contains('active')) {
            mapContainer.classList.remove('active');
            if (showMapBtn) {
                showMapBtn.classList.remove('active');
                showMapBtn.textContent = " Show Map";
            }
        }
        
        // Clear marker
        if (marker) {
            marker.setMap(null);
            marker = null;
        }
        selectedLocation = null;
    }

    // ========== CONFIRM LOCATION ==========
    confirmLocationBtn.addEventListener('click', () => {
        // Use the global selectedDeliveryLocation object if available (set by setSelectedLocation)
        const hasSelectedDeliveryLocation = selectedDeliveryLocation && selectedDeliveryLocation.address;
        const activeSelectedLocation = hasSelectedDeliveryLocation ? selectedDeliveryLocation.address : selectedLocation;

        if (activeSelectedLocation) {
            updateTopbarLocation(activeSelectedLocation);

            showToast(` Location set to: ${activeSelectedLocation}`, 'success');
            closeModal();
        } else {
            locationError.textContent = 'Please select a location first';
            locationError.classList.add('active');
            setTimeout(() => locationError.classList.remove('active'), 3000);
        }
    });

    // ========== IMPROVED CURRENT LOCATION WITH ACCURACY THRESHOLD ==========
function getCurrentLocation(desiredAccuracy = 30) { // Want at least 30m accuracy for GPS lock
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }
        
        currentLocationBtn.disabled = true;
        currentLocationBtn.classList.add('loading');
        currentLocationBtn.innerHTML = ' Getting GPS lock...';
        
        let bestPosition = null;
        let bestAccuracy = Infinity;
        let watchId = null;
        let timeoutId = null;
        let isDone = false;
        let updateCount = 0;
        const startTime = Date.now();
        
        // Success callback for watchPosition - waits for good GPS lock
        const onPositionUpdate = (position) => {
            if (isDone) return;
            
            updateCount++;
            const accuracy = position.coords.accuracy;
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const elapsedStr = elapsedSeconds.toFixed(1);
            console.log(` GPS Update #${updateCount} (${elapsedStr}s) - Accuracy: ${accuracy}m, Lat: ${pos.lat}, Lng: ${pos.lng}`);
            
            // Always track best position, regardless of accuracy
            if (accuracy < bestAccuracy) {
                bestAccuracy = accuracy;
                bestPosition = pos;
                
                // Show current status
                if (accuracy <= desiredAccuracy) {
                    // Excellent GPS lock - use immediately after 2 updates to confirm!
                    if (updateCount >= 2) {
                        console.log(` Excellent GPS lock confirmed: ${accuracy}m`);
                        isDone = true;
                        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
                        if (timeoutId) clearTimeout(timeoutId);
                        stopAndResolve(pos, accuracy);
                        return;
                    }
                    // Still waiting to confirm
                    locationError.textContent = ' Acquiring GPS...';
                    locationError.classList.add('active');
                    locationError.style.background = '#e3f2fd';
                    locationError.style.color = '#1565c0';
                } else if (accuracy <= 500) {
                    // Good/fair accuracy - show progress
                    locationError.textContent = ' Acquiring GPS...';
                    locationError.classList.add('active');
                    locationError.style.background = '#e3f2fd';
                    locationError.style.color = '#1565c0';
                } else if (elapsedSeconds >= 4) {
                    // After 4 seconds, show even poor accuracy updates (WiFi-based)
                    locationError.textContent = ' Getting your location...';
                    locationError.classList.add('active');
                    locationError.style.background = '#fff3cd';
                    locationError.style.color = '#856404';
                } else {
                    // First 4 seconds with > 500m accuracy - still waiting
                    locationError.textContent = ' Waiting for GPS lock...';
                    locationError.classList.add('active');
                    locationError.style.background = '#e3f2fd';
                    locationError.style.color = '#1565c0';
                }
            }
        };
        
        // Error callback
        const onError = (error) => {
            if (isDone) return;
            isDone = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            if (timeoutId) clearTimeout(timeoutId);
            
            console.error('Geolocation error:', error.code, error.message);
            if (error.code === 1) {
                stopAndReject(new Error('Permission denied. Please enable location access in browser settings.'));
            } else if (error.code === 3) {
                stopAndReject(new Error('Location request timed out. Please ensure location services are enabled.'));
            } else {
                stopAndReject(new Error('Could not get location. Please try again.'));
            }
        };
        
        // Stop watching and resolve with best position
        const stopAndResolve = (position, accuracy) => {
            currentLocationBtn.disabled = false;
            currentLocationBtn.classList.remove('loading');
            currentLocationBtn.innerHTML = ' Use Current Location';
            
            // Show accuracy message
            let accuracyMessage = '';
            if (accuracy < 15) {
                accuracyMessage = ' Excellent accuracy!';
            } else if (accuracy < 30) {
                accuracyMessage = ' Great accuracy';
            } else if (accuracy < 50) {
                accuracyMessage = ' Good accuracy';
            } else if (accuracy < 100) {
                accuracyMessage = ' Fair accuracy';
            } else {
                accuracyMessage = ' Low accuracy - may be approximate';
            }
            
            locationError.textContent = `${accuracyMessage} (${Math.round(accuracy)}m)`;
            locationError.style.background = accuracy < 50 ? '#d4edda' : '#fff3cd';
            locationError.style.color = accuracy < 50 ? '#155724' : '#856404';
            locationError.classList.add('active');
            
            setTimeout(() => {
                locationError.classList.remove('active');
            }, 4000);
            
            resolve(position);
        };
        
        // Stop watching and reject
        const stopAndReject = (error) => {
            currentLocationBtn.disabled = false;
            currentLocationBtn.classList.remove('loading');
            currentLocationBtn.innerHTML = ' Use Current Location';
            reject(error);
        };
        
        // Use watchPosition to continuously improve accuracy
        // Aggressive timeout to force GPS to work properly
        watchId = navigator.geolocation.watchPosition(
            onPositionUpdate,
            onError,
            {
                enableHighAccuracy: true,    // Force GPS (not WiFi/cellular)
                timeout: 8000,               // Wait up to 8 seconds per attempt
                maximumAge: 0                // CRITICAL: Never use cached positions
            }
        );
        
        // After 8 seconds, use the best position we've gotten
        timeoutId = setTimeout(() => {
            if (!isDone) {
                isDone = true;
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }
                
                if (bestPosition) {
                    console.log(` Using best position after 8s: ${bestAccuracy}m (${updateCount} updates)`);
                    stopAndResolve(bestPosition, bestAccuracy);
                } else {
                    stopAndReject(new Error('Could not get accurate location. Please check GPS is enabled and try again.'));
                }
            }
        }, 8000); // 8 second absolute max
    });
}

    // ========== CURRENT LOCATION BUTTON ==========
currentLocationBtn.addEventListener('click', async () => {
    try {
        locationError.classList.remove('active');
        locationError.textContent = '';
        
        // Try to get accurate location (within 50 meters)
        const position = await getCurrentLocation(50);
        
        if (!map) {
            initMap();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        map.setCenter(position);
        map.setZoom(18); // Zoom in closer for better verification
        placeMarker(position);
        reverseGeocode(position);
        
        if (!mapContainer.classList.contains('active')) {
            isMapVisible = true;
            mapContainer.classList.add('active');
            showMapBtn.classList.add('active');
            showMapBtn.textContent = ' Hide Map';
        }
        
    } catch (error) {
        console.error('Location error:', error);
        locationError.textContent = error.message;
        locationError.classList.add('active');
        locationError.style.background = '#ffebee';
        locationError.style.color = '#c62828';
        
        setTimeout(() => {
            locationError.classList.remove('active');
        }, 5000);
    }
});
    // ========== SEARCH FUNCTION ==========
    function searchLocation(query) {
        if (!geocoder) {
            geocoder = new google.maps.Geocoder();
        }
        
        suggestions.innerHTML = '<div class="suggestion-item loading">Searching...</div>';
        suggestions.classList.add('active');
        
        geocoder.geocode({ 
            address: query, 
            region: 'PH', 
            bounds: { north: 14.9, south: 14.2, east: 121.2, west: 120.8 } 
        }, (results, status) => {
            if (status === 'OK' && results.length > 0) {
                suggestions.innerHTML = '';
                
                const metroManilaResults = results.filter(result => {
                    const address = result.formatted_address.toLowerCase();
                    return address.includes('manila') || 
                           address.includes('makati') || 
                           address.includes('quezon city') || 
                           address.includes('pasig') ||
                           address.includes('taguig') ||
                           address.includes('mandaluyong') ||
                           address.includes('san juan') ||
                           address.includes('pasay') ||
                           address.includes('paranaque') ||
                           address.includes('las pinas') ||
                           address.includes('muntinglupa') ||
                           address.includes('valenzuela') ||
                           address.includes('caloocan') ||
                           address.includes('malabon') ||
                           address.includes('navotas') ||
                           address.includes('marikina');
                });
                
                const resultsToShow = metroManilaResults.length > 0 ? metroManilaResults : results.slice(0, 5);
                
                if (resultsToShow.length === 0) {
                    suggestions.innerHTML = '<div class="suggestion-item no-results">No locations found in Metro Manila</div>';
                    return;
                }
                
                resultsToShow.forEach(result => {
                    const suggestion = document.createElement('div');
                    suggestion.className = 'suggestion-item';
                    suggestion.textContent = result.formatted_address;
                    suggestion.addEventListener('click', () => {
                        selectLocationFromSearch(result);
                    });
                    suggestions.appendChild(suggestion);
                });
            } else {
                suggestions.innerHTML = '<div class="suggestion-item error">No results found. Try a different search.</div>';
                
                if (status === 'ZERO_RESULTS') {
                    locationError.textContent = 'No locations found. Please check your search.';
                    locationError.classList.add('active');
                } else if (status === 'OVER_QUERY_LIMIT') {
                    locationError.textContent = 'Search quota exceeded. Please try again later.';
                    locationError.classList.add('active');
                } else if (status === 'REQUEST_DENIED') {
                    locationError.textContent = 'Search request denied. Please check API configuration.';
                    locationError.classList.add('active');
                }
                
                setTimeout(() => locationError.classList.remove('active'), 5000);
            }
        });
    }

    function selectLocationFromSearch(result) {
        const location = result.geometry.location;
        
        if (!map) initMap();
        
        map.setCenter(location);
        map.setZoom(16);
        placeMarker(location);
        setSelectedLocation({
            address: result.formatted_address,
            lat: location.lat(),
            lng: location.lng()
        });
        
        suggestions.innerHTML = '';
        suggestions.classList.remove('active');
        locationError.classList.remove('active');
        locationInput.value = result.formatted_address;
    }

    // ========== SUGGESTIONS WHILE TYPING ==========
    locationInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        if (locationSearchTimeout) {
            clearTimeout(locationSearchTimeout);
        }

        if (query.length < 3) {
            suggestions.innerHTML = '';
            suggestions.classList.remove('active');
            return;
        }

        locationSearchTimeout = setTimeout(() => {
            searchLocation(query);
        }, 350);
    });

    // ========== SEARCH BUTTON ==========
    searchBtn.addEventListener('click', () => {
        const query = locationInput.value.trim();
        if (query.length < 3) {
            locationError.textContent = 'Please enter at least 3 characters';
            locationError.classList.add('active');
            setTimeout(() => locationError.classList.remove('active'), 3000);
            return;
        }
        searchLocation(query);
    });

    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = locationInput.value.trim();
            if (query.length >= 3) {
                searchLocation(query);
            }
        }
    });

    // ========== SHOW/HIDE MAP ==========
    showMapBtn.addEventListener('click', () => {
        isMapVisible = !isMapVisible;
        mapContainer.classList.toggle('active', isMapVisible);

        if (isMapVisible) {
            showMapBtn.classList.add("active");
            showMapBtn.textContent = " Hide Map";
            if (!map) initMap();
        } else {
            showMapBtn.classList.remove("active");
            showMapBtn.textContent = " Show Map";
        }
    });

    // ========== MAP FUNCTIONS ==========
    function initMap() {
        const defaultLocation = { lat: 14.5995, lng: 120.9842 };

        map = new google.maps.Map(document.getElementById("map"), {
            center: defaultLocation,
            zoom: 12,
        });

        geocoder = new google.maps.Geocoder();

        map.addListener("click", (e) => {
            placeMarker(e.latLng);
            reverseGeocode(e.latLng);
        });

        // Use Places Autocomplete (deprecated but working)
        autocomplete = new google.maps.places.Autocomplete(locationInput);
        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) return;

            map.setCenter(place.geometry.location);
            map.setZoom(15);
            placeMarker(place.geometry.location);
            setSelectedLocation({
                address: place.formatted_address,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            });
        });
    }

    function placeMarker(location) {
        if (marker) {
            marker.setPosition(location);
        } else {
            marker = new google.maps.Marker({
                position: location,
                map: map,
                draggable: true
            });

            marker.addListener("dragend", () => {
                reverseGeocode(marker.getPosition());
            });
        }

        map.setCenter(location);
    }

    function reverseGeocode(latLng) {
        const normalizedLocation = normalizeLatLng(latLng);
        if (!normalizedLocation) {
            locationError.textContent = 'Could not read the selected location.';
            locationError.classList.add('active');
            locationError.style.background = '#ffebee';
            locationError.style.color = '#c62828';
            return;
        }

        locationError.textContent = 'Getting address...';
        locationError.classList.add('active');
        locationError.style.background = '#e3f2fd';
        locationError.style.color = '#1565c0';
        
        geocoder.geocode({ location: normalizedLocation }, (results, status) => {
            locationError.classList.remove('active');
            
            if (status === "OK" && results[0]) {
                const address = results[0].formatted_address;
                const isInMetroManila = address.toLowerCase().includes('manila') || 
                                        address.toLowerCase().includes('metro manila') ||
                                        address.toLowerCase().includes('ncr');
                
                if (isInMetroManila) {
                    setSelectedLocation({
                        address: address,
                        lat: normalizedLocation.lat,
                        lng: normalizedLocation.lng
                    });
                    
                    locationError.textContent = ' Location found!';
                    locationError.classList.add('active');
                    locationError.style.background = '#e8f5e9';
                    locationError.style.color = '#2e7d32';
                    
                    setTimeout(() => locationError.classList.remove('active'), 2000);
                } else {
                    locationError.textContent = 'Selected location is outside Metro Manila. Please choose a location within Metro Manila.';
                    locationError.classList.add('active');
                    locationError.style.background = '#fff3cd';
                    locationError.style.color = '#856404';
                    
                    if (marker) {
                        marker.setMap(null);
                        marker = null;
                    }
                }
            } else {
                console.error('Geocoder failed due to: ' + status);
                locationError.textContent = 'Could not find address for this location.';
                locationError.classList.add('active');
                locationError.style.background = '#ffebee';
                locationError.style.color = '#c62828';
            }
        });
    }

    function setSelectedLocation(location) {
        selectedDeliveryLocation = location;
        saveDeliveryLocation(location);
        updateSelectedLocationDisplay(location.address || '');
        updateTopbarLocation(location.address || '');
        confirmLocationBtn.disabled = false;

        if (document.querySelector('.order-btn.active')?.dataset.type === 'delivery') {
            calculateDeliveryFee(location);
        }
    }

    function updateSelectedLocationDisplay(address) {
        if (selectedLocationDisplay) {
            selectedLocationDisplay.innerHTML = `
                <div class="selected-address">
                    <strong>Selected Location:</strong><br>
                    ${address}
                </div>
            `;
            selectedLocationDisplay.classList.add('active');
        }
    }

    // ========== CLICK OUTSIDE SUGGESTIONS ==========
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box') && !e.target.closest('.suggestions')) {
            suggestions.classList.remove('active');
        }
    });
}

// ========== SIDEBAR NAVIGATION ==========
function initializeSidebarNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const categories = document.querySelectorAll('.category');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            
            navItems.forEach(navItem => navItem.classList.remove('active'));
            this.classList.add('active');
            
            categories.forEach(category => category.classList.remove('active'));
            
            const targetCategory = document.getElementById(targetId);
            if (targetCategory) {
                targetCategory.classList.add('active');
                updateHeaderForCategory(targetId);
                
                if (targetId !== 'all') {
                    populateCategory(targetId);
                }
            }
        });
    });
}

function updateHeaderForCategory(categoryId) {
    const titleLogo = document.getElementById('titleLogo');
    const pageTitle = document.getElementById('pageTitle');
    
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
            logo: STATIC_URLS.appetizer,
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

function populateCategory(categoryId) {
    // Handle "all" category specially - populate all category grids within it
    if (categoryId === 'all') {
        const categoryMap = {
            'desserts': 'DESSERTS',
            'spuds': 'SPUDS',
            // Must match .category-subtitle text in orders_menu.html (ALL MENU section)
            'pasta': 'PASTA/BREAD',
            'wrap': 'WRAP',
            'appetizers': 'APPETIZERS'
        };
        
        Object.keys(categoryMap).forEach(catId => {
            // Find category section by subtitle text
            const categorySections = document.querySelectorAll('.category-section');
            categorySections.forEach(section => {
                const subtitle = section.querySelector('.category-subtitle');
                if (subtitle && subtitle.textContent.trim() === categoryMap[catId]) {
                    const grid = section.querySelector('.menu-grid');
                    if (grid) {
                        grid.innerHTML = '';
                        const categoryItems = getCategoryItems(catId);
                        categoryItems.forEach(item => {
                            const card = createMenuItemCard(item);
                            grid.appendChild(card);
                        });
                    }
                }
            });
        });
        return;
    }
    
    // Try to find grid by ID first
    const categoryGrid = document.getElementById(categoryId + 'CategoryGrid');
    
    if (categoryGrid) {
        categoryGrid.innerHTML = '';
        const categoryItems = getCategoryItems(categoryId);
        categoryItems.forEach(item => {
            const card = createMenuItemCard(item);
            categoryGrid.appendChild(card);
        });
        return;
    }
    
    // Try to find grid within category section by subtitle
    const categoryMap = {
        'desserts': 'DESSERTS',
        'spuds': 'SPUDS',
        'pasta': 'PASTA/BREAD',
        'wrap': 'WRAP',
        'appetizers': 'APPETIZERS'
    };
    
    const categoryTitle = categoryMap[categoryId];
    if (categoryTitle) {
        const categorySections = document.querySelectorAll('.category-section');
        categorySections.forEach(section => {
            const subtitle = section.querySelector('.category-subtitle');
            if (subtitle && subtitle.textContent.trim() === categoryTitle) {
                const grid = section.querySelector('.menu-grid');
                if (grid) {
                    grid.innerHTML = '';
                    const categoryItems = getCategoryItems(categoryId);
                    categoryItems.forEach(item => {
                        const card = createMenuItemCard(item);
                        grid.appendChild(card);
                    });
                }
            }
        });
    }
}

// Store products loaded from API
let productsFromAPI = [];

// Load products from API
async function loadProductsFromAPI() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const response = await fetch('/api/products/public/', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error('Failed to load products');
        }
        productsFromAPI = await response.json();
        console.log('Products loaded from API:', productsFromAPI.length);
        
        // Log products with 0 stock to debug
        const outOfStock = productsFromAPI.filter(p => p.stock <= 0);
        if (outOfStock.length > 0) {
            console.log('Out of stock products:', outOfStock.map(p => p.name));
        }
        
        return productsFromAPI;
    } catch (error) {
        console.error('Error loading products from API:', error);
        const msg = error.name === 'AbortError'
            ? 'Loading products timed out. Check your connection and refresh.'
            : 'Failed to load products. Please refresh the page.';
        showToast(msg, 'error');
        return [];
    }
}

// Function to refresh products (can be called after admin updates)
async function refreshProducts() {
    await loadProductsFromAPI();
    const categories = ['all', 'desserts', 'spuds', 'pasta', 'wrap', 'appetizers'];
    categories.forEach(categoryId => {
        populateCategory(categoryId);
    });
}

// Get category items from API data
function getCategoryItems(categoryId) {
    // Map category IDs to API category names
    const categoryMap = {
        'all': null,
        'desserts': 'desserts',
        'spuds': 'spuds',
        'pasta': 'pasta',
        'wrap': 'wrap',
        'appetizers': 'appetizers'
    };
    
    const apiCategory = categoryMap[categoryId];
    
    if (categoryId === 'all') {
        return productsFromAPI.map(convertProductToMenuItem);
    }
    
    if (!apiCategory) {
        return [];
    }
    
    return productsFromAPI
        .filter(product => product.category === apiCategory)
        .map(convertProductToMenuItem);
}

// Product name to STATIC_URLS key mapping
function getProductImageKey(productName) {
    const nameMapping = {
        // Desserts
        'mais con yelo': 'maisConYelo',
        'maisconyelo': 'maisConYelo',
        'biscoff classic': 'biscoffClassic',
        'biscoff': 'biscoffClassic',
        'buko pandan': 'bukoPandan',
        'bukopandan': 'bukoPandan',
        'mango graham': 'mangoGraham',
        'mangograham': 'mangoGraham',
        'ube macapuno': 'ubeMacapuno',
        'ubemacapuno': 'ubeMacapuno',
        'rocky road': 'rockyRoad',
        'rockyroad': 'rockyRoad',
        'coffee jelly': 'coffeeJelly',
        'coffeejelly': 'coffeeJelly',
        'cookie monster': 'cookieMonster',
        'cookiemonster': 'cookieMonster',
        'dulce de leche': 'dulce_de_Leche',
        'dulcedeleche': 'dulce_de_Leche',
        'choco peanut banana': 'choco_peanut_Banana',
        'chocopeanutbanana': 'choco_peanut_Banana',
        'choco-peanut banana': 'choco_peanut_Banana',
        
        // Spuds
        'cheesy bacon': 'cheesyBacon',
        'cheesybacon': 'cheesyBacon',
        'chili con carne': 'chiliConCarne',
        'chiliconcarne': 'chiliConCarne',
        'triple cheese': 'tripleCheese',
        'triplecheese': 'tripleCheese',
        'lasagna jacket': 'lasagnaJacket',
        'lasagnajacket': 'lasagnaJacket',
        
        // Pasta/Bread
        'lasagna': 'lasagna',
        'garlic bread': 'garlicBread',
        'garlicbread': 'garlicBread',
        
        // Wrap
        'chicken wrap': 'chickenWrap',
        'chickenwrap': 'chickenWrap',
        'hongar chicken wrap': 'chickenWrap',
        'beef wrap': 'beefWrap',
        'beefwrap': 'beefWrap',
        'kesodilla': 'kesodilla',
        'quesodilla': 'kesodilla',
        
        // Appetizers
        'chicken poppers': 'chickenPoppers',
        'chickenpoppers': 'chickenPoppers',
        'nachos': 'nachos'
    };
    
    const normalizedName = productName.toLowerCase().trim();
    return nameMapping[normalizedName] || null;
}

// Convert API product format to menu item format
function convertProductToMenuItem(product) {
    const hasSizes = product.size_options && Object.keys(product.size_options).length > 0;
    
    let sizes = [];
    let priceText = '';
    
    if (hasSizes) {
        // Convert size options to sizes array
        sizes = Object.entries(product.size_options)
            .map(([size, price]) => ({
                value: size,
                price: parseFloat(price),
                checked: size === 'M' // Default to M if available
            }))
            .sort((a, b) => a.value.localeCompare(b.value)); // Sort by size (M, L)
        
        // Set first size as checked if no M
        if (sizes.length > 0 && !sizes.find(s => s.value === 'M')) {
            sizes[0].checked = true;
        }
        
        priceText = sizes.map(s => `Php ${s.price} (${s.value})`).join('  ');
    } else {
        priceText = `Php ${product.price}`;
    }
    
    // Get image URL - prioritize database image, then fallback to STATIC_URLS
    let imageUrl = '';
    
    // First priority: Use image from database if available
    if (product.image && product.image.trim() !== '') {
        imageUrl = product.image;
    } else if (typeof STATIC_URLS !== 'undefined') {
        // Second priority: Try to find matching image from STATIC_URLS based on product name
        const imageKey = getProductImageKey(product.name);
        if (imageKey && STATIC_URLS[imageKey]) {
            imageUrl = STATIC_URLS[imageKey];
        } else {
            // Third priority: Fallback to category default or menu icon
            const categoryDefaults = {
                'desserts': STATIC_URLS.dessert,
                'spuds': STATIC_URLS.spud,
                'pasta': STATIC_URLS.pasta,
                'wrap': STATIC_URLS.wrap,
                'appetizers': STATIC_URLS.appetizer
            };
            imageUrl = categoryDefaults[product.category] || STATIC_URLS.menu || '/static/orders_menupics/menu.png';
        }
    } else {
        // Last resort: Use a default
        imageUrl = '/static/orders_menupics/menu.png';
    }
    
    return {
        id: product.id,
        name: product.name,
        image: imageUrl,
        price: priceText,
        hasSizes: hasSizes,
        sizes: sizes,
        stock: product.stock || 0,
        category: product.category
    };
}


function createMenuItemCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-product-id', item.id || '');
    card.setAttribute('data-product-name', item.name);
    
    let sizesHtml = '';
    if (item.hasSizes) {
        sizesHtml = `
            <div class="size-select">
                ${item.sizes.map((size, index) => `
                    <label>
                        <input type="radio" name="${item.name.toLowerCase().replace(/\s+/g, '-')}-size" 
                               value="${size.value}" ${size.checked ? 'checked' : ''} data-size-price="${size.price}">
                        ${size.value}
                    </label>
                `).join('')}
            </div>
        `;
    }
    
    const availabilityText = item.stock > 0 ? 'Available' : 'Out of Stock';
    const availabilityClass = item.stock > 0 ? 'availability' : 'availability out-of-stock';
    
    // Ensure image URL is properly formatted - prioritize database image
    let imageSrc = item.image || '';
    
    // If no database image, try to get from STATIC_URLS
    if (!imageSrc && typeof STATIC_URLS !== 'undefined') {
        const imageKey = getProductImageKey(item.name);
        if (imageKey && STATIC_URLS[imageKey]) {
            imageSrc = STATIC_URLS[imageKey];
        } else {
            const categoryDefaults = {
                'desserts': STATIC_URLS.dessert,
                'spuds': STATIC_URLS.spud,
                'pasta': STATIC_URLS.pasta,
                'wrap': STATIC_URLS.wrap,
                'appetizers': STATIC_URLS.appetizer
            };
            imageSrc = categoryDefaults[item.category] || STATIC_URLS.menu || '/static/orders_menupics/menu.png';
        }
    } else if (!imageSrc) {
        imageSrc = '/static/orders_menupics/menu.png';
    }
    
    // Fallback image for onerror
    const fallbackImage = (typeof STATIC_URLS !== 'undefined' && STATIC_URLS.menu) ? STATIC_URLS.menu : '/static/orders_menupics/menu.png';
    const addToCartIcon = (typeof STATIC_URLS !== 'undefined' && STATIC_URLS.addToCart) ? STATIC_URLS.addToCart : '/static/orders_menupics/addtocart.png';
    
    card.innerHTML = `
        <img src="${imageSrc}" alt="${item.name}" onerror="this.src='${fallbackImage}'">
        <div class="card-body">
            <h3>${item.name}</h3>
            <div class="${availabilityClass}">${availabilityText}</div>
            ${sizesHtml}
            <div class="price">${item.price}</div>
        </div>
        <button class="add-to-cart" data-item-id="${item.id || item.name.toLowerCase().replace(/\s+/g, '-')}" ${item.stock <= 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            <img src="${addToCartIcon}" alt="Add to Cart" class="cart-icon">
        </button>
    `;
    
    return card;
}

// ========== EVENT DELEGATION FOR ADD TO CART ==========
function initializeAddToCartDelegation() {
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

// Update product stocks after order is placed
function updateProductStocks(updatedStocks) {
    // Update the productsFromAPI array with new stock values
    Object.keys(updatedStocks).forEach(productId => {
        const stockInfo = updatedStocks[productId];
        const productIndex = productsFromAPI.findIndex(p => p.id == productId);
        if (productIndex !== -1) {
            productsFromAPI[productIndex].stock = stockInfo.stock;
            productsFromAPI[productIndex].is_active = stockInfo.is_active;
            productsFromAPI[productIndex].show_in_all_menu = stockInfo.show_in_all_menu;
        }
    });
    
    // Re-render all categories with updated stock information
    const categories = ['all', 'desserts', 'spuds', 'pasta', 'wrap', 'appetizers'];
    categories.forEach(categoryId => {
        populateCategory(categoryId);
    });
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async function() {
    loadCartFromStorage();
    const savedDeliveryLocation = loadDeliveryLocation();
    if (savedDeliveryLocation && savedDeliveryLocation.address) {
        selectedDeliveryLocation = savedDeliveryLocation;
        updateTopbarLocation(savedDeliveryLocation.address);
    } else {
        updateTopbarLocation('');
    }

    // Wire UI first so the page stays usable even if the products API is slow or hangs.
    initializeLocationModal();
    initializePaymentMethods();
    initializeSidebarNavigation();
    initializeAddToCartDelegation();

    if (elements.ordersButton) {
        elements.ordersButton.addEventListener('click', toggleBillingPanel);
    }

    if (elements.billingClose) {
        elements.billingClose.addEventListener('click', function(e) {
            e.stopPropagation();
            closeBillingPanel();
        });
    }

    document.addEventListener('click', function(e) {
        if (elements.billingPanel.classList.contains('open') &&
            !elements.billingPanel.contains(e.target) &&
            e.target !== elements.ordersButton &&
            !e.target.closest('.quantity-btn') &&
            !e.target.closest('.remove-btn')) {
            closeBillingPanel();
        }
    });

    document.querySelectorAll('.order-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.order-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            if (this.dataset.type === 'delivery' && selectedDeliveryLocation) {
                calculateDeliveryFee(selectedDeliveryLocation);
            } else if (this.dataset.type !== 'delivery') {
                deliveryCharge = 0;
            }
            updateBillingPanel();
            updatePaymentMethodsBasedOnOrderType();
        });
    });

    const processOrderBtn = document.querySelector('.process-order');
    if (processOrderBtn) {
        processOrderBtn.addEventListener('click', processOrder);
    }

    const dineInBtn = document.querySelector('.order-btn[data-type="dine-in"]');
    if (dineInBtn) {
        dineInBtn.classList.add('active');
    }
    updatePaymentMethodsBasedOnOrderType();

    await loadProductsFromAPI();

    const categories = ['all', 'desserts', 'spuds', 'pasta', 'wrap', 'appetizers'];
    categories.forEach(categoryId => {
        populateCategory(categoryId);
    });
});

// Helper function to get order data
function getOrderData() {
    let orderData = localStorage.getItem('currentOrder');
    
    if (orderData) {
        try {
            return JSON.parse(orderData);
        } catch (e) {
            console.error('Error parsing order data from localStorage:', e);
        }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get('order');
    
    if (orderParam) {
        try {
            return JSON.parse(decodeURIComponent(orderParam));
        } catch (e) {
            console.error('Error parsing order data from URL:', e);
        }
    }
    
    return null;
}



