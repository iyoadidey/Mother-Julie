// Order Management System
let cart = JSON.parse(localStorage.getItem('motherJulieCart')) || [];
let orderCount = cart.reduce((total, item) => total + item.quantity, 0) || 0;
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

// ========== CART PERSISTENCE FUNCTIONS ==========
function saveCartToStorage() {
    localStorage.setItem('motherJulieCart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('motherJulieCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        orderCount = cart.reduce((total, item) => total + item.quantity, 0);
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

// ========== MINIMALIST TOAST NOTIFICATIONS ==========
function showToast(message, type = 'success', duration = 3000) {
    console.log('🔴 DEBUG: showToast called - message:', message, 'type:', type, 'duration:', duration);
    
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
    const paymentMethodSection = document.querySelector('.payment-method');
    
    const existingMessages = paymentMethodSection.querySelectorAll('.disclaimer-box');
    existingMessages.forEach(message => message.remove());
    
    if (orderType === 'pickup' || orderType === 'delivery') {
        cashPaymentBtn.classList.add('disabled');
        cashPaymentBtn.disabled = true;
        
        const message = document.createElement('div');
        message.className = 'disclaimer-box warning';
        message.innerHTML = `<strong>Payment Notice:</strong> Online payment (GCash or Bank Transfer) is required for ${orderType} orders. Cash payment is only available for dine-in orders.`;
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

// ========== PAYMENT VERIFICATION FUNCTIONS ==========
async function verifyGCashPayment() {
    const gcashNumber = document.getElementById('gcashNumber')?.value.trim();
    const gcashName = document.getElementById('gcashName')?.value.trim();
    
    if (!gcashNumber || !gcashName) {
        showToast('Please fill in all GCash details', 'error');
        return false;
    }
    
    // Enhanced GCash number validation
    if (!/^(09|\+639)\d{9}$/.test(gcashNumber)) {
        showToast('Please enter a valid GCash number (09XXXXXXXXX)', 'error');
        return false;
    }
    
    // Name validation
    if (gcashName.length < 2) {
        showToast('Please enter a valid name', 'error');
        return false;
    }
    
    showToast('Verifying GCash payment...', 'info');
    
    try {
        // Simulate API call to GCash verification service
        const verificationResult = await simulateGCashVerification(gcashNumber, gcashName);
        
        if (verificationResult.success) {
            // Save verified GCash details
            saveVerifiedGCashDetails({
                number: gcashNumber,
                name: gcashName,
                verifiedAt: new Date().toISOString(),
                reference: verificationResult.reference
            });
            
            showToast('GCash payment verified successfully!', 'success');
            updatePaymentStatus('verified');
            return true;
        } else {
            showToast(verificationResult.message || 'GCash verification failed', 'error');
            return false;
        }
    } catch (error) {
        console.error('GCash verification error:', error);
        showToast('Verification service temporarily unavailable', 'error');
        return false;
    }
}

async function simulateGCashVerification(gcashNumber, gcashName) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate different verification scenarios
            const random = Math.random();
            
            if (random < 0.8) {
                // 80% success rate
                resolve({
                    success: true,
                    message: 'GCash account verified',
                    reference: 'GC' + Date.now().toString().slice(-8),
                    accountName: gcashName.toUpperCase(),
                    number: gcashNumber
                });
            } else if (random < 0.9) {
                // 10% invalid number
                resolve({
                    success: false,
                    message: 'Invalid GCash number or account not found'
                });
            } else {
                // 10% insufficient balance
                resolve({
                    success: false,
                    message: 'Insufficient balance in GCash account'
                });
            }
        }, 2000); // Simulate 2-second API call
    });
}

function saveVerifiedGCashDetails(details) {
    // Save to localStorage for order processing
    localStorage.setItem('verifiedGCashPayment', JSON.stringify(details));
    
    // Update UI to show verified status
    const gcashForm = document.querySelector('.gcash-form');
    if (gcashForm) {
        gcashForm.classList.add('verified');
        
        // Add verified badge
        const existingBadge = gcashForm.querySelector('.verified-badge');
        if (!existingBadge) {
            const verifiedBadge = document.createElement('div');
            verifiedBadge.className = 'verified-badge';
            verifiedBadge.innerHTML = `
                <span class="verified-icon">✓</span>
                Verified - ${details.number}
            `;
            gcashForm.appendChild(verifiedBadge);
        }
        
        // Disable input fields after verification
        const inputs = gcashForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = true;
            input.style.backgroundColor = '#f8fff9';
        });
        
        // Update verify button
        const verifyBtn = document.getElementById('verifyGCash');
        if (verifyBtn) {
            verifyBtn.textContent = 'Verified';
            verifyBtn.disabled = true;
            verifyBtn.style.backgroundColor = '#28a745';
        }
        
        // Add clear verification button
        addClearVerificationButtons();
    }
}

