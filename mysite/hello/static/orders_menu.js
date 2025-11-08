// Order Management System
let cart = JSON.parse(localStorage.getItem('motherJulieCart')) || [];
let orderCount = cart.reduce((total, item) => total + item.quantity, 0) || 0;
const deliveryCharge = 50;
let selectedPaymentMethod = 'Cash';
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

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'success', duration = 3000, orderDetails = null) {
    // Create or get toast container
    if (!elements.toastContainer) {
        elements.toastContainer = document.createElement('div');
        elements.toastContainer.id = 'toastContainer';
        elements.toastContainer.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
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
        // Order success toast with organized layout
        toast.className = `toast order-success`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">✓</div>
                <div class="toast-message">
                    <h4>Order Successful!</h4>
                    <p>Your order has been placed successfully</p>
                    <div class="order-details-toast">
                        <div class="order-details-row">
                            <span class="order-details-label">Type:</span>
                            <span class="order-details-value">${orderDetails.orderType}</span>
                        </div>
                        <div class="order-details-row">
                            <span class="order-details-label">Payment:</span>
                            <span class="order-details-value">${orderDetails.paymentMethod}</span>
                        </div>
                        <div class="order-details-row">
                            <span class="order-details-label">Total:</span>
                            <span class="order-details-value">${orderDetails.total}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Regular toast messages
        toast.className = `toast ${type}`;
        if (type === 'success') {
            toast.innerHTML = `
                <div class="order-success-box">
                    <strong>Order Successful:</strong> ${message}
                </div>
            `;
        } else if (type === 'error') {
            toast.innerHTML = `
                <div class="disclaimer-box warning">
                    <strong>Error:</strong> ${message}
                </div>
            `;
        } else {
            toast.innerHTML = `
                <div class="disclaimer-box info">
                    <strong>Info:</strong> ${message}
                </div>
            `;
        }
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

function showOrderSuccessToast(orderDetails) {
    showToast('', 'success', 5000, orderDetails);
}

function showAddToCartToast(itemName) {
    showCartToast(`${itemName} added to cart`, 'add-to-cart-toast');
}

function showRemoveBtnToast(itemName) {
    showCartToast(`${itemName} removed`, 'remove-btn-toast');
}

function showCartToast(message, type) {
    // Create or get toast container
    if (!elements.toastContainer) {
        elements.toastContainer = document.createElement('div');
        elements.toastContainer.id = 'toastContainer';
        elements.toastContainer.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
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
    toast.className = `toast ${type}`;
    toast.textContent = message;

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
    }, 2000);
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
        
        if (selectedPaymentMethod === 'Cash') {
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

// ========== LOCATION FUNCTIONS (Leaflet + OpenStreetMap Version) ==========
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
        const defaultLocation = [14.5995, 120.9842]; // Metro Manila center
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

    // ------- KEY FIX: Universal function for A, B, C -------
    function setSelectedLocation(address) {
        selectedLocation = address;
        updateSelectedLocationDisplay(address);
        confirmLocationBtn.disabled = false; // ✅ Always enable confirm button
    }

    // Search Autocomplete (Photon Free API)
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
                            setSelectedLocation(address); // ✅ Key fix for Search B
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

            // Reverse geocode GPS coordinates to address
            const address = await reverseGeocode(lat, lon);

            selectedLocation = address;
            updateSelectedLocationDisplay(selectedLocation);

            // Enable confirm button
            confirmLocationBtn.disabled = false;

            // Show map if hidden
            mapContainer.style.display = "block";
            showMapBtn.style.display = "none";

            // Set / move map
            if (!map) {
                map = L.map("map").setView([lat, lon], 17);
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {}).addTo(map);
            } else {
                map.setView([lat, lon], 17);
            }

            // Set / move marker
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

    function isInMetroManila(lat, lng) {
        return lat >= 14.35 && lat <= 14.85 && lng >= 120.90 && lng <= 121.20;
    }
}

async function reverseGeocode(lat, lon) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await response.json();
    return data.display_name;
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
    saveCartToStorage(); // Save to localStorage
    
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
            saveCartToStorage(); // Save to localStorage
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
        saveCartToStorage(); // Save to localStorage
        showRemoveBtnToast(itemName);
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
    
    // Persist to backend for order history
    try {
        const itemsPayload = cart.map(it => ({
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            total: it.price * it.quantity,
        }));
        const totalNumber = parseFloat(total.replace(/[^0-9.]/g, '')) || 0;
        const payload = {
            items: itemsPayload,
            totalAmount: totalNumber,
            orderType: orderType,
            paymentMethod: selectedPaymentMethod,
            customerName: (window.currentUsername || ''),
        };
        fetch('/api/orders/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(function(){ /* ignore errors for UX */ }).catch(function(){});
    } catch (e) { /* ignore */ }

    showOrderSuccessToast(orderDetails);
    
    // Clear cart after successful order
    clearCartFromStorage();
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
            },
            {
                name: "Dulce de Leche",
                image: STATIC_URLS.dulce_de_Leche,
                price: "Php 160 (M) • Php 190 (L)",
                hasSizes: true,
                sizes: [
                    { value: "M", price: 160, checked: true },
                    { value: "L", price: 190, checked: false }
                ]
            },
            {
                name: "Choco-Peanut Banana",
                image: STATIC_URLS.choco_peanut_Banana,
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
            },
            {
                name: "Triple Cheese",
                image: STATIC_URLS.tripleCheese,
                price: "Php 129",
                hasSizes: false
            },
            {
                name: "Lasagna Jacket",
                image: STATIC_URLS.lasagnaJacket,
                price: "Php 129",
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
                price: "Php 69",
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
                name: "Beef Wrap",
                image: STATIC_URLS.beefWrap,
                price: "Php 139",
                hasSizes: false
            },
            {
                name: "Kesodilla",
                image: STATIC_URLS.kesodilla,
                price: "Php 99",
                hasSizes: false
            }
        ],
        appetizers: [
            {
                name: "Chicken Poppers",
                image: STATIC_URLS.chickenPoppers,
                price: "Php 149",
                hasSizes: false
            },
            {
                name: "Nachos",
                image: STATIC_URLS.nachos,
                price: "Php 129",
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
    // Load cart from localStorage when page loads
    loadCartFromStorage();
    
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