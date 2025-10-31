from django.contrib import admin
from .models import Item, SignupEvent


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)

@admin.register(SignupEvent)
class SignupEventAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "first_name", "last_name", "email", "created_at")
    search_fields = ("user__username", "email", "first_name", "last_name")
    list_filter = ("created_at",)

# Register your models here.
