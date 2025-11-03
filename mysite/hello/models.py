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
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Reset token for {self.user.email}"
    
    class Meta:
        db_table = 'password_reset_tokens'