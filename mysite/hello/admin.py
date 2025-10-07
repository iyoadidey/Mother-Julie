from django.contrib import admin
from .models import Item, SignupEvent


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)


@admin.register(SignupEvent)
class SignupEventAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "email", "location", "latitude", "longitude", "created_at")
    search_fields = ("user__username", "email", "location")
    list_filter = ("created_at",)

# Register your models here.