async function verifyBankPayment() {
    const referenceNumber = document.getElementById('referenceNumber')?.value.trim();
    const senderName = document.getElementById('senderName')?.value.trim();
    const amount = document.querySelector('.total')?.textContent.replace(/[^0-9.]/g, '');
    
    if (!referenceNumber || !senderName) {
        showToast('Please fill in all bank details', 'error');
        return false;
    }
    
    if (referenceNumber.length < 6) {
        showToast('Please enter a valid reference number', 'error');
        return false;
    }
    
    if (senderName.length < 2) {
        showToast('Please enter sender name', 'error');
        return false;
    }
    
    showToast('Verifying bank transfer...', 'info');
    
    try {
        const verificationResult = await simulateBankVerification(
            referenceNumber, 
            senderName, 
            amount, 
            selectedBank
        );
        
        if (verificationResult.success) {
            saveVerifiedBankDetails({
                reference: referenceNumber,
                senderName: senderName,
                bank: selectedBank,
                amount: amount,
                verifiedAt: new Date().toISOString(),
                transactionId: verificationResult.transactionId
            });
            
            showToast('Bank transfer verified successfully!', 'success');
            updatePaymentStatus('verified');
            return true;
        } else {
            showToast(verificationResult.message || 'Bank transfer verification failed', 'error');
            return false;
        }
    } catch (error) {
        console.error('Bank verification error:', error);
        showToast('Verification service temporarily unavailable', 'error');
        return false;
    }
}

async function simulateBankVerification(referenceNumber, senderName, amount, bank) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const random = Math.random();
            
            if (random < 0.85) {
                resolve({
                    success: true,
                    message: 'Bank transfer verified',
                    transactionId: 'BT' + Date.now().toString().slice(-8),
                    reference: referenceNumber,
                    bank: bank,
                    amount: amount
                });
            } else if (random < 0.92) {
                resolve({
                    success: false,
                    message: 'Reference number not found'
                });
            } else if (random < 0.96) {
                resolve({
                    success: false,
                    message: 'Amount does not match'
                });
            } else {
                resolve({
                    success: false,
                    message: 'Bank transfer is still processing'
                });
            }
        }, 2500);
    });
}

function saveVerifiedBankDetails(details) {
    localStorage.setItem('verifiedBankPayment', JSON.stringify(details));
    
    const bankForm = document.querySelector('.bank-form');
    if (bankForm) {
        bankForm.classList.add('verified');
        
        const existingBadge = bankForm.querySelector('.verified-badge');
        if (!existingBadge) {
            const verifiedBadge = document.createElement('div');
            verifiedBadge.className = 'verified-badge';
            verifiedBadge.innerHTML = `
                <span class="verified-icon">✓</span>
                Verified - Ref: ${details.reference}
            `;
            bankForm.appendChild(verifiedBadge);
        }
        
        const inputs = bankForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = true;
            input.style.backgroundColor = '#f8fff9';
        });
        
        const verifyBtn = document.getElementById('verifyBank');
        if (verifyBtn) {
            verifyBtn.textContent = 'Verified';
            verifyBtn.disabled = true;
            verifyBtn.style.backgroundColor = '#28a745';
        }
        
        // Add clear verification button
        addClearVerificationButtons();
    }
}

