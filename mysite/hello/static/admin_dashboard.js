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
        let orders = [];
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
            
            // Initialize empty orders
            orders = [];
            activeOrders = [];
            
            renderAllProductsByCategory();
            renderOrders();
            updateAnalytics();
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
                    // Get date from 7 days ago
                    const weekAgo = new Date(now);
                    weekAgo.setDate(now.getDate() - 7);
                    return `${(weekAgo.getMonth() + 1).toString().padStart(2, '0')}/${weekAgo.getDate().toString().padStart(2, '0')}/${weekAgo.getFullYear().toString().slice(-2)}`;
                case 'monthly':
                    // Get date from 30 days ago
                    const monthAgo = new Date(now);
                    monthAgo.setDate(now.getDate() - 30);
                    return `${(monthAgo.getMonth() + 1).toString().padStart(2, '0')}/${monthAgo.getDate().toString().padStart(2, '0')}/${monthAgo.getFullYear().toString().slice(-2)}`;
                case 'yearly':
                    // Get date from 365 days ago
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
            
            // Validate price (must be whole number starting from 1)
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
        
        // Render orders to the tables
        function renderOrders() {
            const ordersTable = document.getElementById('ordersTable');
            const dashboardOrdersTable = document.getElementById('dashboardOrdersTable');
            
            // Combine active orders and completed orders for analytics
            const allOrders = [...activeOrders, ...orders];
            
            // Update order count
            document.getElementById('orderCount').textContent = `${allOrders.length} Orders`;
            document.getElementById('allOrderCount').textContent = `${allOrders.length} Total Orders`;
            
            if (ordersTable) {
                ordersTable.innerHTML = '';
                allOrders.forEach(order => {
                    const orderRow = document.createElement('tr');
                    orderRow.innerHTML = `
                        <td>#${order.id}</td>
                        <td>${order.customer}</td>
                        <td>${order.orderType}</td>
                        <td>${order.paymentMethod}</td>
                        <td><span class="status-badge ${order.paymentStatus === 'Paid' ? 'status-paid' : 'status-unpaid'}">${order.paymentStatus}</span></td>
                        <td>P ${order.total}.00</td>
                        <td><span class="status-badge ${getStatusClass(order.status)}">${formatStatus(order.status)}</span></td>
                        <td>${order.date}</td>
                        <td>
                            <button class="btn-edit" data-id="${order.id}">View</button>
                            <button class="btn-delete" data-id="${order.id}">Cancel</button>
                        </td>
                    `;
                    ordersTable.appendChild(orderRow);
                });
            }
            
            if (dashboardOrdersTable) {
                dashboardOrdersTable.innerHTML = '';
                allOrders.forEach(order => {
                    const orderRow = document.createElement('tr');
                    orderRow.innerHTML = `
                        <td>#${order.id}</td>
                        <td>${order.customer}</td>
                        <td>${order.orderType}</td>
                        <td>${order.paymentMethod}</td>
                        <td><span class="status-badge ${order.paymentStatus === 'Paid' ? 'status-paid' : 'status-unpaid'}">${order.paymentStatus}</span></td>
                        <td>P ${order.total}.00</td>
                        <td><span class="status-badge ${getStatusClass(order.status)}">${formatStatus(order.status)}</span></td>
                        <td>${order.date}</td>
                    `;
                    dashboardOrdersTable.appendChild(orderRow);
                });
            }
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
        
        // Update analytics with accurate calculations
        function updateAnalytics() {
            // Combine active orders and completed orders for analytics
            const allOrders = [...activeOrders, ...orders];
            
            // Calculate current totals
            const currentTotalSales = allOrders.reduce((sum, order) => sum + order.total, 0);
            const currentTotalProducts = allOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
            
            // Calculate period-specific data
            const currentDate = getCurrentDate();
            const dailySales = allOrders.filter(order => order.date === currentDate).reduce((sum, order) => sum + order.total, 0);
            const dailyProducts = allOrders.filter(order => order.date === currentDate).reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
            
            const weeklyDate = getDateForPeriod('weekly');
            const weeklySales = allOrders.filter(order => order.date >= weeklyDate).reduce((sum, order) => sum + order.total, 0);
            const weeklyProducts = allOrders.filter(order => order.date >= weeklyDate).reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
            
            const monthlyDate = getDateForPeriod('monthly');
            const monthlySales = allOrders.filter(order => order.date >= monthlyDate).reduce((sum, order) => sum + order.total, 0);
            const monthlyProducts = allOrders.filter(order => order.date >= monthlyDate).reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
            
            const yearlyDate = getDateForPeriod('yearly');
            const yearlySales = allOrders.filter(order => order.date >= yearlyDate).reduce((sum, order) => sum + order.total, 0);
            const yearlyProducts = allOrders.filter(order => order.date >= yearlyDate).reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
            
            // Update display values
            document.getElementById('totalSales').textContent = `P ${currentTotalSales}.00`;
            document.getElementById('totalProductSold').textContent = currentTotalProducts;
            
            document.getElementById('dailySales').textContent = `P ${dailySales}.00`;
            document.getElementById('dailyProductSold').textContent = dailyProducts;
            
            document.getElementById('weeklySales').textContent = `P ${weeklySales}.00`;
            document.getElementById('weeklyProductSold').textContent = weeklyProducts;
            
            document.getElementById('monthlySales').textContent = `P ${monthlySales}.00`;
            document.getElementById('monthlyProductSold').textContent = monthlyProducts;
            
            document.getElementById('yearlySales').textContent = `P ${yearlySales}.00`;
            document.getElementById('yearlyProductSold').textContent = yearlyProducts;
            
            // Calculate percentage changes
            const salesChange = calculatePercentageChange(currentTotalSales, historicalData.previousTotal.sales);
            const productChange = calculatePercentageChange(currentTotalProducts, historicalData.previousTotal.products);
            
            const dailySalesChange = calculatePercentageChange(dailySales, historicalData.daily.sales);
            const dailyProductChange = calculatePercentageChange(dailyProducts, historicalData.daily.products);
            
            const weeklySalesChange = calculatePercentageChange(weeklySales, historicalData.weekly.sales);
            const weeklyProductChange = calculatePercentageChange(weeklyProducts, historicalData.weekly.products);
            
            const monthlySalesChange = calculatePercentageChange(monthlySales, historicalData.monthly.sales);
            const monthlyProductChange = calculatePercentageChange(monthlyProducts, historicalData.monthly.products);
            
            const yearlySalesChange = calculatePercentageChange(yearlySales, historicalData.yearly.sales);
            const yearlyProductChange = calculatePercentageChange(yearlyProducts, historicalData.yearly.products);
            
            // Update percentage displays
            updatePercentageDisplay('salesChange', salesChange);
            updatePercentageDisplay('productSoldChange', productChange);
            updatePercentageDisplay('dailyChange', dailySalesChange);
            updatePercentageDisplay('dailyProductChange', dailyProductChange);
            updatePercentageDisplay('weeklyChange', weeklySalesChange);
            updatePercentageDisplay('weeklyProductChange', weeklyProductChange);
            updatePercentageDisplay('monthlyChange', monthlySalesChange);
            updatePercentageDisplay('monthlyProductChange', monthlyProductChange);
            updatePercentageDisplay('yearlyChange', yearlySalesChange);
            updatePercentageDisplay('yearlyProductChange', yearlyProductChange);
            
            // Update historical data for next calculation
            historicalData.previousTotal = { sales: currentTotalSales, products: currentTotalProducts };
            historicalData.daily = { sales: dailySales, products: dailyProducts };
            historicalData.weekly = { sales: weeklySales, products: weeklyProducts };
            historicalData.monthly = { sales: monthlySales, products: monthlyProducts };
            historicalData.yearly = { sales: yearlySales, products: yearlyProducts };
            
            // Update the Order Stats table
            renderOrders();
            // Update the new Order Statistics
            updateOrderStats();
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
        
        // Order Management Functions
        function initializeOrders() {
            activeOrders = [];
            
            renderActiveOrders();
            updateOrderCount();
            updateAnalytics();
            updateOrderStats();
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
                // Convert date and time to comparable format
                const dateA = new Date(`${a.date} ${a.time}`);
                const dateB = new Date(`${b.date} ${b.time}`);
                return dateB - dateA; // This puts newer dates first
            });

            sortedOrders.forEach(order => {
                const orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                
                // Format status for display
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
                            <span class="detail-label">${order.orderType === 'delivery' ? 'Order Delivered:' : 'Pickup Date:'}</span>
                            <span class="detail-value">${order.date}</span>
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
                            <button class="btn btn-danger btn-done" data-order-id="${order.id}" ${order.status !== 'delivered' && order.status !== 'picked_up' ? 'disabled' : ''}>
                                Order Done
                            </button>
                            <button class="btn btn-warning btn-cancel" data-order-id="${order.id}">Cancel Order</button>
                        </div>
                    </div>
                `;
                container.appendChild(orderCard);
            });
            
            // Add event listeners
            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', function() {
                    const orderId = parseInt(this.getAttribute('data-order-id'));
                    updateOrderStatus(orderId, this.value);
                });
            });
            
            document.querySelectorAll('.btn-complete').forEach(btn => {
                btn.addEventListener('click', function() {
                    const orderId = parseInt(this.getAttribute('data-order-id'));
                    completeOrder(orderId);
                });
            });
            
            document.querySelectorAll('.btn-done').forEach(btn => {
                btn.addEventListener('click', function() {
                    const orderId = parseInt(this.getAttribute('data-order-id'));
                    markOrderDone(orderId);
                });
            });
            
            document.querySelectorAll('.btn-cancel').forEach(btn => {
                btn.addEventListener('click', function() {
                    const orderId = parseInt(this.getAttribute('data-order-id'));
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
                    { status: 'ready_for_pickup', label: 'Ready for Pickup' }
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
        
        function updateOrderStatus(orderId, newStatus) {
            const orderIndex = activeOrders.findIndex(order => order.id === orderId);
            if (orderIndex !== -1) {
                activeOrders[orderIndex].status = newStatus;
                renderActiveOrders();
                showToast(`Order #${orderId} status updated to ${formatStatus(newStatus)}`, 'success');
            }
        }
        
        function completeOrder(orderId) {
            const orderIndex = activeOrders.findIndex(order => order.id === orderId);
            if (orderIndex !== -1) {
                const order = activeOrders[orderIndex];
                const newStatus = order.orderType === 'delivery' ? 'delivered' : 'picked_up';
                
                // Update payment status to Paid when order is completed
                order.paymentStatus = 'Paid';
                order.status = newStatus;
                
                renderActiveOrders();
                updateOrderCount();
                updateAnalytics();
                updateOrderStats();
                showToast(`Order #${orderId} marked as ${formatStatus(newStatus)}`, 'success');
            }
        }
        
        function markOrderDone(orderId) {
            // Find order in active orders first
            let orderIndex = activeOrders.findIndex(order => order.id === orderId);
            if (orderIndex !== -1) {
                // Move from active to completed orders
                const completedOrder = activeOrders[orderIndex];
                orders.push(completedOrder);
                activeOrders.splice(orderIndex, 1);
            } else {
                // Find order in completed orders
                orderIndex = orders.findIndex(order => order.id === orderId);
                if (orderIndex !== -1) {
                    // Remove from completed orders (order history)
                    orders.splice(orderIndex, 1);
                }
            }
            
            renderActiveOrders();
            updateOrderCount();
            updateAnalytics();
            updateOrderStats();
            showToast(`Order #${orderId} has been moved to order history`, 'success');
        }
        
        function cancelOrder(orderId) {
            if (confirm('Are you sure you want to cancel this order?')) {
                const orderIndex = activeOrders.findIndex(order => order.id === orderId);
                if (orderIndex !== -1) {
                    activeOrders.splice(orderIndex, 1);
                    renderActiveOrders();
                    updateOrderCount();
                    updateAnalytics();
                    updateOrderStats();
                    showToast(`Order #${orderId} has been cancelled`, 'success');
                }
            }
        }
        
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
        
        function updateOrderCount() {
            document.getElementById('activeOrderCount').textContent = `${activeOrders.length} Active Orders`;
        }
        
        // Update Order Statistics Table
        function updateOrderStats() {
            const orderStatsTable = document.getElementById('orderStatsTable');
            const allOrders = [...activeOrders, ...orders];
            
            // Update order count
            document.getElementById('orderStatsCount').textContent = `${allOrders.length} Orders`;
            
            orderStatsTable.innerHTML = '';
            
            if (allOrders.length === 0) {
                orderStatsTable.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #666; padding: 20px;">
                            No orders found
                        </td>
                    </tr>
                `;
                return;
            }
            
            allOrders.forEach(order => {
                const totalItems = order.items.reduce((total, item) => total + item.quantity, 0);
                const orderRow = document.createElement('tr');
                
                orderRow.innerHTML = `
                    <td>#${order.id}</td>
                    <td>${order.customer}</td>
                    <td>${order.orderType === 'delivery' ? 'Delivery' : 'Pickup'}</td>
                    <td>${order.date}</td>
                    <td>${order.date}</td>
                    <td>${totalItems} items</td>
                    <td><span class="status-badge ${getStatusClass(order.status)}">${formatStatus(order.status)}</span></td>
                `;
                
                orderStatsTable.appendChild(orderRow);
            });
        }
        
        // Product options for order items
        function getProductOptions() {
            let options = '';
            products.forEach(product => {
                options += `<option value="${product.id}" data-price="${product.price}">${product.name} - P ${product.price}</option>`;
            });
            return options;
        }
        
        // Update product options in dropdowns
        function updateProductOptions() {
            const productOptions = getProductOptions();
            document.querySelectorAll('.item-select').forEach(select => {
                const currentValue = select.value;
                select.innerHTML = `<option value="">Select an item</option>${productOptions}`;
                if (currentValue) {
                    select.value = currentValue;
                }
            });
        }
        
        // Update item price when product is selected
        function updateItemPrice(selectElement) {
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            const price = selectedOption.getAttribute('data-price') || 0;
            const itemRow = selectElement.closest('.order-item');
            const priceInput = itemRow.querySelector('.item-price');
            priceInput.value = price;
            calculateTotal();
        }
        
        // Calculate total amount
        function calculateTotal() {
            let total = 0;
            document.querySelectorAll('.order-item').forEach(item => {
                const quantity = parseInt(item.querySelector('.item-quantity').value) || 0;
                const price = parseInt(item.querySelector('.item-price').value) || 0;
                total += quantity * price;
            });
            document.getElementById('orderTotal').value = total;
        }
        
        // Add new order functionality
        function openAddOrderModal() {
            document.getElementById('addOrderModal').classList.add('active');
        }
        
        function closeAddOrderModal() {
            document.getElementById('addOrderModal').classList.remove('active');
            resetOrderForm();
        }
        
        function resetOrderForm() {
            document.getElementById('orderCustomerName').value = '';
            document.getElementById('orderType').value = 'delivery';
            document.getElementById('orderTotal').value = '0';
            document.getElementById('orderAddress').value = '';
            
            // Reset items
            const itemsContainer = document.getElementById('orderItemsContainer');
            itemsContainer.innerHTML = `
                <div class="order-item">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Item</label>
                            <select class="item-select" onchange="updateItemPrice(this)">
                                <option value="">Select an item</option>
                                ${getProductOptions()}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Quantity</label>
                            <input type="number" class="item-quantity" placeholder="Qty" min="1" value="1" onchange="calculateTotal()">
                        </div>
                        <div class="form-group">
                            <label>Price</label>
                            <input type="number" class="item-price" placeholder="Price" readonly>
                        </div>
                    </div>
                </div>
            `;
            
            // Reset error states
            document.getElementById('customerNameError').style.display = 'none';
            document.getElementById('orderCustomerName').classList.remove('error');
            
            toggleAddressField();
            calculateTotal();
        }
        
        function toggleAddressField() {
            const orderType = document.getElementById('orderType').value;
            const addressGroup = document.getElementById('addressGroup');
            
            if (orderType === 'delivery') {
                addressGroup.style.display = 'block';
            } else {
                addressGroup.style.display = 'none';
            }
        }
        
        function addOrderItem() {
            const itemsContainer = document.getElementById('orderItemsContainer');
            const newItem = document.createElement('div');
            newItem.className = 'order-item';
            newItem.innerHTML = `
                <div class="form-row">
                    <div class="form-group">
                        <label>Item</label>
                        <select class="item-select" onchange="updateItemPrice(this)">
                            <option value="">Select an item</option>
                            ${getProductOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quantity</label>
                        <input type="number" class="item-quantity" placeholder="Qty" min="1" value="1" onchange="calculateTotal()">
                    </div>
                    <div class="form-group">
                        <label>Price</label>
                        <input type="number" class="item-price" placeholder="Price" readonly>
                    </div>
                </div>
            `;
            itemsContainer.appendChild(newItem);
        }
        
        function validateOrderForm() {
            let isValid = true;
            
            // Reset error states
            document.getElementById('customerNameError').style.display = 'none';
            document.getElementById('orderCustomerName').classList.remove('error');
            
            // Validate customer name
            const customerName = document.getElementById('orderCustomerName').value.trim();
            if (!customerName) {
                document.getElementById('customerNameError').style.display = 'block';
                document.getElementById('orderCustomerName').classList.add('error');
                isValid = false;
            }
            
            // Validate at least one item is selected
            let hasValidItems = false;
            document.querySelectorAll('.order-item').forEach(item => {
                const itemSelect = item.querySelector('.item-select');
                const quantity = parseInt(item.querySelector('.item-quantity').value) || 0;
                if (itemSelect.value && quantity > 0) {
                    hasValidItems = true;
                }
            });
            
            if (!hasValidItems) {
                showToast('Please add at least one valid order item', 'error');
                isValid = false;
            }
            
            return isValid;
        }
        
        function saveOrder() {
            if (!validateOrderForm()) {
                showToast('Please fix the errors in the form', 'error');
                return;
            }
            
            const customerName = document.getElementById('orderCustomerName').value;
            const orderType = document.getElementById('orderType').value;
            const total = parseInt(document.getElementById('orderTotal').value);
            const address = orderType === 'delivery' ? document.getElementById('orderAddress').value : '';
            
            // Get order items
            const items = [];
            document.querySelectorAll('.order-item').forEach(itemEl => {
                const itemSelect = itemEl.querySelector('.item-select');
                const selectedOption = itemSelect.options[itemSelect.selectedIndex];
                const quantity = parseInt(itemEl.querySelector('.item-quantity').value) || 0;
                const price = parseInt(itemEl.querySelector('.item-price').value) || 0;
                
                if (itemSelect.value && quantity > 0 && price > 0) {
                    items.push({
                        name: selectedOption.text.split(' - ')[0], // Get product name without price
                        quantity: quantity,
                        price: price
                    });
                }
            });
            
            const newOrder = {
                id: activeOrders.length > 0 ? Math.max(...activeOrders.map(o => o.id)) + 1 : 1,
                customer: customerName, // Use actual customer name
                phone: 'N/A',
                orderType: orderType,
                total: total,
                address: address,
                items: items,
                status: 'order_placed',
                date: getCurrentDate(),
                time: getCurrentTime(),
                paymentMethod: 'Cash',
                paymentStatus: 'Unpaid'
            };
            
            activeOrders.push(newOrder);
            renderActiveOrders();
            updateOrderCount();
            updateAnalytics();
            updateOrderStats();
            closeAddOrderModal();
            showToast('Order added successfully!', 'success');
        }
        
        // Event listeners for order management
        document.getElementById('addOrderBtn').addEventListener('click', openAddOrderModal);
        document.getElementById('closeOrderModal').addEventListener('click', closeAddOrderModal);
        document.getElementById('cancelOrder').addEventListener('click', closeAddOrderModal);
        document.getElementById('saveOrder').addEventListener('click', saveOrder);
        document.getElementById('orderType').addEventListener('change', toggleAddressField);
        document.getElementById('addItemBtn').addEventListener('click', addOrderItem);
        // Update product options when modal opens
        document.getElementById('addOrderBtn').addEventListener('click', function() {
            setTimeout(updateProductOptions, 100);
        });
        document.getElementById('orderTypeFilter').addEventListener('change', renderActiveOrders);
        document.getElementById('statusFilter').addEventListener('change', renderActiveOrders);
        
        // Event listeners for product management
        document.getElementById('addProduct').addEventListener('click', addProduct);
        document.getElementById('updateProduct').addEventListener('click', updateProduct);
        document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
        
        // Initialize the app
        initializeProducts();
        initializeOrders();