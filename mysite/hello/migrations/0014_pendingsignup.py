from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hello", "0013_order_payment_reference"),
    ]

    operations = [
        migrations.CreateModel(
            name="PendingSignup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("first_name", models.CharField(max_length=100)),
                ("last_name", models.CharField(max_length=100)),
                ("username", models.CharField(max_length=150)),
                ("password_hash", models.CharField(max_length=128)),
                ("otp_code", models.CharField(max_length=6)),
                ("otp_expires_at", models.DateTimeField()),
                ("otp_attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
