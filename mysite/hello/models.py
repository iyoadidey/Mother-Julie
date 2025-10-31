from django.db import models
from django.contrib.auth import get_user_model

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

# Create your models here.
