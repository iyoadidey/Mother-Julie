# 🍨 Mother Julie – Online Dessert & Food Ordering System

Mother Julie is a simple, user-friendly **web ordering system** designed for small food and dessert businesses.  
Customers can browse menu items, place their orders, and choose between **pickup** or **delivery**, while the owner can track and manage orders conveniently through the system.

---

## 🚀 Features
- ✅ Order desserts & meals online
- ✅ Clean and smooth user interface
- ✅ Pickup & Delivery order methods
- ✅ Supports multiple payment methods (Cash, GCash, Bank Transfer)
- ✅ Order tracking & management (Admin view)
- ✅ Django Admin for managing users, menu, and backups
- ✅ Uses local database (SQLite by default)

---

## 🛠 Tech Stack
| Technology        | Purpose                          |
|-------------------|----------------------------------|
| **Django**        | Backend Web Framework (Python)   |
| HTML / CSS / JS   | Frontend UI                      |
| SQLite            | Local Database (default)         |

---

## 📦 Installation & Setup

```terminal
# 1. Clone the repository
git clone https://github.com/iyoadidey/Mother-Julie.git
cd mysite

# 2. Run the server
python manage.py runserver

# 3. Open in browser
http://127.0.0.1:8000/


Mother-Julie/
│ manage.py
│ requirements.txt
│ README.md
│
├── hello/             # Main Django app (views, models, urls)
├── templates/         # HTML Templates
└── static/            # CSS, JS, Images