function updatePaymentStatus(status) {
    const paymentData = {
        method: selectedPaymentMethod,
        status: status,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('paymentVerificationStatus', JSON.stringify(paymentData));
    
    // Enable order processing if payment is verified
    if (status === 'verified') {
        const processOrderBtn = document.querySelector('.process-order');
        if (processOrderBtn) {
            processOrderBtn.disabled = false;
        }
    }
}

function checkExistingGCashVerification() {
    const verifiedPayment = localStorage.getItem('verifiedGCashPayment');
    const paymentStatus = localStorage.getItem('paymentVerificationStatus');
    
    if (verifiedPayment && paymentStatus) {
        try {
            const paymentData = JSON.parse(verifiedPayment);
            const statusData = JSON.parse(paymentStatus);
            
            // Check if verification is still valid (less than 1 hour old)
            const verificationTime = new Date(statusData.timestamp);
            const currentTime = new Date();
            const hoursDiff = (currentTime - verificationTime) / (1000 * 60 * 60);
            
            if (hoursDiff < 1 && statusData.status === 'verified') {
                restoreVerifiedGCashUI(paymentData);
                return true;
            } else {
                // Clear expired verification
                clearGCashVerification();
            }
        } catch (error) {
            console.error('Error restoring GCash verification:', error);
            clearGCashVerification();
        }
    }
    
    return false;
}

function restoreVerifiedGCashUI(details) {
    const gcashForm = document.querySelector('.gcash-form');
    if (!gcashForm) return;
    
    // Populate fields
    const gcashNumber = document.getElementById('gcashNumber');
    const gcashName = document.getElementById('gcashName');
    
    if (gcashNumber) gcashNumber.value = details.number;
    if (gcashName) gcashName.value = details.name;
    
    // Apply verified styling
    saveVerifiedGCashDetails(details);
}

function clearGCashVerification() {
    localStorage.removeItem('verifiedGCashPayment');
    localStorage.removeItem('paymentVerificationStatus');
    
    const gcashForm = document.querySelector('.gcash-form');
    if (gcashForm) {
        gcashForm.classList.remove('verified');
        
        // Remove verified badge
        const verifiedBadge = gcashForm.querySelector('.verified-badge');
        if (verifiedBadge) {
            verifiedBadge.remove();
        }
        
        // Re-enable input fields
        const inputs = gcashForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = false;
            input.style.backgroundColor = '';
        });
        
        // Reset verify button
        const verifyBtn = document.getElementById('verifyGCash');
        if (verifyBtn) {
            verifyBtn.textContent = 'Verify GCash';
            verifyBtn.disabled = false;
            verifyBtn.style.backgroundColor = '';
        }
        
        // Remove clear button
        const clearBtn = gcashForm.querySelector('.clear-verification');
        if (clearBtn) {
            clearBtn.remove();
        }
    }
    
    showToast('GCash verification cleared', 'info');
}

function clearBankVerification() {
    localStorage.removeItem('verifiedBankPayment');
    
    const bankForm = document.querySelector('.bank-form');
    if (bankForm) {
        bankForm.classList.remove('verified');
        
        const verifiedBadge = bankForm.querySelector('.verified-badge');
        if (verifiedBadge) {
            verifiedBadge.remove();
        }
        
        const inputs = bankForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = false;
            input.style.backgroundColor = '';
        });
        
        const verifyBtn = document.getElementById('verifyBank');
        if (verifyBtn) {
            verifyBtn.textContent = 'Verify Transfer';
            verifyBtn.disabled = false;
            verifyBtn.style.backgroundColor = '';
        }
        
        // Remove clear button
        const clearBtn = bankForm.querySelector('.clear-verification');
        if (clearBtn) {
            clearBtn.remove();
        }
    }
    
    showToast('Bank verification cleared', 'info');
}

function initializePaymentVerification() {
    // Check for existing verifications on page load
    checkExistingGCashVerification();
}

function addClearVerificationButtons() {
    // Add to GCash form if verified and button doesn't exist
    const gcashForm = document.querySelector('.gcash-form.verified');
    if (gcashForm && !gcashForm.querySelector('.clear-verification')) {
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'clear-verification';
        clearBtn.innerHTML = `
            <span class="clear-icon">↻</span>
            Clear Verification
        `;
        clearBtn.onclick = clearGCashVerification;
        gcashForm.appendChild(clearBtn);
    }
    
    // Add to Bank form if verified and button doesn't exist
    const bankForm = document.querySelector('.bank-form.verified');
    if (bankForm && !bankForm.querySelector('.clear-verification')) {
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'clear-verification';
        clearBtn.innerHTML = `
            <span class="clear-icon">↻</span>
            Clear Verification
        `;
        clearBtn.onclick = clearBankVerification;
        bankForm.appendChild(clearBtn);
    }
}

async function checkPaymentVerification() {
    // Payment verification disabled for testing - all payment methods allowed
    return true;
    
    // Original verification code (disabled):
    // if (selectedPaymentMethod === 'gcash') {
    //     const verifiedPayment = localStorage.getItem('verifiedGCashPayment');
    //     return !!verifiedPayment;
    // } else if (selectedPaymentMethod === 'bank') {
    //     const verifiedPayment = localStorage.getItem('verifiedBankPayment');
    //     return !!verifiedPayment;
    // }
    // return true; // Cash payments don't need verification
}

