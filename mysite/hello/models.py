from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User


class Item(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name

class SignupEvent(models.Model):
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='signup_events')
    email = models.EmailField()
    first_name = models.CharField(max_length=100)  # Remove null=True, blank=True
    last_name = models.CharField(max_length=100)   # Remove null=True, blank=True
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"SignupEvent(user={self.user.username}, at={self.created_at:%Y-%m-%d %H:%M})"

User._meta.get_field('email')._unique = True

class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Password reset for {self.user.username}"


class Product(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_quantity = models.PositiveIntegerField(default=0)
    show_in_all_menu = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Order(models.Model):
    ORDER_STATUS_CHOICES = (
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    )

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    customer_name = models.CharField(max_length=200, blank=True)
    order_type = models.CharField(max_length=20, blank=True)  # dine-in / pickup / delivery
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Order #{self.id} - {self.status}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product_name = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self) -> str:
        return f"{self.product_name} x{self.quantity}"


class SalesSummary(models.Model):
    PERIOD_DAY = "day"
    PERIOD_WEEK = "week"
    PERIOD_MONTH = "month"
    PERIOD_YEAR = "year"
    PERIOD_CHOICES = (
        (PERIOD_DAY, "Day"),
        (PERIOD_WEEK, "Week"),
        (PERIOD_MONTH, "Month"),
        (PERIOD_YEAR, "Year"),
    )

    period_type = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    period_start = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("period_type", "period_start")
        ordering = ("-period_start",)

    def __str__(self) -> str:
        return f"{self.period_type.capitalize()} starting {self.period_start}: {self.total_amount}"


# ----- Sales summary maintenance on Order status changes -----
def _start_of_week(date_obj):
    # Monday as start of the week
    return (date_obj - models.functions.datetime.timedelta(days=date_obj.weekday()))

def _start_of_month(date_obj):
    return date_obj.replace(day=1)

def _start_of_year(date_obj):
    return date_obj.replace(month=1, day=1)

def _adjust_sales_summaries(order, amount_multiplier):
    """Update SalesSummary rows by adding amount_multiplier * order.total_amount.
    amount_multiplier: +1 when moving to completed, -1 when leaving completed.
    """
    from django.utils import timezone
    date_obj = (order.updated_at or order.created_at or timezone.now()).date()

    starts = [
        (SalesSummary.PERIOD_DAY, date_obj),
        (SalesSummary.PERIOD_WEEK, _start_of_week(date_obj)),
        (SalesSummary.PERIOD_MONTH, _start_of_month(date_obj)),
        (SalesSummary.PERIOD_YEAR, _start_of_year(date_obj)),
    ]

    for period_type, period_start in starts:
        summary, _ = SalesSummary.objects.get_or_create(
            period_type=period_type,
            period_start=period_start,
            defaults={"total_amount": 0},
        )
        summary.total_amount = (summary.total_amount or 0) + (order.total_amount or 0) * amount_multiplier
        # Guard against negative totals due to edits
        if summary.total_amount < 0:
            summary.total_amount = 0
        summary.save(update_fields=["total_amount", "updated_at"])


def _get_existing_status(pk):
    try:
        return Order.objects.only("status").get(pk=pk).status
    except Order.DoesNotExist:
        return None


orig_order_save = Order.save

def order_save_with_sales_update(self, *args, **kwargs):
    previous_status = _get_existing_status(self.pk) if self.pk else None
    result = orig_order_save(self, *args, **kwargs)
    # If transitioned into completed
    if self.status == "completed" and previous_status != "completed":
        _adjust_sales_summaries(self, +1)
    # If transitioned out of completed
    if previous_status == "completed" and self.status != "completed":
        _adjust_sales_summaries(self, -1)
    return result


# Monkey-patch the save to include summary updates
Order.save = order_save_with_sales_update