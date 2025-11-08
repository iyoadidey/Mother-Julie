from django.contrib import admin
from .models import SignupEvent, Product, Order, OrderItem, SalesSummary


class ItemAdmin(admin.ModelAdmin):
    pass

@admin.register(SignupEvent)
class SignupEventAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "first_name", "last_name", "email", "created_at")
    search_fields = ("user__username", "email", "first_name", "last_name")
    list_filter = ("created_at",)

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "price",
        "stock_quantity",
        "show_in_all_menu",
        "is_active",
        "created_at",
    )
    list_filter = ("show_in_all_menu", "is_active", "created_at")
    search_fields = ("name",)
    list_editable = ("price", "stock_quantity", "show_in_all_menu", "is_active")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_name", "quantity", "unit_price", "total_price")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer_name", "order_type", "total_amount", "status", "created_at")
    list_filter = ("status", "order_type", "created_at")
    search_fields = ("id", "customer_name")
    inlines = [OrderItemInline]
    readonly_fields = ("created_at", "updated_at")
    actions = ["mark_completed", "mark_pending", "mark_cancelled"]

    def mark_completed(self, request, queryset):
        updated = queryset.update(status="completed")
        self.message_user(request, f"Marked {updated} order(s) as completed.")
    mark_completed.short_description = "Mark selected orders as completed"

    def mark_pending(self, request, queryset):
        updated = queryset.update(status="pending")
        self.message_user(request, f"Marked {updated} order(s) as pending.")
    mark_pending.short_description = "Mark selected orders as pending"

    def mark_cancelled(self, request, queryset):
        updated = queryset.update(status="cancelled")
        self.message_user(request, f"Marked {updated} order(s) as cancelled.")
    mark_cancelled.short_description = "Mark selected orders as cancelled"


@admin.register(SalesSummary)
class SalesSummaryAdmin(admin.ModelAdmin):
    list_display = ("period_type", "period_start", "total_amount", "updated_at")
    list_filter = ("period_type", "period_start")
    date_hierarchy = "period_start"
    search_fields = ("period_type",)
    readonly_fields = ("period_type", "period_start", "total_amount", "updated_at")