function getVerifiedPaymentDetails() {
    if (selectedPaymentMethod === 'gcash') {
        const payment = localStorage.getItem('verifiedGCashPayment');
        return payment ? JSON.parse(payment) : null;
    } else if (selectedPaymentMethod === 'bank') {
        const payment = localStorage.getItem('verifiedBankPayment');
        return payment ? JSON.parse(payment) : null;
    }
    
    return null;
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
    
    // Initialize payment verification
    initializePaymentVerification();
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
    
    showToast(`✓ ${itemName} added`, 'success');
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
        showToast(`🗑️ ${itemName} removed`, 'info');
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
    const orderType = document.querySelector('.order-btn.active').dataset.type;
    
    elements.billingItems.innerHTML = '';
    
    if (orderType === 'delivery') {
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
                <button class="quantity-btn minus" data-index="${index}">-</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-btn plus" data-index="${index}">+</button>
                <button class="remove-btn" data-index="${index}">✕</button>
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
    
    // Payment verification disabled for testing
    // Orders can be placed without verification
    // if (selectedPaymentMethod !== 'cash') {
    //     const isVerified = await checkPaymentVerification();
    //     if (!isVerified) {
    //         showToast('Please verify your payment first', 'error');
    //         return;
    //     }
    // }
    
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
        paymentVerified: selectedPaymentMethod !== 'cash',
        paymentDetails: selectedPaymentMethod !== 'cash' ? 
            getVerifiedPaymentDetails() : null
    };
    
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
    console.log('🔴 DEBUG: handleSuccessfulOrder STARTED');
    console.log('🔴 DEBUG: orderId=', orderId, 'orderType=', orderType, 'total=', total);
    
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
    
    console.log('🟡 DEBUG: About to show PROCESSING toast');
    showToast('Processing your order...', 'info', 2000);
    
    console.log('🟡 DEBUG: Setting 2-second timeout for SUCCESS toast');
    setTimeout(() => {
        console.log('🟢 DEBUG: 2-second timeout FIRED');
        
        const successMessage = getMinimalSuccessMessage(orderType, selectedPaymentMethod);
        console.log('🟢 DEBUG: successMessage =', successMessage);
        
        console.log('🟢 DEBUG: About to show SUCCESS toast');
        showToast(successMessage, 'success', 3000);
        
        setTimeout(() => {
            console.log('🔵 DEBUG: Redirect timeout fired');
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
    console.log('🔴 DEBUG: redirectToOrderPage called - orderType:', orderType, 'orderId:', orderId);
    
    if (orderType === 'delivery') {
        console.log('🟢 DEBUG: Redirecting to DELIVERY page');
        window.location.href = `/delivery/?orderId=${orderId}`;
    } else if (orderType === 'pickup') {
        console.log('🟢 DEBUG: Redirecting to PICKUP page');
        window.location.href = `/pick_up/?orderId=${orderId}`;
    } else {
        console.log('🟡 DEBUG: Dine-in order - staying on current page');
        // Dine-in stays on the same page
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
    
    // Method 2: From cookie
    if (!csrfToken) {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        if (cookieValue) {
            csrfToken = cookieValue;
        }
    }
    
    // Method 3: From meta tag
    if (!csrfToken) {
        const metaToken = document.querySelector('meta[name="csrf-token"]');
        if (metaToken) {
            csrfToken = metaToken.getAttribute('content');
        }
    }
    
    return csrfToken;
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
    const selectedLocationDisplay = document.getElementById('selectedLocationDisplay');

    let map = null;
    let marker = null;
    let isMapVisible = false;
    let selectedLocation = null;

    // Open modal
    document.querySelector('.location-search').addEventListener('click', () => {
        locationModal.style.display = 'flex';
        locationInput.focus();
    });

    const modalClose = document.getElementById('modalClose');
    const cancelLocationBtn = document.getElementById('cancelLocationBtn');

    modalClose.addEventListener('click', () => closeModal());
    cancelLocationBtn.addEventListener('click', () => closeModal());

    locationModal.addEventListener('click', (e) => {
        if (e.target === locationModal) closeModal();
    });

    function closeModal() {
        locationModal.style.display = 'none';
        resetModal();
    }

    // Show/Hide Map
    showMapBtn.addEventListener('click', () => {
        isMapVisible = !isMapVisible;
        mapContainer.classList.toggle('active', isMapVisible);

        if (isMapVisible) {
            showMapBtn.classList.add("active");
            showMapBtn.textContent = "🗺️ Hide Map";
            if (!map) initMap();
        } else {
            showMapBtn.classList.remove("active");
            showMapBtn.textContent = "🗺️ Show Map";
        }
    });

    // Initialize Map (Leaflet)
    function initMap() {
        const defaultLocation = [14.5995, 120.9842];
        map = L.map('map').setView(defaultLocation, 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: "© OpenStreetMap contributors"
        }).addTo(map);

        map.on('click', (e) => {
            placeMarker(e.latlng.lat, e.latlng.lng);
            reverseGeocode(e.latlng.lat, e.latlng.lng).then(address => {
                setSelectedLocation(address);
            });
        });
    }

    function placeMarker(lat, lng) {
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            marker.on("dragend", () => {
                const pos = marker.getLatLng();
                reverseGeocode(pos.lat, pos.lng).then(address => {
                    setSelectedLocation(address);
                });
            });
        }
        map.setView([lat, lng], 15);
    }

    // Reverse Geocode to Address
    function reverseGeocode(lat, lng) {
        return fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
            .then(res => res.json())
            .then(data => data.display_name || "Pinned Location")
            .catch(() => "Unknown Location");
    }

    function setSelectedLocation(address) {
        selectedLocation = address;
        updateSelectedLocationDisplay(address);
        confirmLocationBtn.disabled = false;
    }

    // Search Autocomplete
    function searchLocations() {
        const query = locationInput.value.trim();
        if (!query) return suggestions.classList.remove('active');

        fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`)
            .then(res => res.json())
            .then(data => {
                suggestions.innerHTML = "";
                suggestions.classList.add('active');

                data.features.forEach(loc => {
                    const place = document.createElement('div');
                    place.className = "suggestion-item";

                    const name = loc.properties.name || "";
                    const city = loc.properties.city || "";
                    const country = loc.properties.country || "";
                    const finalName = `${name}, ${city}, ${country}`.replace(/, ,/g, ",");

                    place.textContent = finalName;

                    place.addEventListener('click', () => {
                        const lat = loc.geometry.coordinates[1];
                        const lng = loc.geometry.coordinates[0];
                        placeMarker(lat, lng);

                        reverseGeocode(lat, lng).then(address => {
                            locationInput.value = address;
                            setSelectedLocation(address);
                        });

                        suggestions.classList.remove('active');
                    });

                    suggestions.appendChild(place);
                });
            });
    }

    currentLocationBtn.addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                const address = await reverseGeocode(lat, lon);
                selectedLocation = address;
                updateSelectedLocationDisplay(selectedLocation);
                confirmLocationBtn.disabled = false;

                mapContainer.style.display = "block";
                showMapBtn.style.display = "none";

                if (!map) {
                    map = L.map("map").setView([lat, lon], 17);
                    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {}).addTo(map);
                } else {
                    map.setView([lat, lon], 17);
                }

                if (marker) map.removeLayer(marker);
                marker = L.marker([lat, lon]).addTo(map);

            }, () => {
                alert("Failed to get current location.");
            });
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    });

    // Confirm Button
    confirmLocationBtn.addEventListener('click', () => {
        if (!selectedLocation) return showError("Select location first");
        document.querySelector('.location .loc-text').textContent = selectedLocation;
        closeModal();
        showToast(`Location set to ${selectedLocation}`, "success");
    });

    searchBtn.addEventListener('click', searchLocations);
    locationInput.addEventListener('input', searchLocations);

    function updateSelectedLocationDisplay(location) {
        selectedLocationDisplay.innerHTML = `<p><strong>Selected:</strong> ${location}</p>`;
        selectedLocationDisplay.classList.add('active');
    }

    function showError(msg) {
        locationError.textContent = msg;
        locationError.classList.add('active');
    }

    function resetModal() {
        selectedLocation = null;
        suggestions.classList.remove('active');
        locationInput.value = "";
        confirmLocationBtn.disabled = true;
        selectedLocationDisplay.classList.remove('active');
    }
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
            'pasta': 'PASTA / BREAD',
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
        'pasta': 'PASTA / BREAD',
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
        const response = await fetch('/api/products/public/');
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
        showToast('Failed to load products. Please refresh the page.', 'error');
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
        
        priceText = sizes.map(s => `Php ${s.price} (${s.value})`).join(' • ');
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
    
    // Load products from API first
    await loadProductsFromAPI();
    
    // Populate all categories with products from API
    const categories = ['all', 'desserts', 'spuds', 'pasta', 'wrap', 'appetizers'];
    categories.forEach(categoryId => {
        populateCategory(categoryId);
    });
    
    initializeLocationModal();
    initializePaymentMethods();
    initializeSidebarNavigation();
    initializeAddToCartDelegation();

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
            e.target !== elements.ordersButton &&
            !e.target.closest('.quantity-btn') &&
            !e.target.closest('.remove-btn')) {
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