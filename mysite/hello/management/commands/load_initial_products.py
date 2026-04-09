from django.core.management.base import BaseCommand
from hello.models import Product


class Command(BaseCommand):
    help = 'Loads initial products if database is empty'

    def handle(self, *args, **options):
        # Check if products already exist
        if Product.objects.exists():
            self.stdout.write(
                self.style.WARNING('Products already exist in database. Skipping...')
            )
            return

        # Create sample products
        products = [
            # Desserts
            {'name': 'Chocolate Cake', 'price': 150, 'category': 'dessert', 'stock': 50, 'show_in_all_menu': True},
            {'name': 'Vanilla Cupcakes', 'price': 80, 'category': 'dessert', 'stock': 40, 'show_in_all_menu': True},
            {'name': 'Strawberry Cheesecake', 'price': 200, 'category': 'dessert', 'stock': 30, 'show_in_all_menu': True},
            
            # Pasta
            {'name': 'Spaghetti Carbonara', 'price': 250, 'category': 'pasta', 'stock': 35, 'show_in_all_menu': True},
            {'name': 'Fettuccine Alfredo', 'price': 280, 'category': 'pasta', 'stock': 35, 'show_in_all_menu': True},
            
            # Spuds
            {'name': 'Garlic Fries', 'price': 120, 'category': 'spud', 'stock': 60, 'show_in_all_menu': True},
            {'name': 'Cheese Fries', 'price': 130, 'category': 'spud', 'stock': 60, 'show_in_all_menu': True},
            
            # Wraps
            {'name': 'Chicken Wrap', 'price': 220, 'category': 'wrap', 'stock': 40, 'show_in_all_menu': True},
            {'name': 'Veggie Wrap', 'price': 200, 'category': 'wrap', 'stock': 40, 'show_in_all_menu': True},
            
            # Appetizers
            {'name': 'Spring Rolls', 'price': 150, 'category': 'appetizer', 'stock': 45, 'show_in_all_menu': True},
            {'name': 'Mozzarella Sticks', 'price': 140, 'category': 'appetizer', 'stock': 50, 'show_in_all_menu': True},
        ]
        
        for product_data in products:
            Product.objects.create(
                name=product_data['name'],
                price=product_data['price'],
                category=product_data['category'],
                stock_quantity=product_data['stock'],
                show_in_all_menu=product_data['show_in_all_menu'],
                is_active=True
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully loaded {len(products)} initial products')
        )
