from django.core.management.base import BaseCommand
from hello.models import Product


ALL_MENU_ITEMS = [
    # Desserts with size options (M and L prices)
    {"name": "Mais Con Yelo", "price": 130, "stock": 15, "category": "desserts", "size_options": {"M": 110, "L": 130}},
    {"name": "Biscoff Classic", "price": 200, "stock": 8, "category": "desserts", "size_options": {"M": 175, "L": 200}},
    {"name": "Buko Pandan", "price": 120, "stock": 12, "category": "desserts", "size_options": {"M": 100, "L": 120}},
    {"name": "Mango Graham", "price": 180, "stock": 10, "category": "desserts", "size_options": {"M": 150, "L": 180}},
    {"name": "Ube Macapuno", "price": 160, "stock": 10, "category": "desserts", "size_options": {"M": 130, "L": 160}},
    {"name": "Rocky Road", "price": 170, "stock": 10, "category": "desserts", "size_options": {"M": 140, "L": 170}},
    {"name": "Coffee Jelly", "price": 140, "stock": 10, "category": "desserts", "size_options": {"M": 115, "L": 140}},
    {"name": "Dulce de Leche", "price": 190, "stock": 10, "category": "desserts", "size_options": {"M": 160, "L": 190}},
    {"name": "Choco Peanut Banana", "price": 190, "stock": 10, "category": "desserts", "size_options": {"M": 160, "L": 190}},
    {"name": "Cookie Monster", "price": 190, "stock": 10, "category": "desserts", "size_options": {"M": 160, "L": 190}},
    # Spud products
    {"name": "Cheesy Bacon", "price": 159, "stock": 20, "category": "spud"},
    {"name": "Chili Con Carne", "price": 179, "stock": 18, "category": "spud"},
    {"name": "Triple Cheese", "price": 129, "stock": 15, "category": "spud"},
    {"name": "Lasagna Jacket", "price": 129, "stock": 15, "category": "spud"},
    {"name": "Garlic Bread", "price": 90, "stock": 25, "category": "pasta_bread"},
    {"name": "Lasagna", "price": 250, "stock": 10, "category": "pasta_bread"},
    # Wrap products
    {"name": "Chicken Wrap", "price": 169, "stock": 15, "category": "wrap"},
    {"name": "Beef Wrap", "price": 139, "stock": 15, "category": "wrap"},
    {"name": "Kesodilla", "price": 99, "stock": 15, "category": "wrap"},
    # Appetizers
    {"name": "Chicken Poppers", "price": 149, "stock": 10, "category": "appetizers"},
    {"name": "Nachos", "price": 129, "stock": 15, "category": "appetizers"},
]


class Command(BaseCommand):
    help = "Load all menu items into Product table if missing."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for item in ALL_MENU_ITEMS:
            product, created = Product.objects.get_or_create(
                name=item["name"],
                defaults={
                    "description": "",
                    "price": item.get("price", 0),
                    "stock_quantity": item.get("stock", 0),
                    "category": item.get("category", ""),
                    "size_options": item.get("size_options", {}),
                    "show_in_all_menu": True,
                    "is_active": True,
                },
            )

            if created:
                created_count += 1
            else:
                # Update price/stock/category/size_options if product already exists
                product.price = item.get("price", product.price)
                product.stock_quantity = item.get("stock", product.stock_quantity)
                if item.get("category"):
                    product.category = item.get("category")
                if item.get("size_options"):
                    product.size_options = item.get("size_options", {})
                product.show_in_all_menu = True
                product.is_active = True
                product.save()
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Loaded Products. Created: {created_count}, Updated: {updated_count}."
        ))


