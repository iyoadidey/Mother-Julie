// Order Management System
let cart = [];
let orderCount = 0;
const deliveryCharge = 50;

// DOM Elements
const elements = {
    ordersButton: document.getElementById('ordersButton'),
    billingPanel: document.getElementById('billingPanel'),
    billingClose: document.getElementById('billingClose'),
    billingItems: document.getElementById('billingItems'),
    locationModal: document.getElementById('locationModal'),
    modalClose: document.getElementById('modalClose')
};


// Redirect to dashboard using Django URL pattern
function redirectToDashboard() {
    window.location.href = '/dashboard/';  // Use the URL pattern from your urls.py
}

// Category Management
function showCategory(category) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const clickedItem = document.querySelector(`[data-target="${category}"]`);
    if (clickedItem) clickedItem.classList.add('active');
    
    // Update content
    document.querySelectorAll('.category').forEach(cat => {
        cat.classList.remove('active');
    });
    
    const targetCategory = category === 'all' ? 
        document.getElementById('all') : 
        document.getElementById(category);
        
    if (targetCategory) targetCategory.classList.add('active');
    
    updatePageTitle(category);
}

// Billing Panel Functions
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
        deliveryFeeRow.style.display = 'flex'; // or 'block' depending on your CSS
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
        // Apply delivery fee only for delivery orders
        const total = orderType === 'Delivery' ? deliveryCharge : 0;
        totalElement.textContent = `Php ${total.toFixed(2)}`;
        return;
    }
    
    let subtotal = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'b-item';
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="b-item-image">
            <div class="b-item-content">
                <div class="b-item-header">
                    <div class="b-item-info">
                        <div class="b-title">${item.name} ${item.size ? `(${item.size})` : ''}</div>
                        <div class="b-meta">Php ${item.price.toFixed(2)} each</div>
                    </div>
                    <div class="b-item-price">Php ${item.price.toFixed(2)}</div>
                </div>
                
                <div class="b-item-controls">
                    <div class="quantity-section">
                        <button class="quantity-btn minus" onclick="updateQuantity(${index}, -1)" title="Decrease quantity">-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn plus" onclick="updateQuantity(${index}, 1)" title="Increase quantity">+</button>
                    </div>
                    
                    <div class="delete-section">
                        <button class="remove-item" onclick="removeFromCart(${index})" title="Remove item">✕</button>
                    </div>
                </div>
                
                <div class="b-item-total">
                    <div class="item-total-label">Item Total:</div>
                    <div class="item-total-price">Php ${itemTotal.toFixed(2)}</div>
                </div>
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

// Cart Functions
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
            alert('Please select a size');
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
    }
}

function updateOrdersCount() {
    const ordersCountElement = document.querySelector('.orders-count');
    ordersCountElement.textContent = orderCount;
    
    // Add animation
    ordersCountElement.style.transform = 'scale(1.2)';
    setTimeout(() => {
        ordersCountElement.style.transform = 'scale(1)';
    }, 300);
}

function processOrder() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    const orderType = document.querySelector('.order-btn.active').textContent;
    const total = document.querySelector('.total').textContent;
    
    alert(`Order placed successfully!\nOrder Type: ${orderType}\nTotal: ${total}\n\nThank you for your order!`);
    
    // Clear cart
    cart = [];
    orderCount = 0;
    updateOrdersCount();
    updateBillingPanel();
    closeBillingPanel();
}

// Page Title Management
// Page Title Management
function updatePageTitle(category) {
    const titleMap = {
        'all': 'ALL MENU',
        'desserts': 'DESSERTS',
        'spuds': 'SPUDS',
        'pasta': 'PASTA / BREAD',
        'wrap': 'WRAP',
        'appetizers': 'APPETIZERS'
    };
    
    const imageMap = {
        'all': STATIC_URLS.menu,
        'desserts': STATIC_URLS.dessert,
        'spuds': STATIC_URLS.spud,
        'pasta': STATIC_URLS.pasta,
        'wrap': STATIC_URLS.wrap,
        'appetizers': STATIC_URLS.nachos
    };
    
    // Update page title
    const pageTitle = document.querySelector('.topbar-center h1');
    if (titleMap[category] && pageTitle) {
        pageTitle.textContent = titleMap[category];
    }
    
    // Update main image
    const mainImage = document.querySelector('.title-logo');
    if (imageMap[category] && mainImage) {
        mainImage.src = imageMap[category];
        mainImage.alt = titleMap[category] + ' Image';
    }

}

// Location Modal Functions
function initializeLocationModal() {
    const locationModal = document.getElementById('locationModal');
    const locationInput = document.getElementById('locationInput');
    const searchBtn = document.getElementById('searchBtn');
    const suggestions = document.getElementById('suggestions');
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    const locationError = document.getElementById('locationError');

    const philippineLocations = ["Manila", "Quezon City", "Makati", "Taguig", "Pasig", "Mandaluyong", "San Juan", "Pasay", "Parañaque", "Las Piñas", "Muntinlupa", "Marikina", "Caloocan", "Valenzuela", "Malabon", "Navotas"];

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
        
        const filtered = philippineLocations.filter(location => 
            location.toLowerCase().includes(query)
        );
        
        if (filtered.length === 0) {
            suggestions.innerHTML = '<div class="suggestion-item">No locations found in Philippines</div>';
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
    }

    currentLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showError('Geolocation is not supported by your browser');
            return;
        }
        
        currentLocationBtn.textContent = '📍 Getting Location...';
        currentLocationBtn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                if (isInPhilippines(lat, lng)) {
                    const city = getNearestPhilippineCity(lat, lng);
                    document.querySelector('.location .loc-text').textContent = city;
                    locationModal.style.display = 'none';
                    clearError();
                } else {
                    showError('Location outside Philippines. Please search for Philippine locations only.');
                }
                
                currentLocationBtn.textContent = '📍 Use Current Location';
                currentLocationBtn.disabled = false;
            },
            (error) => {
                showError('Unable to retrieve your location. Please search manually.');
                currentLocationBtn.textContent = '📍 Use Current Location';
                currentLocationBtn.disabled = false;
            }
        );
    });

    function isInPhilippines(lat, lng) {
        const phBounds = { north: 21.5, south: 4.0, west: 116.0, east: 127.0 };
        return lat >= phBounds.south && lat <= phBounds.north && lng >= phBounds.west && lng <= phBounds.east;
    }

    function getNearestPhilippineCity(lat, lng) {
        if (lat > 14.5 && lng > 120.9) return "Manila";
        if (lat > 10.3 && lng < 124.0) return "Cebu City";
        if (lat < 7.5 && lng > 125.5) return "Davao City";
        if (lat > 16.4) return "Baguio";
        return "Metro Manila";
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

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with all menu
    showCategory('all');
    
    // Navigation events
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            showCategory(target);
        });
    });

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
            updateBillingPanel(); // Update totals when order type changes
        });
    });

    // Process order
    document.querySelector('.process-order').addEventListener('click', processOrder);

    // Set default order type
    document.querySelector('.order-btn').classList.add('active');

    // Initialize location modal
    initializeLocationModal();
});