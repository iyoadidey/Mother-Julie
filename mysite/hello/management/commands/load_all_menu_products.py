from django.core.management.base import BaseCommand
from hello.models import Product


ALL_MENU_ITEMS = [
    {"name": "Mais Con Yelo", "price": 130, "stock": 15},
    {"name": "Biscoff Classic", "price": 200, "stock": 8},
    {"name": "Buko Pandan", "price": 120, "stock": 12},
    {"name": "Cheesy Bacon", "price": 159, "stock": 20},
    {"name": "Chili Con Carne", "price": 179, "stock": 18},
    {"name": "Garlic Bread", "price": 90, "stock": 25},
    {"name": "Chicken Wrap", "price": 180, "stock": 15},
    {"name": "Mozzarella Sticks", "price": 150, "stock": 22},
    {"name": "Mango Graham", "price": 180, "stock": 10},
    {"name": "Ube Macapuno", "price": 160, "stock": 10},
    {"name": "Rocky Road", "price": 170, "stock": 10},
    {"name": "Coffee Jelly", "price": 140, "stock": 10},
    {"name": "Lasagna", "price": 250, "stock": 10},
    {"name": "Veggie Wrap", "price": 139, "stock": 10},
    {"name": "Chicken Poppers", "price": 149, "stock": 10},
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
                    "show_in_all_menu": True,
                    "is_active": True,
                },
            )

            if created:
                created_count += 1
            else:
                # Update price/stock if product already exists
                product.price = item.get("price", product.price)
                product.stock_quantity = item.get("stock", product.stock_quantity)
                product.show_in_all_menu = True
                product.is_active = True
                product.save()
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Loaded Products. Created: {created_count}, Updated: {updated_count}."
        ))


