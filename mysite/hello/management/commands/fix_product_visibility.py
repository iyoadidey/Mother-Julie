from django.core.management.base import BaseCommand
from hello.models import Product


class Command(BaseCommand):
    help = 'Fix product visibility - set all products to show_in_all_menu=True and is_active=True'

    def handle(self, *args, **options):
        # Fix products that are hidden
        hidden_products = Product.objects.filter(show_in_all_menu=False)
        count_hidden = hidden_products.count()
        hidden_products.update(show_in_all_menu=True)
        
        inactive_products = Product.objects.filter(is_active=False)
        count_inactive = inactive_products.count()
        inactive_products.update(is_active=True)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully fixed {count_hidden} products with show_in_all_menu=False and '
                f'{count_inactive} products with is_active=False'
            )
        )

