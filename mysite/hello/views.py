from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string
from django.urls import reverse
from django.core.files.storage import FileSystemStorage
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.decorators import user_passes_test

import os
import time

from .models import SignupEvent, PasswordResetToken


def signin(request):
    # Clear any payment notice messages when arriving at signin page
    storage = messages.get_messages(request)
    for message in storage:
        # Keep only non-payment notice messages
        if "Payment Notice" not in str(message):
            # Re-add the message if it's not a payment notice
            if "logged out" in str(message) or "Invalid username" in str(message):
                # These are the only messages we want to keep on signin page
                pass
            # All other messages (including payment notice) will be cleared
    
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect("orders_menu")
        else:
            messages.error(request, "Invalid username or password")

    return render(request, "signin.html")

def signup_view(request):
    """Handle user registration"""
    if request.method == 'POST':
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        username = request.POST.get('username')
        email = request.POST.get('email')
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')
        agreement = request.POST.get('agreement')

        # Validation
        errors = []
        if password1 != password2:
            errors.append('Passwords do not match.')
        if not agreement:
            errors.append('You must agree to the terms and conditions.')
        if User.objects.filter(email=email).exists():
            errors.append('An account with this email already exists.')
        if User.objects.filter(username=username).exists():
            errors.append('Username already taken.')

        if errors:
            for error in errors:
                messages.error(request, error)
            return render(request, 'signup.html')

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password1,
                first_name=first_name,
                last_name=last_name
            )

            SignupEvent.objects.create(
                user=user,
                email=email,
                first_name=first_name,
                last_name=last_name
            )

            messages.success(request, 'Account created successfully! Please sign in.')
            return redirect('signin')

        except Exception as e:
            messages.error(request, f'An error occurred during signup: {str(e)}')
            return render(request, 'signup.html')

    return render(request, 'signup.html')


def logout_view(request):
    """Handle user logout"""
    # Clear payment notice messages before logging out
    storage = messages.get_messages(request)
    messages_to_keep = []
    for message in storage:
        if "Payment Notice" not in str(message):
            messages_to_keep.append(message)
    
    # Clear all messages
    storage.used = True
    
    # Re-add only non-payment notice messages
    for message in messages_to_keep:
        if "logged out" not in str(message):  # Don't re-add existing logout messages
            messages.add_message(request, message.level, message.message)
    
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('dashboard')  # Changed from 'signin' to 'dashboard'


def terms_view(request):
    """Display terms and conditions"""
    return render(request, 'Terms&Conditions.html')


def dashboard_view(request):
    """Dashboard page - accessible to everyone (logged in or not)"""
    return render(request, 'dashboard.html')


@login_required
def delivery_view(request):
    """Delivery page"""
    return render(request, 'delivery.html')


@login_required
def pickup_view(request):
    """Pickup page"""
    return render(request, 'pick_up.html')


@login_required
def orders_menu_view(request):
    """Orders menu for customers"""
    # Payment notice has been removed as requested
    return render(request, 'orders_menu.html')


@csrf_exempt
def request_password_reset(request):
    """Send password reset link via email"""
    if request.method == 'POST':
        email = request.POST.get('email')

        try:
            user = User.objects.filter(email=email).first()

            if not user:
                return JsonResponse({
                    'success': False,
                    'message': 'No account found with this email address.'
                })

            token = get_random_string(50)

            reset_token, created = PasswordResetToken.objects.get_or_create(
                user=user,
                defaults={'token': token}
            )
            if not created:
                reset_token.token = token
                reset_token.save()

            reset_url = request.build_absolute_uri(
                reverse('reset_password_confirm', kwargs={'token': token})
            )

            subject = 'Reset Your Password - Mother Julie'
            html_message = f"""
Click this link to reset your password:<br>
<a href="{reset_url}">{reset_url}</a>
"""

            send_mail(
                subject,
                f"Reset your password here: {reset_url}",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
                html_message=html_message
            )

            return JsonResponse({
                'success': True,
                'message': 'Password reset link has been sent to your email!'
            })

        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'An error occurred: {str(e)}'
            })

    return JsonResponse({'success': False, 'message': 'Invalid request method'})


def reset_password_confirm(request, token):
    """Handle password reset confirmation"""
    try:
        reset_token = PasswordResetToken.objects.get(token=token)

        if time.time() - reset_token.created_at.timestamp() > 3600:
            reset_token.delete()
            messages.error(request, 'This reset link has expired.')
            return redirect('signin')

        if request.method == 'POST':
            new_password = request.POST.get('new_password')
            confirm_password = request.POST.get('confirm_password')

            if new_password != confirm_password:
                messages.error(request, 'Passwords do not match.')
            elif len(new_password) < 8:
                messages.error(request, 'Password must be at least 8 characters long.')
            else:
                user = reset_token.user
                user.set_password(new_password)
                user.save()

                reset_token.delete()

                messages.success(request, 'Password reset successfully! You can now sign in.')
                return redirect('signin')

        return render(request, 'reset_password_confirm.html', {
            'token': token,
            'user': reset_token.user
        })

    except PasswordResetToken.DoesNotExist:
        messages.error(request, 'Invalid or expired reset link.')
        return redirect('signin')


def reset_password(request):
    return render(request, 'reset_password.html')


@csrf_exempt
def upload_product_image(request):
    """Handle product image uploads"""
    if request.method == 'POST' and request.FILES.get('image'):
        try:
            image = request.FILES['image']
            fs = FileSystemStorage(location=os.path.join(settings.MEDIA_ROOT, 'products'))
            filename = fs.save(image.name, image)
            image_url = fs.url(filename)
            return JsonResponse({'success': True, 'image_url': image_url})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'No image provided'})


@login_required
@user_passes_test(lambda u: u.is_superuser)
def admin_dashboard(request):
    return render(request, 'admin_dashboard.html')