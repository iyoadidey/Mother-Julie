from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hello', '0012_order_customer_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='payment_reference',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
