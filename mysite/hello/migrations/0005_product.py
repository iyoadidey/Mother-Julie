from django.db import migrations, models


def copy_items_to_products(apps, schema_editor):
    Item = apps.get_model('hello', 'Item')
    Product = apps.get_model('hello', 'Product')
    # Only copy if Product table is empty to avoid duplicates
    if Product.objects.exists():
        return
    to_create = []
    for item in Item.objects.all():
        to_create.append(Product(
            name=item.name,
            description=getattr(item, 'description', ''),
            price=0,
            stock_quantity=0,
            show_in_all_menu=True,
            is_active=True,
        ))
    if to_create:
        Product.objects.bulk_create(to_create, batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('hello', '0004_remove_signupevent_latitude_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('price', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('stock_quantity', models.PositiveIntegerField(default=0)),
                ('show_in_all_menu', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ('name',),
            },
        ),
        migrations.RunPython(copy_items_to_products, migrations.RunPython.noop),
    ]


