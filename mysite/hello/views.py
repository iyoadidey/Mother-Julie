

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
from django.utils import timezone
import os
import time
import json
import random
import threading
import math
import importlib
try:
    import requests
except ImportError:
    requests = None
import hmac
import hashlib
import base64

from .models import SignupEvent, PasswordResetToken, PendingSignup, Product, Order, OrderItem, FrontendContent
from django.db import transaction, close_old_connections
from django.db.models import F
from django.templatetags.static import static
from django.core.mail import EmailMultiAlternatives
from django.contrib.staticfiles import finders
from datetime import timedelta
from django.contrib.auth.hashers import make_password


def _paymongo_auth_header(api_key):
    """Build valid PayMongo Basic auth header from key."""
    token = base64.b64encode(f"{api_key}:".encode("utf-8")).decode("utf-8")
    return f"Basic {token}"


def _haversine_distance_km(origin, destination):
    """Compute straight-line distance in kilometers between two lat/lng pairs."""
    lat1 = math.radians(float(origin['lat']))
    lon1 = math.radians(float(origin['lng']))
    lat2 = math.radians(float(destination['lat']))
    lon2 = math.radians(float(destination['lng']))

    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371 * c


def _calculate_local_delivery_fee(origin, destination, distance_km=None):
    """Fallback fee calculation when Lalamove credentials/API are unavailable."""
    if distance_km is None:
        distance_km = _haversine_distance_km(origin, destination)
    remaining_km = max(distance_km - settings.DELIVERY_FEE_INCLUDED_KM, 0)
    fee = settings.DELIVERY_FEE_BASE + (remaining_km * settings.DELIVERY_FEE_PER_KM_AFTER_INCLUDED)
    return round(fee, 2), round(distance_km, 2)


def _build_receipt_email_html(order_id, customer_name, order_type_display, payment_method, total_amount, items_text):
    """Build HTML e-receipt email content."""
    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f7f8;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden;">
            <tr>
              <td align="center" style="padding:28px 28px 8px 28px;">
                <h1 style="margin:16px 0 0 0;font-size:22px;line-height:28px;color:#d63384;">Your E-Receipt</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                <p>Dear {customer_name},</p>
                <p>Thank you for your order with Mother Julie. Here is your e-receipt:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                <div style="background-color:#f8f9fa;padding:15px;border-radius:5px;margin:20px 0;">
                  <p style="margin:8px 0;"><strong>Order ID:</strong> {order_id}</p>
                  <p style="margin:8px 0;"><strong>Order Type:</strong> {order_type_display}</p>
                  <p style="margin:8px 0;"><strong>Payment Method:</strong> {payment_method}</p>
                  <p style="margin:8px 0;"><strong>Status:</strong> <span style="color:#d63384;font-weight:bold;">Order Placed</span></p>
                  <p style="margin:8px 0;"><strong>Total Amount:</strong> Php {total_amount:.2f}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                <h4 style="color:#333;margin-top:20px;margin-bottom:10px;">Order Items:</h4>
                <div style="background-color:#ffffff;padding:10px;border-left:3px solid #d63384;margin-top:10px;">
                  {items_text.replace(chr(10), '<br>')}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 24px 28px;font-size:14px;line-height:22px;color:#333;">
                <p>Please keep this email for your reference.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _build_receipt_email_plain(customer_name, order_id, order_type_display, payment_method, total_amount, items_text):
    """Build plain text e-receipt email content."""
    return f"""Dear {customer_name},

Thank you for your order with Mother Julie. Here is your e-receipt:

Order ID: {order_id}
Order Type: {order_type_display}
Payment Method: {payment_method}
Status: Order Placed
Total Amount: Php {total_amount:.2f}

Order Items:
{items_text}

Please keep this email for your reference."""


def _format_payment_method_display(payment_method):
    """Format payment method labels for customer-facing text."""
    normalized = str(payment_method or '').strip().lower().replace('_', ' ')
    payment_method_map = {
        'qr': 'QR',
        'qr ph': 'QR PH',
        'qrph': 'QR PH',
        'gcash': 'GCash',
    }
    return payment_method_map.get(normalized, normalized.title())


def _send_order_receipt_email_sync(subject, html_message, plain_message, customer_email, order_id):
    """Send e-receipt email in a background thread."""
    close_old_connections()
    try:
        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[customer_email]
        )
        email.attach_alternative(html_message, "text/html")
        email.send(fail_silently=False)
        print(f"[RECEIPT] E-receipt sent to {customer_email} for order {order_id}")
    except Exception as exc:
        print(f"[RECEIPT ERROR] Failed to send e-receipt for order {order_id}: {exc}")


def send_order_receipt_email(order, items, send_async=False):
    """Send e-receipt email after an order is successfully placed."""
    customer_email = (order.customer_email or '').strip()
    if not customer_email:
        print(f"[RECEIPT] Skipping e-receipt for order {order.order_id}: no customer email")
        return

    items_list = []
    for item in items:
        item_text = f"- {item.get('name', '')} x {int(item.get('quantity', 1))}"
        if item.get('size'):
            item_text += f" (Size: {item.get('size')})"
        item_text += f" - Php {float(item.get('total', 0)):.2f}"
        items_list.append(item_text)
    items_text = "\n".join(items_list)

    order_type_display = dict(Order.ORDER_TYPE_CHOICES).get(order.order_type, order.order_type)
    payment_method_display = _format_payment_method_display(order.payment_method)
    subject = f"[E-RECEIPT] Order {order.order_id} - Mother Julie"
    html_message = _build_receipt_email_html(
        order.order_id,
        order.customer_name,
        order_type_display,
        payment_method_display,
        float(order.total_amount),
        items_text
    )
    plain_message = _build_receipt_email_plain(
        order.customer_name,
        order.order_id,
        order_type_display,
        payment_method_display,
        float(order.total_amount),
        items_text
    )

    if send_async:
        email_thread = threading.Thread(
            target=_send_order_receipt_email_sync,
            args=(subject, html_message, plain_message, customer_email, order.order_id),
            daemon=False,
            name=f"ReceiptEmailThread-{order.order_id}"
        )
        email_thread.start()
        return

    _send_order_receipt_email_sync(subject, html_message, plain_message, customer_email, order.order_id)

@csrf_exempt
def signin(request):
    """Handle user signin - supports form data, AJAX, and JSON from mobile app"""
    if request.method == "POST":
        # Parse data from form or JSON
        is_json = request.content_type == 'application/json'
        remember_me = False
        
        try:
            if is_json:
                data = json.loads(request.body.decode('utf-8'))
                username = data.get("username", "").strip()
                password = data.get("password", "")
                remember_me = data.get("remember_me", False)
            else:
                username = (request.POST.get("username") or "").strip()
                password = request.POST.get("password") or ""
                remember_me = request.POST.get("remember_me") == 'on'
        except (json.JSONDecodeError, ValueError) as e:
            if is_json:
                return JsonResponse({"success": False, "message": f"Invalid JSON: {str(e)}"}, status=400)
            return render(request, "signin.html")
        
        # Validate inputs
        if not username or not password:
            if is_json or request.headers.get("x-requested-with") == "XMLHttpRequest":
                return JsonResponse({"success": False, "message": "Username and password are required"}, status=400)
            messages.error(request, "Username and password are required")
            return render(request, "signin.html")
        
        user = authenticate(request, username=username, password=password)

        if is_json or request.headers.get("x-requested-with") == "XMLHttpRequest":
            # JSON/AJAX request
            if user is not None:
                login(request, user)
                # Set session expiry based on remember me
                if remember_me:
                    request.session.set_expiry(1209600)  # 2 weeks
                else:
                    request.session.set_expiry(0)  # Session expires when browser closes
                # Redirect to admin dashboard if superuser or staff
                if user.is_superuser or user.is_staff:
                    return JsonResponse({"success": True, "redirect_url": "/admin_dashboard/", "message": "Login successful"})
                else:
                    return JsonResponse({"success": True, "redirect_url": "/dashboard/", "message": "Login successful"})
            else:
                return JsonResponse({"success": False, "message": "Invalid username or password"}, status=401)
        else:
            # Normal form submission
            if user is not None:
                login(request, user)
                # Set session expiry based on remember me
                if remember_me:
                    request.session.set_expiry(1209600)  # 2 weeks
                else:
                    request.session.set_expiry(0)  # Session expires when browser closes
                # Redirect to admin dashboard if superuser or staff
                if user.is_superuser or user.is_staff:
                    return redirect("admin_dashboard")
                else:
                    return redirect("dashboard")
            else:
                messages.error(request, "Invalid username or password")
                return render(request, "signin.html")

    return render(request, "signin.html")


def _send_signup_otp_email(recipient_email, otp_code):
    subject = "Mother Julie account verification code"
    html_content = f"""
    <h2>Welcome to Mother Julie!</h2>
    <p>Your verification code is:</p>
    <h1>{otp_code}</h1>
    <p>This code expires in 10 minutes.</p>
    """
    plain_content = (
        "Welcome to Mother Julie!\n\n"
        f"Your verification code is: {otp_code}\n"
        "This code expires in 10 minutes."
    )

    # Prefer Brevo transactional API when SDK + key are available.
    try:
        sib_api_v3_sdk = importlib.import_module("sib_api_v3_sdk")

        if settings.BREVO_API_KEY:
            configuration = sib_api_v3_sdk.Configuration()
            configuration.api_key['api-key'] = settings.BREVO_API_KEY

            api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
                sib_api_v3_sdk.ApiClient(configuration)
            )

            send_email = sib_api_v3_sdk.SendSmtpEmail(
                to=[{"email": recipient_email}],
                sender={
                    "name": "Mother Julie",
                    "email": settings.DEFAULT_FROM_EMAIL
                },
                subject=subject,
                html_content=html_content
            )
            api_instance.send_transac_email(send_email)
            return True
    except Exception as e:
        print("Brevo send failed, falling back to SMTP:", e)

    # Fallback to Django email backend (SMTP/Brevo relay, Gmail, etc.).
    try:
        send_mail(
            subject,
            plain_content,
            settings.DEFAULT_FROM_EMAIL,
            [recipient_email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print("OTP email fallback failed:", e)
        return False


@csrf_exempt
def signup_view(request):
    """Start user registration and send OTP email verification - supports form data and JSON from mobile app."""
    if request.method == 'POST':
        # Parse data from form or JSON
        is_json = request.content_type == 'application/json'
        
        try:
            if is_json:
                data = json.loads(request.body.decode('utf-8'))
                first_name = (data.get('first_name') or '').strip()
                last_name = (data.get('last_name') or '').strip()
                username = (data.get('username') or '').strip()
                email = (data.get('email') or '').strip().lower()
                password1 = data.get('password1') or ''
                password2 = data.get('password2') or ''
                agreement = data.get('agreement')
            else:
                first_name = (request.POST.get('first_name') or '').strip()
                last_name = (request.POST.get('last_name') or '').strip()
                username = (request.POST.get('username') or '').strip()
                email = (request.POST.get('email') or '').strip().lower()
                password1 = request.POST.get('password1')
                password2 = request.POST.get('password2')
                agreement = request.POST.get('agreement')
        except (json.JSONDecodeError, ValueError) as e:
            if is_json:
                return JsonResponse({"success": False, "message": f"Invalid JSON: {str(e)}"}, status=400)
            messages.error(request, f"Invalid request data: {str(e)}")
            return render(request, 'signup.html')

        # Validation
        errors = []
        if password1 != password2:
            errors.append('Passwords do not match.')
        if not first_name or not last_name or not username or not email:
            errors.append('All fields are required.')
        allowed_domains = ('@gmail.com', '@tip.edu.ph')
        if not email.endswith(allowed_domains):
            errors.append('Please use a valid Gmail or TIP email address.')
        if not agreement:
            errors.append('You must agree to the terms and conditions.')
        
        # Check for existing email
        if User.objects.filter(email=email).exists():
            errors.append('An account with this email already exists.')
        
        # Check for existing username
        if User.objects.filter(username=username).exists():
            errors.append('Username already taken.')

        if errors:
            # Return JSON or form response based on request type
            if is_json:
                return JsonResponse({"success": False, "errors": errors}, status=400)
            for error in errors:
                messages.error(request, error)
            return render(request, 'signup.html')

        try:
            otp_code = f"{random.randint(0, 999999):06d}"
            PendingSignup.objects.update_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "username": username,
                    "password_hash": make_password(password1),
                    "otp_code": otp_code,
                    "otp_expires_at": timezone.now() + timedelta(minutes=10),
                    "otp_attempts": 0,
                },
            )

            success = _send_signup_otp_email(email, otp_code)

            if not success:
                if is_json:
                    return JsonResponse({"success": False, "message": "Failed to send OTP email."}, status=500)
                messages.error(request, "Failed to send OTP email.")
                return render(request, 'signup.html')

            request.session['pending_signup_email'] = email
            if is_json:
                return JsonResponse({"success": True, "message": "OTP sent to your email.", "email": email})
            messages.success(request, 'A verification code has been sent to your email.')
            return redirect('verify_signup_otp')
        except Exception as e:
            if is_json:
                return JsonResponse({"success": False, "message": f"Error: {str(e)}"}, status=500)
            messages.error(request, f'Unable to send verification code: {str(e)}')
            return render(request, 'signup.html')

    return render(request, 'signup.html')

@csrf_exempt
def verify_signup_otp(request):
    """Verify OTP before creating user account - supports form data and JSON from mobile app."""
    prefill_email = request.session.get('pending_signup_email', '')

    if request.method == 'POST':
        # Parse data from form or JSON
        is_json = request.content_type == 'application/json'
        
        try:
            if is_json:
                data = json.loads(request.body.decode('utf-8'))
                email = (data.get('email') or '').strip().lower()
                action = data.get('action', 'verify')
            else:
                email = (request.POST.get('email') or '').strip().lower()
                action = request.POST.get('action', 'verify')
        except (json.JSONDecodeError, ValueError) as e:
            if is_json:
                return JsonResponse({"success": False, "message": f"Invalid JSON: {str(e)}"}, status=400)
            messages.error(request, f"Invalid request data: {str(e)}")
            return render(request, 'verify_signup_otp.html', {'email': email})

        try:
            pending = PendingSignup.objects.get(email=email)
        except PendingSignup.DoesNotExist:
            if is_json:
                return JsonResponse({"success": False, "message": "No pending signup found. Please sign up again."}, status=404)
            messages.error(request, 'No pending signup found for this email. Please sign up again.')
            return redirect('signup')

        if action == 'resend':
            otp_code = f"{random.randint(0, 999999):06d}"
            pending.otp_code = otp_code
            pending.otp_expires_at = timezone.now() + timedelta(minutes=10)
            pending.otp_attempts = 0
            pending.save(update_fields=['otp_code', 'otp_expires_at', 'otp_attempts', 'updated_at'])
            _send_signup_otp_email(email, otp_code)
            request.session['pending_signup_email'] = email
            if is_json:
                return JsonResponse({"success": True, "message": "New OTP sent to your email."})
            messages.success(request, 'A new verification code has been sent.')
            return redirect('verify_signup_otp')

        otp = (request.POST.get('otp') if not is_json else data.get('otp') or '').strip()
        if pending.is_otp_expired():
            if is_json:
                return JsonResponse({"success": False, "message": "Verification code expired. Please request a new code."}, status=400)
            messages.error(request, 'Your verification code has expired. Please request a new code.')
            return render(request, 'verify_signup_otp.html', {'email': email})

        if pending.otp_attempts >= 5:
            if is_json:
                return JsonResponse({"success": False, "message": "Too many invalid attempts. Please request a new code."}, status=429)
            messages.error(request, 'Too many invalid attempts. Please request a new code.')
            return render(request, 'verify_signup_otp.html', {'email': email})

        if otp != pending.otp_code:
            pending.otp_attempts = pending.otp_attempts + 1
            pending.save(update_fields=['otp_attempts', 'updated_at'])
            if is_json:
                return JsonResponse({"success": False, "message": "Invalid verification code.", "attempts_remaining": 5 - pending.otp_attempts}, status=400)
            messages.error(request, 'Invalid verification code.')
            return render(request, 'verify_signup_otp.html', {'email': email})

        if User.objects.filter(email=pending.email).exists():
            if is_json:
                return JsonResponse({"success": False, "message": "Account already exists."}, status=409)
            messages.error(request, 'An account with this email already exists.')
            pending.delete()
            return redirect('signin')

        if User.objects.filter(username=pending.username).exists():
            if is_json:
                return JsonResponse({"success": False, "message": "Username already taken."}, status=409)
            messages.error(request, 'Username already taken. Please sign up again.')
            pending.delete()
            return redirect('signup')

        try:
            user = User(
                username=pending.username,
                email=pending.email,
                password=pending.password_hash,
                first_name=pending.first_name,
                last_name=pending.last_name
            )
            user.save()

            SignupEvent.objects.create(
                user=user,
                email=pending.email,
                first_name=pending.first_name,
                last_name=pending.last_name
            )
            pending.delete()
            request.session.pop('pending_signup_email', None)

            if is_json:
                return JsonResponse({"success": True, "message": "Account created successfully! You can now sign in."})
            messages.success(request, 'Account verified and created successfully! Please sign in.')
            return redirect('signin')
        except Exception as e:
            if is_json:
                return JsonResponse({"success": False, "message": f"Error creating account: {str(e)}"}, status=500)
            messages.error(request, f'An error occurred while creating your account: {str(e)}')
            return render(request, 'verify_signup_otp.html', {'email': email})

    return render(request, 'verify_signup_otp.html', {'email': prefill_email})


def logout_view(request):
    """Handle user logout"""
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('dashboard')


def terms_view(request):
    """Display terms and conditions"""
    return render(request, 'Terms&Conditions.html')


def dashboard_view(request):
    """Dashboard page - accessible to everyone (logged in or not)"""
    return render(request, 'dashboard.html')


@login_required
def edit_account_view(request):
    """Allow authenticated users to update their account details."""
    user = request.user

    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip().lower()

        errors = []
        if not username:
            errors.append('Username is required.')
        elif User.objects.exclude(pk=user.pk).filter(username=username).exists():
            errors.append('That username is already taken.')

        if email and User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
            errors.append('That email is already in use.')

        if errors:
            for error in errors:
                messages.error(request, error)
        else:
            user.first_name = first_name
            user.last_name = last_name
            user.username = username
            user.email = email
            user.save()
            messages.success(request, 'Your account details were updated successfully.')
            return redirect('dashboard')

    return render(request, 'edit_account.html')


@login_required
def delivery_view(request):
    """Delivery page"""
    return render(request, 'delivery.html')


@login_required
def pickup_view(request):
    """Pickup page"""
    return render(request, 'pick_up.html')  # If you rename the template


@login_required
def redirect_to_order(request):
    """Redirect user to their appropriate order tracking page"""
    print(f"DEBUG: redirect_to_order called for user: {request.user.username}")
    
    try:
        # Get the user's most recent order
        latest_order = Order.objects.filter(
            user=request.user
        ).order_by('-created_at').first()
        
        print(f"DEBUG: Latest order found: {latest_order}")
        
        if not latest_order:
            print("DEBUG: No orders found for user - redirecting to dashboard with message")
            messages.info(request, "📦 You don't have any orders yet. Click 'OUR MENU' to place your first order!")
            return redirect('dashboard')

        # If the latest order is already completed/cancelled, consider it as no active order
        completed_statuses = ['delivered', 'picked_up', 'cancelled']
        if latest_order.status in completed_statuses:
            print(f"DEBUG: Latest order {latest_order.order_id} status is '{latest_order.status}' (completed). Showing no existing order.")
            messages.info(request, "📦 No active orders at the moment. Click 'OUR MENU' to create a new order.")
            return redirect('dashboard')

        order_id = latest_order.order_id
        order_type = latest_order.order_type
        
        print(f"DEBUG: Order ID: {order_id}, Type: {order_type}")
        
        # Redirect based on order type
        if order_type == 'delivery':
            print("DEBUG: Redirecting to DELIVERY")
            return redirect(f'/delivery/?orderId={order_id}')
        elif order_type == 'pickup':
            print("DEBUG: Redirecting to PICKUP")
            return redirect(f'/pick_up/?orderId={order_id}')
        else:
            # Dine-in and unknown order types are not currently trackable in dedicated route
            print(f"DEBUG: Order type '{order_type}' is not trackable; redirecting to dashboard")
            messages.info(request, "📦 No active trackable order found. Click 'OUR MENU' to place an order.")
            return redirect('dashboard')
            
    except Exception as e:
        print(f"DEBUG: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        messages.error(request, "❌ Could not load your orders. Please try again.")
        return redirect('dashboard')
    

@login_required
def debug_orders(request):
    """Debug view to check user's orders"""
    user_orders = Order.objects.filter(user=request.user).order_by('-created_at')
    
    orders_data = []
    for order in user_orders:
        orders_data.append({
            'order_id': order.order_id,
            'order_type': order.order_type,
            'status': order.status,
            'created_at': order.created_at,
            'user': order.user.username if order.user else 'None'
        })
    
    return JsonResponse({
        'user': request.user.username,
        'total_orders': user_orders.count(),
        'orders': orders_data
    })


@login_required
def orders_menu_view(request):
    """Orders menu for customers"""
    visible_product_names = list(
        Product.objects.filter(show_in_all_menu=True, is_active=True)
        .order_by('name')
        .values_list('name', flat=True)
    )
    return render(request, 'orders_menu.html', {
        'visible_product_names': visible_product_names,
    })


@login_required
def qr_payment_view(request):
    """Dedicated QR payment page before creating an order."""
    return render(request, 'qr_payment.html')


@csrf_exempt
def request_password_reset(request):
    """Send password reset link via email"""
    if request.method == 'POST':
        email = request.POST.get('email', '').strip().lower()

        if not email:
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'message': 'Please enter your email address.'})
            messages.error(request, 'Please enter your email address.')
            return render(request, 'reset_password.html')

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        token = get_random_string(50)

        if user:
            try:
                reset_token, _ = PasswordResetToken.objects.update_or_create(
                    user=user,
                    defaults={'token': token}
                )

                reset_url = request.build_absolute_uri(
                    reverse('reset_password_confirm', kwargs={'token': token})
                )

                subject = 'Reset Your Password - Mother Julie'
                html_message = f"""
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f7f8;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden;">
            <tr>
              <td align="center" style="padding:28px 28px 8px 28px;">
                <h1 style="margin:16px 0 0 0;font-size:22px;line-height:28px;color:#ff5b89;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                We received a request to reset the password for your account. If you didn’t request this, ignore this email.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 28px 8px 28px;">
                <a href="{reset_url}" style="display:inline-block;background:#ff5b89;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Reset Password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 28px 20px 28px;font-size:12px;line-height:18px;color:#666;">Link expires in 1 hour.</td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px 28px;font-size:12px;line-height:18px;color:#666;">If button doesn't work, visit: <a href="{reset_url}" style="color:#ff5b89;word-break:break-all;">{reset_url}</a></td>
            </tr>
          </table>
          <div style="padding:14px 0 0 0;font-size:11px;color:#9aa0a6;">Sent by Mother Julie • Do not reply.</div>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=f"Reset your password here: {reset_url}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                msg.attach_alternative(html_message, 'text/html')
                msg.send(fail_silently=False)

            except Exception as e:
                # For debugging, log the exception (console + Django logs)
                import traceback
                traceback.print_exc()
                error_message = str(e)
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'message': f'Unable to send reset email. {error_message}'})
                messages.error(request, f'Unable to send reset email. {error_message}')
                return render(request, 'reset_password.html')

        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'message': 'If an account exists, a reset link has been sent.'})

        messages.success(request, 'If an account exists, a reset link has been sent. Check your email.')
        return redirect('signin')

    return render(request, 'reset_password.html')

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


@csrf_exempt
def api_update_product_image(request, product_id):
    """Update product image"""
    if not request.user.is_authenticated or not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        product = Product.objects.get(id=product_id)
        
        if request.FILES.get('image'):
            product.image = request.FILES.get('image')
            product.save()
            image_url = ''
            try:
                if product.image:
                    image_url = request.build_absolute_uri(product.image.url)
            except Exception as e:
                print(f"Error getting image URL: {e}")
            return JsonResponse({
                'success': True,
                'image_url': image_url,
                'message': 'Product image updated successfully'
            })
        else:
            return JsonResponse({'error': 'No image provided'}, status=400)
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


def admin_dashboard(request):
    """Admin/Staff dashboard"""
    if not request.user.is_authenticated:
        return redirect('signin')
    if not (request.user.is_superuser or request.user.is_staff):
        messages.error(request, 'You do not have permission to access this page.')
        return redirect('dashboard')
    context = {
        'is_superuser': request.user.is_superuser,
        'is_staff': request.user.is_staff,
    }
    return render(request, 'admin_dashboard.html', context)


@login_required(login_url='signin')
def monthly_reports_view(request):
    """Render monthly reports page with interactive month selector and line graph"""
    if not request.user.is_authenticated:
        return redirect('signin')
    # Admin-only (superuser). Staff should not access reports.
    if not request.user.is_superuser:
        messages.error(request, 'You do not have permission to access this page.')
        return redirect('dashboard')
    
    context = {
        'is_superuser': request.user.is_superuser,
        'is_staff': request.user.is_staff,
    }
    return render(request, 'monthly_reports.html', context)






def admin_logout(request):
    """Handle admin logout"""
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('signin')


@csrf_exempt
def api_create_order(request):
    """Create an order from frontend JSON"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

    try:
        print("=== DEBUG: api_create_order called ===")  # ADD THIS
        data = json.loads(request.body.decode('utf-8'))
        print("Received data:", data)  # ADD THIS

        items = data.get('items', [])
        total_amount = data.get('totalAmount', 0)
        order_type = data.get('orderType', '')
        payment_method = data.get('paymentMethod', 'Cash')

        print(f"Items: {items}")  # ADD THIS
        print(f"Total: {total_amount}, Type: {order_type}, Payment: {payment_method}")  # ADD THIS
        
        # Generate unique order ID
        order_id = 'MJ' + str(int(timezone.now().timestamp())) + str(random.randint(100, 999))
        
        # Prefer the authenticated user's username as the customer name
        customer_name = request.user.username if request.user.is_authenticated else data.get('customerName', '')
        # Get customer email: from authenticated user's email, or from request data, or None
        customer_email = None
        if request.user.is_authenticated and request.user.email:
            customer_email = request.user.email
        else:
            customer_email = data.get('customerEmail', None)
        print(f"Customer: {customer_name}, User: {request.user}, Email: {customer_email}")  # ADD THIS


        with transaction.atomic():
            print("Creating order...")  # ADD THIS
            order = Order.objects.create(
                order_id=order_id,
                user=request.user if request.user.is_authenticated else None,
                customer_name=customer_name,
                customer_email=customer_email,
                order_type=order_type,
                payment_method=payment_method,
                total_amount=total_amount,
                status='order_placed'
            )
            print(f"Order created: {order.order_id}")  # ADD THIS


            for item in items:
                product_id = item.get('product_id')
                name = item.get('name', '')
                qty = int(item.get('quantity', 1))
                unit_price = item.get('price', 0)
                total_price = item.get('total', 0)
                size = item.get('size', '')

                # Try to find product by ID first, then by name
                product = None
                if product_id:
                    try:
                        product = Product.objects.select_for_update().get(id=product_id)
                    except Product.DoesNotExist:
                        pass

                if not product and name:
                    try:
                        product = Product.objects.select_for_update().get(name=name)
                    except Product.DoesNotExist:
                        pass

                if product:
                    # Use actual product data if not provided in request
                    if not name: name = product.name
                    if not unit_price: unit_price = product.price
                    if not total_price: total_price = float(unit_price) * qty

                print(f"Creating order item: {name} (ID: {product_id}) x {qty}")

                # Save order line
                OrderItem.objects.create(
                    order=order,
                    product_name=name,
                    quantity=qty,
                    unit_price=unit_price,
                    total_price=total_price,
                    size=size
                )

                # Decrement stock
                if product:
                    product.stock_quantity = F('stock_quantity') - qty
                    product.save(update_fields=['stock_quantity'])
                    product.refresh_from_db(fields=['stock_quantity'])
                    if product.stock_quantity < 0:
                        product.stock_quantity = 0
                        product.save(update_fields=['stock_quantity'])
                else:
                    print(f"Product '{name}' (ID: {product_id}) not found, skipping stock update")

        print("=== DEBUG: Order creation SUCCESS ===")  # ADD THIS
        
        # Get updated stock information for all products in the order
        updated_stocks = {}
        for item in items:
            name = item.get('name', '')
            try:
                product = Product.objects.get(name=name)
                updated_stocks[product.id] = {
                    'name': product.name,
                    'stock': product.stock_quantity,
                    'is_active': product.is_active,
                    'show_in_all_menu': product.show_in_all_menu
                }
            except Product.DoesNotExist:
                pass

        send_order_receipt_email(order, items, send_async=False)
        
        return JsonResponse({
            'success': True, 
            'orderId': order_id,
            'updated_stocks': updated_stocks
        })
    except Exception as e:
        print(f"=== DEBUG: ERROR - {str(e)} ===")  # ADD THIS
        import traceback
        traceback.print_exc()  # ADD THIS
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
def api_calculate_delivery_fee(request):
    """Calculate delivery fee using Lalamove when available, otherwise use local fallback."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        origin = data.get('origin')
        destination = data.get('destination')
        provided_distance_km = data.get('distance_km')

        if not origin or not destination:
            return JsonResponse({'success': False, 'error': 'Origin and destination must be provided'}, status=400)

        try:
            origin = {
                'lat': float(origin.get('lat')),
                'lng': float(origin.get('lng')),
            }
            destination = {
                'lat': float(destination.get('lat')),
                'lng': float(destination.get('lng')),
            }
        except (TypeError, ValueError):
            return JsonResponse({'success': False, 'error': 'Invalid origin or destination coordinates'}, status=400)

        api_key = settings.LALAMOVE_API_KEY
        api_secret = settings.LALAMOVE_API_SECRET
        mode = settings.LALAMOVE_MODE
        try:
            route_distance_km = float(provided_distance_km) if provided_distance_km is not None else None
        except (TypeError, ValueError):
            route_distance_km = None

        fallback_fee, distance_km = _calculate_local_delivery_fee(origin, destination, route_distance_km)

        if not api_key or not api_secret or requests is None:
            return JsonResponse({
                'success': True,
                'deliveryFee': fallback_fee,
                'source': 'local_fallback',
                'distanceKm': distance_km,
            })

        host = 'https://rest.lalamove.com' if mode == 'production' else 'https://rest.sandbox.lalamove.com'
        endpoint_path = '/v3/quotations'
        url = f"{host}{endpoint_path}"

        payload = {
            'stop': [
                {'location': origin},
                {'location': destination}
            ],
            'serviceType': 'MOTORCYCLE',
            'specialRequests': []
        }

        body_text = json.dumps(payload, separators=(',', ':'), ensure_ascii=False)
        timestamp = str(int(time.time() * 1000))
        message = f"{timestamp}.POST.{endpoint_path}.{body_text}".encode('utf-8')
        signature = hmac.new(api_secret.encode('utf-8'), message, hashlib.sha256).hexdigest()

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'hmac {api_key}:{signature}',
            'X-LLM-Timestamp': timestamp,
            'X-LLM-ApiKey': api_key,
            'X-LLM-Signature': signature,
        }

        response = requests.post(url, headers=headers, data=body_text, timeout=15)
        response_data = response.json() if response.content else {}

        if response.status_code not in (200, 201):
            return JsonResponse({
                'success': True,
                'deliveryFee': fallback_fee,
                'source': 'local_fallback',
                'distanceKm': distance_km,
                'warning': 'Lalamove API returned an error. Using local fallback fee.',
                'details': response_data,
            })

        # Lalamove quotation response usually contains totalFee in PHP
        delivery_fee = 0.0
        if isinstance(response_data, dict):
            delivery_fee = float(response_data.get('totalFee', response_data.get('data', {}).get('totalFee', 0)))

        if delivery_fee <= 0:
            delivery_fee = fallback_fee
            source = 'local_fallback'
        else:
            source = 'lalamove'

        return JsonResponse({
            'success': True,
            'deliveryFee': round(float(delivery_fee), 2),
            'source': source,
            'distanceKm': distance_km,
            'raw': response_data,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            fallback_fee, distance_km = _calculate_local_delivery_fee(origin, destination)
            return JsonResponse({
                'success': True,
                'deliveryFee': fallback_fee,
                'source': 'local_fallback',
                'distanceKm': distance_km,
                'warning': str(e),
            })
        except Exception:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_create_payment_intent(request):
    """Create PayMongo payment intent for QR PH"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        amount = data.get('amount')

        if not amount or amount < 1:
            return JsonResponse({'success': False, 'error': 'Invalid amount'}, status=400)

        secret_key = settings.PAYMONGO_SECRET_KEY
        mode = settings.PAYMONGO_MODE

        if not secret_key:
            return JsonResponse({'success': False, 'error': 'PayMongo secret key is not configured'}, status=500)

        if requests is None:
            return JsonResponse({'success': False, 'error': 'Python requests library is not installed'}, status=500)

        # PayMongo expects amount in centavos
        amount_in_centavos = int(amount * 100)

        host = 'https://api.paymongo.com' if mode == 'production' else 'https://api.paymongo.com'
        url = f"{host}/v1/payment_intents"

        payload = {
            'data': {
                'attributes': {
                    'amount': amount_in_centavos,
                    'payment_method_allowed': ['qrph'],
                    'currency': 'PHP',
                    'description': 'Order from Mother Julie'
                }
            }
        }

        headers = {
            'Authorization': _paymongo_auth_header(secret_key),
            'Content-Type': 'application/json'
        }

        response = requests.post(url, headers=headers, json=payload, timeout=15)
        response_data = response.json() if response.content else {}

        if response.status_code not in (200, 201):
            return JsonResponse({'success': False, 'error': 'PayMongo API returned error', 'details': response_data}, status=response.status_code)

        return JsonResponse({'success': True, 'paymentIntent': response_data.get('data', {})})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_create_qr_payment_method(request):
    """Create PayMongo QR PH payment method"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        billing_name = data.get('billing_name', 'Customer')
        billing_email = data.get('billing_email', 'customer@example.com')

        secret_key = settings.PAYMONGO_SECRET_KEY
        mode = settings.PAYMONGO_MODE

        if not secret_key:
            return JsonResponse({'success': False, 'error': 'PayMongo secret key is not configured'}, status=500)

        if requests is None:
            return JsonResponse({'success': False, 'error': 'Python requests library is not installed'}, status=500)

        host = 'https://api.paymongo.com' if mode == 'production' else 'https://api.paymongo.com'
        url = f"{host}/v1/payment_methods"

        payload = {
            'data': {
                'attributes': {
                    'type': 'qrph',
                    'billing': {
                        'name': billing_name,
                        'email': billing_email
                    }
                }
            }
        }

        headers = {
            'Authorization': _paymongo_auth_header(secret_key),
            'Content-Type': 'application/json'
        }

        response = requests.post(url, headers=headers, json=payload, timeout=15)
        response_data = response.json() if response.content else {}

        if response.status_code not in (200, 201):
            return JsonResponse({'success': False, 'error': 'PayMongo API returned error', 'details': response_data}, status=response.status_code)

        return JsonResponse({'success': True, 'paymentMethod': response_data.get('data', {})})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_attach_payment_method(request):
    """Attach payment method to payment intent and get QR code"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        payment_intent_id = data.get('payment_intent_id')
        payment_method_id = data.get('payment_method_id')

        if not payment_intent_id or not payment_method_id:
            return JsonResponse({'success': False, 'error': 'Payment intent ID and payment method ID are required'}, status=400)

        secret_key = settings.PAYMONGO_SECRET_KEY
        mode = settings.PAYMONGO_MODE

        if not secret_key:
            return JsonResponse({'success': False, 'error': 'PayMongo API keys are not configured'}, status=500)

        if requests is None:
            return JsonResponse({'success': False, 'error': 'Python requests library is not installed'}, status=500)

        host = 'https://api.paymongo.com' if mode == 'production' else 'https://api.paymongo.com'
        url = f"{host}/v1/payment_intents/{payment_intent_id}/attach"

        payload = {
            'data': {
                'attributes': {
                    'payment_method': payment_method_id,
                    'return_url': f"{request.scheme}://{request.get_host()}/orders_menu/"
                }
            }
        }

        headers = {
            'Authorization': _paymongo_auth_header(secret_key),
            'Content-Type': 'application/json'
        }

        response = requests.post(url, headers=headers, json=payload, timeout=15)
        response_data = response.json() if response.content else {}

        if response.status_code not in (200, 201):
            return JsonResponse({'success': False, 'error': 'PayMongo API returned error', 'details': response_data}, status=response.status_code)

        return JsonResponse({'success': True, 'result': response_data.get('data', {})})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_check_payment_status(request, payment_intent_id):
    """Check PayMongo payment intent status"""
    try:
        secret_key = settings.PAYMONGO_SECRET_KEY
        mode = settings.PAYMONGO_MODE

        if not secret_key:
            return JsonResponse({'success': False, 'error': 'PayMongo API keys are not configured'}, status=500)

        if requests is None:
            return JsonResponse({'success': False, 'error': 'Python requests library is not installed'}, status=500)

        host = 'https://api.paymongo.com' if mode == 'production' else 'https://api.paymongo.com'
        url = f"{host}/v1/payment_intents/{payment_intent_id}"

        headers = {
            'Authorization': _paymongo_auth_header(secret_key),
            'Content-Type': 'application/json'
        }

        response = requests.get(url, headers=headers, timeout=15)
        response_data = response.json() if response.content else {}

        if response.status_code != 200:
            return JsonResponse({'success': False, 'error': 'PayMongo API returned error', 'details': response_data}, status=response.status_code)

        payment_data = response_data.get('data', {})
        status = payment_data.get('attributes', {}).get('status', 'unknown')

        return JsonResponse({
            'success': True,
            'status': status,
            'payment_data': payment_data
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_generate_qrph(request):
    """Generate PayMongo QR PH code"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

    try:
        mode = settings.PAYMONGO_MODE
        secret_key = (getattr(settings, 'PAYMONGO_SECRET_KEY', '') or '').strip()
        auth_header = (getattr(settings, 'PAYMONGO_QRPH_BASIC_AUTH', '') or '').strip()

        # Prefer proper PayMongo secret key auth when available
        if secret_key:
            auth_header = _paymongo_auth_header(secret_key)
        elif auth_header:
            if not auth_header.lower().startswith('basic '):
                auth_header = f'Basic {auth_header}'
        else:
            return JsonResponse({'success': False, 'error': 'PayMongo auth is not configured (set PAYMONGO_SECRET_KEY or PAYMONGO_QRPH_BASIC_AUTH)'}, status=500)

        if requests is None:
            return JsonResponse({'success': False, 'error': 'Python requests library is not installed'}, status=500)

        host = 'https://api.paymongo.com' if mode == 'production' else 'https://api.paymongo.com'
        url = f"{host}/v1/qrph/generate"

        payload = {
            "data": {
                "attributes": {
                    "kind": "instore"
                }
            }
        }

        headers = {
            'Authorization': auth_header,
            'accept': 'application/json',
            'Content-Type': 'application/json'
        }

        response = requests.post(url, json=payload, headers=headers, timeout=15)
        response_data = response.json() if response.content else {}

        if response.status_code not in (200, 201):
            paymongo_detail = None
            if isinstance(response_data, dict):
                paymongo_detail = (
                    response_data.get('errors', [{}])[0].get('detail')
                    if isinstance(response_data.get('errors'), list) and response_data.get('errors')
                    else None
                )
            return JsonResponse(
                {
                    'success': False,
                    'error': paymongo_detail or f'PayMongo API returned error ({response.status_code})',
                    'details': response_data
                },
                status=response.status_code
            )

        return JsonResponse({'success': True, 'qr_data': response_data})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_get_order_status(request, order_id):
    """Get order status for delivery/pickup tracking pages"""
    try:
        order = Order.objects.get(order_id=order_id)
        order_data = {
            'order_id': order.order_id,
            'customer_name': order.customer_name,
            'order_type': order.order_type,
            'status': order.status,
            'total_amount': float(order.total_amount),
            'order_placed': timezone.localtime(order.created_at).strftime('%Y-%m-%d %H:%M:%S'),
            'preparing_at': timezone.localtime(order.preparing_at).strftime('%Y-%m-%d %H:%M:%S') if order.preparing_at else None,
            'ready_at': timezone.localtime(order.ready_at).strftime('%Y-%m-%d %H:%M:%S') if order.ready_at else None,
            'picked_up_at': timezone.localtime(order.picked_up_at).strftime('%Y-%m-%d %H:%M:%S') if order.picked_up_at else None,
            'items': [
                {
                    'name': item.product_name,
                    'quantity': item.quantity,
                    'price': float(item.unit_price),
                    'size': getattr(item, 'size', '')
                } for item in order.order_items.all()
            ]
        }
        return JsonResponse(order_data)
    except Order.DoesNotExist:
        return JsonResponse({'error': 'Order not found'}, status=404)


def _send_order_status_email_sync(order_id, customer_email, customer_name, order_type, new_status, total_amount, items_data, email_content_prepared=None):
    """Internal function to send email synchronously - called from background thread with retry logic"""
    import time
    
    # Close old database connections to ensure clean connection in thread
    close_old_connections()
    
    # Retry logic for reliability - faster retries for delivery statuses
    is_delivery_status = new_status in ['out_for_delivery', 'delivered']
    max_retries = 3
    retry_delay = 0.3 if is_delivery_status else 0.5  # Faster retries for delivery statuses
    
    # Use pre-prepared content if available (for faster sending)
    if email_content_prepared:
        subject, html_message, plain_message = email_content_prepared
        # Get status display for logging
        status_display = dict(Order.ORDER_STATUS_CHOICES).get(new_status, new_status.replace('_', ' ').title())
    else:
        # Get status display name
        status_display = dict(Order.ORDER_STATUS_CHOICES).get(new_status, new_status.replace('_', ' ').title())
        
        # Format order items exactly as shown in the image
        items_list = []
        for item in items_data:
            item_text = f"- {item['name']} x {item['quantity']}"
            if item.get('size'):
                item_text += f" (Size: {item['size']})"
            item_text += f" - ₱{item['total_price']:.2f}"
            items_list.append(item_text)
        items_text = "\n".join(items_list)
        
        # Format order type
        order_type_display = dict(Order.ORDER_TYPE_CHOICES).get(order_type, order_type)
        
        # Create email subject
        subject = f'[ORDER UPDATE] Order {order_id} - Status: {status_display}'
        
        # Create HTML email content
        html_message = _build_email_html(order_id, customer_name, order_type_display, status_display, total_amount, items_text)
        
        # Plain text version
        plain_message = _build_email_plain(customer_name, order_id, order_type_display, status_display, total_amount, items_text)
    
    # Special logging for delivery statuses
    if is_delivery_status:
        print(f"[EMAIL] ⚠ DELIVERY STATUS EMAIL SEND (FAST MODE): {new_status} for order {order_id}")
    
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[EMAIL] Attempt {attempt}/{max_retries}: Sending order status email to {customer_email} for order {order_id}")
            if is_delivery_status:
                print(f"[EMAIL] ⚠ Delivery status email attempt {attempt}: {new_status} -> {status_display}")
            
            # Create email object
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[customer_email]
            )
            email.attach_alternative(html_message, "text/html")
            
            # Send email with timeout handling
            email.send(fail_silently=False)
            
            print(f"[EMAIL SUCCESS] Order status email sent successfully to {customer_email} for order {order_id}")
            if is_delivery_status:
                print(f"[EMAIL SUCCESS] ✓✓ DELIVERY STATUS EMAIL SENT: {new_status} for order {order_id}")
            return  # Success - exit function
            
        except Exception as e:
            import traceback
            error_msg = str(e)
            print(f"[EMAIL ERROR] Attempt {attempt}/{max_retries} failed: {error_msg}")
            
            if attempt < max_retries:
                print(f"[EMAIL] Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 1.5 if is_delivery_status else 2  # Faster backoff for delivery statuses
            else:
                print(f"[EMAIL ERROR] All {max_retries} attempts failed for order {order_id}")
                print(f"[EMAIL ERROR] Traceback: {traceback.format_exc()}")
                # Don't fail the status update if email fails - just log the error


def _build_email_html(order_id, customer_name, order_type_display, status_display, total_amount, items_text):
    """Build HTML email content"""
    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f7f8;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden;">
            <tr>
              <td align="center" style="padding:28px 28px 8px 28px;">
                <h1 style="margin:16px 0 0 0;font-size:22px;line-height:28px;color:#d63384;">Order Status Update</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                <p>Dear {customer_name},</p>
                <p>Your order status has been updated:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p style="margin:8px 0;"><strong>Order ID:</strong> {order_id}</p>
                  <p style="margin:8px 0;"><strong>Order Type:</strong> {order_type_display}</p>
                  <p style="margin:8px 0;"><strong>Status:</strong> <span style="color: #d63384; font-weight: bold;">{status_display}</span></p>
                  <p style="margin:8px 0;"><strong>Total Amount:</strong> ₱{total_amount:.2f}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                <h4 style="color: #333; margin-top: 20px; margin-bottom: 10px;">Order Items:</h4>
                <div style="background-color: #ffffff; padding: 10px; border-left: 3px solid #d63384; margin-top: 10px;">
                  {items_text.replace(chr(10), '<br>')}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 24px 28px;font-size:14px;line-height:22px;color:#333;">
                <p>Thank you for choosing Mother Julie!</p>
              </td>
            </tr>
          </table>
          <div style="padding:14px 0 0 0;font-size:11px;color:#9aa0a6;">
            Sent by Mother Julie • Please do not reply to this automated message.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _build_email_plain(customer_name, order_id, order_type_display, status_display, total_amount, items_text):
    """Build plain text email content"""
    return f"""Dear {customer_name},

Your order status has been updated:

Order ID: {order_id}
Order Type: {order_type_display}
Status: {status_display}
Total Amount: ₱{total_amount:.2f}

Order Items:
{items_text}

Thank you for choosing Mother Julie!

---
This is an automated email. Please do not reply to this message."""


def send_order_status_email(order, new_status):
    """Send email notification to customer when order status is updated (optimized for speed)"""
    # Skip email sending for dine-in orders
    if order.order_type == 'dine-in':
        print(f"[EMAIL] ✗ Skipping email for dine-in order {order.order_id} - emails not sent for dine-in orders")
        return
    
    # Special handling for delivery statuses
    is_delivery_status = new_status in ['out_for_delivery', 'delivered']
    
    # Check if email exists - be more explicit about the check
    if not order.customer_email or order.customer_email.strip() == '':
        if is_delivery_status:
            print(f"[EMAIL] ✗✗ CRITICAL: Cannot send delivery status email - NO EMAIL ADDRESS!")
        return
    
    # Prepare all email content BEFORE threading for faster sending
    try:
        # Get status display name
        status_display = dict(Order.ORDER_STATUS_CHOICES).get(new_status, new_status.replace('_', ' ').title())
        
        # Format order items
        items_list = []
        for item in order.order_items.all():
            item_text = f"- {item.product_name} x {item.quantity}"
            if item.size:
                item_text += f" (Size: {item.size})"
            item_text += f" - ₱{float(item.total_price):.2f}"
            items_list.append(item_text)
        items_text = "\n".join(items_list)
        
        # Format order type
        order_type_display = dict(Order.ORDER_TYPE_CHOICES).get(order.order_type, order.order_type)
        
        # Create email subject
        subject = f'[ORDER UPDATE] Order {order.order_id} - Status: {status_display}'
        
        # Build email content
        html_message = _build_email_html(order.order_id, order.customer_name, order_type_display, status_display, float(order.total_amount), items_text)
        plain_message = _build_email_plain(order.customer_name, order.order_id, order_type_display, status_display, float(order.total_amount), items_text)
        
        # Store data in variables to avoid database access in thread
        order_id = order.order_id
        customer_email = order.customer_email
        customer_name = order.customer_name
        order_type = order.order_type
        total_amount = float(order.total_amount)
        
        # Pre-prepared email content for faster sending
        email_content_prepared = (subject, html_message, plain_message)
        
        if is_delivery_status:
            print(f"[EMAIL] ⚠ FAST MODE: Delivery status email prepared for {order_id}")
        
        # Send email in background thread - content already prepared for instant sending
        email_thread = threading.Thread(
            target=_send_order_status_email_sync,
            args=(
                order_id,
                customer_email,
                customer_name,
                order_type,
                new_status,
                total_amount,
                [],  # Empty items_data since content is pre-prepared
                email_content_prepared  # Pass pre-prepared content
            ),
            daemon=False,
            name=f"EmailThread-{order_id}-{order_type}"
        )
        email_thread.start()
        
        if is_delivery_status:
            print(f"[EMAIL] ✓✓ FAST MODE: Delivery status email thread started immediately for {order_id}")
    except Exception as e:
        import traceback
        print(f"[EMAIL ERROR] Error preparing email: {str(e)}")
        print(f"[EMAIL ERROR] Traceback: {traceback.format_exc()}")


@csrf_exempt
def api_update_order_status(request, order_id):
    """Update order status from admin dashboard"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            new_status = data.get('status')
            
            print(f"[ORDER UPDATE] Received status update request for order {order_id}: {new_status}")
            
            # Use select_related to optimize database query
            order = Order.objects.select_related('user').prefetch_related('order_items').get(order_id=order_id)
            old_status = order.status
            
            print(f"[ORDER UPDATE] Order found: ID={order.order_id}, Type={order.order_type}, Email={order.customer_email}, Current Status={old_status}")
            
            # Only update if status actually changed
            if old_status != new_status:
                # Check if status is being skipped and send emails for intermediate statuses
                intermediate_statuses = []
                
                # For pickup orders: ensure ready_for_pickup is sent before picked_up
                if order.order_type == 'pickup':
                    if old_status == 'preparing' and new_status == 'picked_up':
                        intermediate_statuses.append('ready_for_pickup')
                    elif old_status in ['order_placed', 'preparing'] and new_status == 'picked_up':
                        intermediate_statuses.append('preparing')
                        intermediate_statuses.append('ready_for_pickup')
                
                # For delivery orders: ensure ready_for_delivery is sent before out_for_delivery
                elif order.order_type == 'delivery':
                    if old_status == 'preparing' and new_status == 'out_for_delivery':
                        intermediate_statuses.append('ready_for_delivery')
                    elif old_status in ['order_placed', 'preparing'] and new_status == 'out_for_delivery':
                        if old_status == 'order_placed':
                            intermediate_statuses.append('preparing')
                        intermediate_statuses.append('ready_for_delivery')
                    elif old_status == 'preparing' and new_status == 'delivered':
                        intermediate_statuses.append('ready_for_delivery')
                        intermediate_statuses.append('out_for_delivery')
                
                # Send emails for intermediate statuses first (without changing order status in DB)
                # Skip intermediate emails for dine-in orders
                if order.order_type != 'dine-in':
                    for intermediate_status in intermediate_statuses:
                        if intermediate_status != old_status:  # Don't send if it's the current status
                            print(f"[ORDER UPDATE] ⚠ Status jump detected! Sending intermediate status email: {intermediate_status}")
                            
                            # Get customer email
                            customer_email = order.customer_email
                            if not customer_email or customer_email.strip() == '':
                                if order.user and order.user.email:
                                    customer_email = order.user.email
                            
                            # Send email for intermediate status (order status remains unchanged in DB)
                            if customer_email and customer_email.strip() != '':
                                try:
                                    # Create a temporary order object with intermediate status for email sending
                                    # We'll pass the intermediate status directly to send_order_status_email
                                    # The function will use the current order data but with the intermediate status
                                    send_order_status_email(order, intermediate_status)
                                    print(f"[ORDER UPDATE] ✓ Intermediate status email sent: {intermediate_status}")
                                except Exception as e:
                                    print(f"[ORDER UPDATE ERROR] Failed to send intermediate status email: {str(e)}")
                            else:
                                print(f"[ORDER UPDATE] ✗ Cannot send intermediate status email - no customer email")
                else:
                    print(f"[ORDER UPDATE] ✗ Skipping intermediate status emails for dine-in order")
                
                # Now update to the final status
                order.status = new_status
                order.updated_at = timezone.now()
                order.save()
                
                print(f"[ORDER UPDATE] Order status saved: {old_status} -> {new_status}")
                if intermediate_statuses:
                    print(f"[ORDER UPDATE] ✓ Sent {len(intermediate_statuses)} intermediate status email(s) before final status")
                
                # Send email notification immediately after status update
                # Refresh order to ensure all related data is available
                order.refresh_from_db()
                
                # Check customer email - log detailed info for delivery orders
                print(f"[ORDER UPDATE] Checking email for order {order_id}:")
                print(f"  - Order Type: {order.order_type}")
                print(f"  - Customer Email (from order): {order.customer_email}")
                print(f"  - Customer Email is None: {order.customer_email is None}")
                print(f"  - Customer Email is empty: {order.customer_email == '' if order.customer_email else 'N/A'}")
                print(f"  - Customer Email bool: {bool(order.customer_email)}")
                
                # Try to get email from order, or fallback to user's email
                customer_email = order.customer_email
                if not customer_email or customer_email.strip() == '':
                    # Try to get email from associated user
                    if order.user and order.user.email:
                        customer_email = order.user.email
                        # Update the order with the user's email for future notifications
                        order.customer_email = customer_email
                        order.save(update_fields=['customer_email'])
                        print(f"[ORDER UPDATE] ✓ Found email from user account: {customer_email}")
                        print(f"[ORDER UPDATE] ✓ Updated order with customer email")
                
                # Send email notification if customer has email
                # Skip email sending for dine-in orders
                if order.order_type == 'dine-in':
                    print(f"[ORDER UPDATE] ✗ Skipping email for dine-in order {order_id} - emails not sent for dine-in orders")
                else:
                    # Special logging for delivery statuses
                    is_delivery_status = new_status in ['out_for_delivery', 'delivered']
                    if is_delivery_status:
                        print(f"[ORDER UPDATE] ⚠ DELIVERY STATUS DETECTED: {new_status} for order {order_id}")
                        print(f"[ORDER UPDATE] ⚠ Order Type: {order.order_type}, Email: {customer_email}")
                    
                    if customer_email and customer_email.strip() != '':
                        print(f"[ORDER UPDATE] ✓ Email found! Sending notification for order {order_id} ({order.order_type}): {old_status} -> {new_status}")
                        print(f"[ORDER UPDATE] ✓ Email address: {customer_email}")
                        try:
                            # Ensure order has the email before sending
                            if not order.customer_email or order.customer_email.strip() == '':
                                order.customer_email = customer_email
                                order.save(update_fields=['customer_email'])
                                order.refresh_from_db()
                                print(f"[ORDER UPDATE] ✓ Updated order with customer email: {customer_email}")
                                print(f"[ORDER UPDATE] ✓ Order refreshed, email confirmed: {order.customer_email}")
                            
                            # Force email sending for delivery statuses
                            if is_delivery_status:
                                print(f"[ORDER UPDATE] ⚠ FORCING EMAIL SEND for delivery status: {new_status}")
                                print(f"[ORDER UPDATE] ⚠ Final check - Order email: {order.customer_email}, Status: {new_status}")
                            
                            # Double-check email is present before sending
                            if order.customer_email and order.customer_email.strip() != '':
                                send_order_status_email(order, new_status)
                                print(f"[ORDER UPDATE] ✓ Email sending function called successfully for order {order_id}")
                            else:
                                print(f"[ORDER UPDATE] ✗✗ CRITICAL: Order email is still empty after update! Cannot send email.")
                                if is_delivery_status:
                                    print(f"[ORDER UPDATE] ✗✗ CRITICAL: DELIVERY STATUS EMAIL FAILED - Order email is empty!")
                            
                            # Additional confirmation for delivery statuses
                            if is_delivery_status:
                                print(f"[ORDER UPDATE] ✓✓ DELIVERY STATUS EMAIL TRIGGERED: {new_status} for order {order_id}")
                        except Exception as email_error:
                            import traceback
                            print(f"[ORDER UPDATE ERROR] Exception in send_order_status_email: {str(email_error)}")
                            print(f"[ORDER UPDATE ERROR] Traceback: {traceback.format_exc()}")
                            if is_delivery_status:
                                print(f"[ORDER UPDATE ERROR] ⚠⚠ CRITICAL: Email failed for delivery status {new_status}!")
                    else:
                        print(f"[ORDER UPDATE] ✗ NO EMAIL - Status changed for order {order_id} ({order.order_type}): {old_status} -> {new_status}")
                        print(f"[ORDER UPDATE] ✗ Customer email is missing or empty. Email will NOT be sent.")
                        print(f"[ORDER UPDATE] ✗ Order has no email and user has no email either.")
                        if is_delivery_status:
                            print(f"[ORDER UPDATE] ✗✗ CRITICAL: Cannot send email for delivery status {new_status} - NO EMAIL ADDRESS!")
            else:
                print(f"[ORDER UPDATE] Status unchanged for order {order_id}: {old_status}")
            
            return JsonResponse({'success': True, 'message': 'Order status updated'})
        except Order.DoesNotExist:
            print(f"[ORDER UPDATE ERROR] Order {order_id} not found")
            return JsonResponse({'error': 'Order not found'}, status=404)
        except Exception as e:
            import traceback
            print(f"[ORDER UPDATE ERROR] {str(e)}")
            print(f"[ORDER UPDATE ERROR] Traceback: {traceback.format_exc()}")
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Invalid method'}, status=405)


@csrf_exempt
def api_get_orders(request):
    """Get all orders for admin dashboard"""
    try:
        orders = Order.objects.all().order_by('-created_at')
        orders_data = []
        
        for order in orders:
            order_data = {
                'order_id': order.order_id,
                'customer_name': order.customer_name,
                'order_type': order.order_type,
                'status': order.status,
                'total_amount': float(order.total_amount),
                'payment_method': getattr(order, 'payment_method', 'Cash'),
                # Convert to Philippine time (Asia/Manila) before sending
                'created_at': timezone.localtime(order.created_at).strftime('%Y-%m-%d %H:%M:%S'),
                'items_count': order.order_items.count(),
                'items': [
                    {
                        'name': item.product_name,
                        'quantity': item.quantity,
                        'price': float(item.unit_price),
                        'size': getattr(item, 'size', '')
                    } for item in order.order_items.all()
                ]
            }
            orders_data.append(order_data)
        
        return JsonResponse(orders_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_delete_order(request, order_id):
    """Delete an order"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        order = Order.objects.get(order_id=order_id)
        order.delete()
        return JsonResponse({'success': True, 'message': 'Order deleted successfully'})
    except Order.DoesNotExist:
        return JsonResponse({'error': 'Order not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_delete_all_orders(request):
    """Delete all orders"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        # Delete all orders (this will cascade delete order items)
        count = Order.objects.all().count()
        Order.objects.all().delete()
        return JsonResponse({
            'success': True, 
            'message': f'Successfully deleted {count} order(s)',
            'deleted_count': count
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_get_analytics(request):
    """Get analytics data for dashboard"""
    try:
        from django.db.models import Sum, Count, Q
        from datetime import datetime, timedelta
        
        # Get all orders
        all_orders = Order.objects.exclude(status='cancelled')
        
        # Calculate total sales
        total_sales = all_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        # Calculate total products sold
        total_products_sold = OrderItem.objects.filter(
            order__in=all_orders
        ).aggregate(Sum('quantity'))['quantity__sum'] or 0
        
        # Get previous period totals for comparison
        now = timezone.now()
        previous_period_start = now - timedelta(days=30)
        previous_orders = all_orders.filter(created_at__lt=previous_period_start)
        previous_sales = previous_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        previous_products = OrderItem.objects.filter(
            order__in=previous_orders
        ).aggregate(Sum('quantity'))['quantity__sum'] or 0
        
        # Calculate percentage changes
        sales_change = ((float(total_sales) - float(previous_sales)) / float(previous_sales) * 100) if previous_sales > 0 else 0
        products_change = ((total_products_sold - previous_products) / previous_products * 100) if previous_products > 0 else 0
        
        # Get order statistics (last 50 orders)
        recent_orders = all_orders.order_by('-created_at')[:50]
        order_stats = []
        for order in recent_orders:
            items_count = order.order_items.aggregate(Sum('quantity'))['quantity__sum'] or 0
            # Get order items with details
            order_items = []
            for item in order.order_items.all():
                order_items.append({
                    'name': item.product_name,
                    'size': item.size or '',
                    'quantity': item.quantity,
                    'price': float(item.unit_price),
                    'total': float(item.total_price)
                })
            
            order_stats.append({
                'order_id': order.order_id,
                'customer': order.customer_name,
                'payment_reference': order.payment_reference or '',
                'order_type': order.order_type,
                'order_placed': timezone.localtime(order.created_at).strftime('%Y-%m-%d %H:%M:%S'),
                'delivery_pickup_date': timezone.localtime(order.updated_at).strftime('%Y-%m-%d %H:%M:%S'),
                'items_count': items_count,
                'items': order_items,
                'total_amount': float(order.total_amount),
                'status': order.status
            })
        
        return JsonResponse({
            'total_sales': float(total_sales),
            'total_products_sold': total_products_sold,
            'sales_change': sales_change,
            'products_change': products_change,
            'order_stats': order_stats,
            'order_count': all_orders.count()
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_get_product_stock(request, product_id):
    """Get current stock for a specific product"""
    try:
        product = Product.objects.get(id=product_id)
        return JsonResponse({
            'id': product.id,
            'name': product.name,
            'stock': product.stock_quantity,
            'is_active': product.is_active,
            'show_in_all_menu': product.show_in_all_menu
        })
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_get_products(request):
    """Get all products (admin)"""
    if not request.user.is_authenticated or not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    try:
        products = Product.objects.all().order_by('name')
        products_data = []
        
        for product in products:
            image_url = ''
            try:
                if product.image:
                    # Get absolute URL for the image
                    image_url = request.build_absolute_uri(product.image.url)
            except (ValueError, AttributeError):
                # Image field exists but file doesn't exist or is empty
                image_url = ''
            except Exception as e:
                # Handle any other errors
                print(f"Error getting image URL for product {product.id}: {e}")
                image_url = ''
            
            products_data.append({
                'id': product.id,
                'name': product.name,
                'price': float(product.price),
                'category': product.category or '',
                'stock': product.stock_quantity,
                'image': image_url,
                'size_options': product.size_options or {}
            })
        
        return JsonResponse(products_data, safe=False)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_get_products_public(request):
    """Get products for public website (show_in_all_menu=True)
    Products with 0 stock are still shown but marked as out of stock"""
    try:
        # Only filter by show_in_all_menu - don't filter by is_active or stock
        # This ensures products remain visible even when stock is 0
        products = Product.objects.filter(show_in_all_menu=True).order_by('name')
        products_data = []
        
        for product in products:
            image_url = ''
            try:
                if product.image:
                    # Get absolute URL for the image
                    image_url = request.build_absolute_uri(product.image.url)
            except (ValueError, AttributeError):
                # Image field exists but file doesn't exist or is empty
                image_url = ''
            except Exception as e:
                # Handle any other errors
                print(f"Error getting image URL for product {product.id}: {e}")
                image_url = ''
            
            # Map category names to match frontend expectations
            category_map = {
                'spud': 'spuds',
                'pasta_bread': 'pasta',
                'appetizers': 'appetizers',
                'wrap': 'wrap',
                'desserts': 'desserts'
            }
            frontend_category = category_map.get(product.category, product.category or '')
            
            products_data.append({
                'id': product.id,
                'name': product.name,
                'price': float(product.price),
                'category': frontend_category,
                'stock': product.stock_quantity,
                'image': image_url,
                'size_options': product.size_options or {},
                'description': product.description or ''
            })
        
        return JsonResponse(products_data, safe=False)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_create_product(request):
    """Create a new product"""
    if not request.user.is_authenticated or not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        # Check if this is a multipart form data (file upload) or JSON
        if request.FILES.get('image'):
            name = request.POST.get('name')
            price = request.POST.get('price')
            category = request.POST.get('category', '')
            stock = request.POST.get('stock', 0)
            image = request.FILES.get('image')
        else:
            data = json.loads(request.body)
            name = data.get('name')
            price = data.get('price')
            category = data.get('category', '')
            stock = data.get('stock', 0)
            image = None
        
        if not name or not price:
            return JsonResponse({'error': 'Name and price are required'}, status=400)
        
        product = Product.objects.create(
            name=name,
            price=price,
            stock_quantity=stock,
            category=category if category else None,
            show_in_all_menu=True,
            is_active=True
        )
        
        # Handle image upload
        if image:
            product.image = image
            product.save()
        
        image_url = ''
        try:
            if product.image:
                image_url = request.build_absolute_uri(product.image.url)
        except Exception as e:
            print(f"Error getting image URL: {e}")
        
        return JsonResponse({
            'success': True,
            'product': {
                'id': product.id,
                'name': product.name,
                'price': float(product.price),
                'stock': product.stock_quantity,
                'category': product.category or '',
                'image': image_url
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_update_product(request, product_id):
    """Update a product"""
    if not request.user.is_authenticated or not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        product = Product.objects.get(id=product_id)
        
        # Check if this is a multipart form data (file upload) or JSON
        if request.FILES.get('image') or request.POST:
            if 'name' in request.POST:
                product.name = request.POST.get('name')
            if 'price' in request.POST:
                product.price = request.POST.get('price')
            if 'stock' in request.POST:
                product.stock_quantity = request.POST.get('stock')
            if 'category' in request.POST:
                category = request.POST.get('category', '')
                product.category = category if category else None
            if 'size_options' in request.POST:
                try:
                    size_options = json.loads(request.POST.get('size_options', '{}'))
                    product.size_options = size_options
                except:
                    pass
            if 'show_in_all_menu' in request.POST:
                product.show_in_all_menu = request.POST.get('show_in_all_menu') == 'true' or request.POST.get('show_in_all_menu') == 'True'
            else:
                # If not set, ensure it stays True (visible)
                product.show_in_all_menu = True
            if 'is_active' in request.POST:
                product.is_active = request.POST.get('is_active') == 'true' or request.POST.get('is_active') == 'True'
            else:
                # If not set, ensure it stays True (active)
                product.is_active = True
            if request.FILES.get('image'):
                product.image = request.FILES.get('image')
        else:
            data = json.loads(request.body)
            
            if 'name' in data:
                product.name = data['name']
            if 'price' in data:
                product.price = data['price']
            if 'stock' in data:
                product.stock_quantity = data['stock']
            if 'category' in data:
                category = data.get('category', '')
                product.category = category if category else None
            if 'size_options' in data:
                product.size_options = data.get('size_options', {})
            if 'show_in_all_menu' in data:
                product.show_in_all_menu = data.get('show_in_all_menu', True)
            else:
                # If not set, ensure it stays True
                product.show_in_all_menu = True
            if 'is_active' in data:
                product.is_active = data.get('is_active', True)
            else:
                # If not set, ensure it stays True
                product.is_active = True
        
        product.save()
        
        image_url = ''
        try:
            if product.image:
                image_url = request.build_absolute_uri(product.image.url)
        except Exception as e:
            print(f"Error getting image URL: {e}")
        
        return JsonResponse({
            'success': True,
            'product': {
                'id': product.id,
                'name': product.name,
                'price': float(product.price),
                'stock': product.stock_quantity,
                'category': product.category or '',
                'image': image_url,
                'size_options': product.size_options or {}
            }
        })
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_delete_product(request, product_id):
    """Delete a product"""
    if not request.user.is_authenticated or not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        product = Product.objects.get(id=product_id)
        product.delete()
        return JsonResponse({'success': True})
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_get_reports(request, period):
    """Get reports for daily, weekly, monthly, yearly"""
    # Admin-only analytics
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    try:
        from django.db.models import Sum, Q
        from datetime import datetime, timedelta
        
        now = timezone.now()
        
        # Define date ranges based on period
        if period == 'daily':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            previous_start = start_date - timedelta(days=1)
            previous_end = start_date
        elif period == 'weekly':
            start_date = now - timedelta(days=7)
            previous_start = start_date - timedelta(days=7)
            previous_end = start_date
        elif period == 'monthly':
            start_date = now - timedelta(days=30)
            previous_start = start_date - timedelta(days=30)
            previous_end = start_date
        elif period == 'yearly':
            start_date = now - timedelta(days=365)
            previous_start = start_date - timedelta(days=365)
            previous_end = start_date
        else:
            return JsonResponse({'error': 'Invalid period'}, status=400)
        
        # Get current period orders
        current_orders = Order.objects.exclude(status='cancelled').filter(
            created_at__gte=start_date
        )
        
        # Get previous period orders
        previous_orders = Order.objects.exclude(status='cancelled').filter(
            created_at__gte=previous_start,
            created_at__lt=previous_end
        )
        
        # Calculate current period metrics
        current_sales = current_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        current_products = OrderItem.objects.filter(
            order__in=current_orders
        ).aggregate(Sum('quantity'))['quantity__sum'] or 0
        
        # Calculate previous period metrics
        previous_sales = previous_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        previous_products = OrderItem.objects.filter(
            order__in=previous_orders
        ).aggregate(Sum('quantity'))['quantity__sum'] or 0
        
        # Calculate percentage changes
        sales_change = ((float(current_sales) - float(previous_sales)) / float(previous_sales) * 100) if previous_sales > 0 else 0
        products_change = ((current_products - previous_products) / previous_products * 100) if previous_products > 0 else 0
        
        # Get detailed product sales information
        from django.db.models import Sum, Count
        product_sales = OrderItem.objects.filter(
            order__in=current_orders
        ).values('product_name', 'size').annotate(
            total_quantity=Sum('quantity'),
            total_revenue=Sum('total_price'),
            order_count=Count('order', distinct=True)
        ).order_by('-total_quantity')
        
        # Format product sales data
        products_list = []
        for item in product_sales:
            product_name = item['product_name']
            size = item['size'] or ''
            display_name = f"{product_name}{' (' + size + ')' if size else ''}"
            
            products_list.append({
                'name': display_name,
                'quantity': item['total_quantity'],
                'revenue': float(item['total_revenue']),
                'orders': item['order_count']
            })
        
        return JsonResponse({
            'period': period,
            'sales': float(current_sales),
            'products_sold': current_products,
            'sales_change': sales_change,
            'products_change': products_change,
            'products_list': products_list,
            'period_start': timezone.localtime(start_date).strftime('%Y-%m-%d %H:%M:%S'),
            'period_end': timezone.localtime(now).strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_get_monthly_reports(request, year=None, month=None):
    """Get daily sales data for a specific month for line graph visualization"""
    # Admin-only analytics
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    try:
        from django.db.models import Sum
        from datetime import datetime, timedelta
        from calendar import monthrange
        
        now = timezone.now()
        
        # Use provided year/month or current
        if year is None or month is None:
            year = now.year
            month = now.month
        else:
            year = int(year)
            month = int(month)
        
        # Validate month/year
        if month < 1 or month > 12:
            return JsonResponse({'error': 'Invalid month'}, status=400)
        
        # Get first and last day of month using the current timezone
        month_info = monthrange(year, month)
        first_day = timezone.make_aware(datetime(year, month, 1, 0, 0, 0))
        last_day = timezone.make_aware(datetime(year, month, month_info[1], 23, 59, 59))
        
        # Get orders for this month
        month_orders = Order.objects.exclude(status='cancelled').filter(
            created_at__gte=first_day,
            created_at__lte=last_day
        )
        
        # Get daily sales for this month
        daily_sales = {}
        for day in range(1, month_info[1] + 1):
            day_start = timezone.make_aware(datetime(year, month, day, 0, 0, 0))
            day_end = timezone.make_aware(datetime(year, month, day, 23, 59, 59))
            
            day_orders = month_orders.filter(
                created_at__gte=day_start,
                created_at__lte=day_end
            )
            day_sales = day_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            daily_sales[day] = float(day_sales)
        
        # Calculate statistics
        total_sales = month_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        # Find highest and lowest sales days
        sales_list = [(day, amount) for day, amount in daily_sales.items()]
        highest_day = max(sales_list, key=lambda x: x[1]) if sales_list else (0, 0)
        lowest_day = min(sales_list, key=lambda x: x[1]) if sales_list else (0, 0)
        
        # Get all available months for dropdown
        all_months = []
        all_orders = Order.objects.exclude(status='cancelled').values_list('created_at', flat=True).order_by('-created_at')
        months_set = set()
        for order_date in all_orders:
            if order_date:
                # Extract year and month from the order date
                order_year = order_date.year
                order_month = order_date.month
                months_set.add((order_year, order_month))
        
        # Sort months in reverse chronological order
        for y, m in sorted(months_set, reverse=True)[:12]:  # Last 12 months
            months_name = datetime(y, m, 1).strftime('%B %Y')
            all_months.append({'year': y, 'month': m, 'name': months_name})
        
        return JsonResponse({
            'year': year,
            'month': month,
            'month_name': datetime(year, month, 1).strftime('%B %Y'),
            'daily_sales': daily_sales,
            'total_sales': float(total_sales),
            'highest_sales_day': highest_day[0],
            'highest_sales_amount': highest_day[1],
            'lowest_sales_day': lowest_day[0] if lowest_day[1] > 0 else 0,
            'lowest_sales_amount': lowest_day[1],
            'available_months': all_months
        })
    except Exception as e:
        import traceback
        print(f"Error in api_get_monthly_reports: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({'error': str(e)}, status=500)


# Frontend Content Management APIs
@csrf_exempt
def api_get_frontend_content(request):
    """Get all frontend content for public website"""
    try:
        contents = FrontendContent.objects.filter(is_active=True).order_by('order', 'section_key')
        content_dict = {}
        for content in contents:
            content_dict[content.section_key] = content.content
        
        return JsonResponse(content_dict)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_get_all_frontend_content(request):
    """Get all frontend content (including inactive) for admin dashboard"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    try:
        contents = FrontendContent.objects.all().order_by('order', 'section_key')
        contents_data = []
        for content in contents:
            contents_data.append({
                'id': content.id,
                'section_key': content.section_key,
                'section_name': content.get_section_key_display(),
                'content': content.content,
                'is_active': content.is_active,
                'order': content.order,
                'created_at': timezone.localtime(content.created_at).strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': timezone.localtime(content.updated_at).strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return JsonResponse(contents_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_create_frontend_content(request):
    """Create new frontend content"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        data = json.loads(request.body)
        section_key = data.get('section_key')
        content = data.get('content', '')
        is_active = data.get('is_active', True)
        order = data.get('order', 0)
        
        if not section_key:
            return JsonResponse({'error': 'section_key is required'}, status=400)
        
        # Check if section_key already exists
        if FrontendContent.objects.filter(section_key=section_key).exists():
            return JsonResponse({'error': 'Content with this section_key already exists'}, status=400)
        
        frontend_content = FrontendContent.objects.create(
            section_key=section_key,
            content=content,
            is_active=is_active,
            order=order
        )
        
        return JsonResponse({
            'success': True,
            'content': {
                'id': frontend_content.id,
                'section_key': frontend_content.section_key,
                'section_name': frontend_content.get_section_key_display(),
                'content': frontend_content.content,
                'is_active': frontend_content.is_active,
                'order': frontend_content.order
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_update_frontend_content(request, content_id):
    """Update frontend content"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        content_obj = FrontendContent.objects.get(id=content_id)
        data = json.loads(request.body)
        
        if 'content' in data:
            content_obj.content = data['content']
        if 'is_active' in data:
            content_obj.is_active = data['is_active']
        if 'order' in data:
            content_obj.order = data['order']
        if 'section_key' in data:
            # Check if new section_key already exists (excluding current)
            if FrontendContent.objects.filter(section_key=data['section_key']).exclude(id=content_id).exists():
                return JsonResponse({'error': 'Content with this section_key already exists'}, status=400)
            content_obj.section_key = data['section_key']
        
        content_obj.save()
        
        return JsonResponse({
            'success': True,
            'content': {
                'id': content_obj.id,
                'section_key': content_obj.section_key,
                'section_name': content_obj.get_section_key_display(),
                'content': content_obj.content,
                'is_active': content_obj.is_active,
                'order': content_obj.order
            }
        })
    except FrontendContent.DoesNotExist:
        return JsonResponse({'error': 'Content not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_delete_frontend_content(request, content_id):
    """Delete frontend content"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        content_obj = FrontendContent.objects.get(id=content_id)
        content_obj.delete()
        return JsonResponse({'success': True, 'message': 'Content deleted successfully'})
    except FrontendContent.DoesNotExist:
        return JsonResponse({'error': 'Content not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# User Management APIs
@csrf_exempt
def api_get_users(request):
    """Get all users for admin dashboard"""
    # Admin-only: staff should not access user management.
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    try:
        users = User.objects.all().order_by('-date_joined')
        users_data = []
        
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'is_active': user.is_active,
                'date_joined': timezone.localtime(user.date_joined).strftime('%Y-%m-%d %H:%M:%S'),
                'last_login': timezone.localtime(user.last_login).strftime('%Y-%m-%d %H:%M:%S') if user.last_login else 'Never'
            })
        
        return JsonResponse(users_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_update_user(request, user_id):
    """Update user (staff/superuser status) - superuser only"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        user = User.objects.get(id=user_id)
        data = json.loads(request.body)
        
        # Prevent removing own superuser status
        if user.id == request.user.id and 'is_superuser' in data and not data['is_superuser']:
            return JsonResponse({'error': 'Cannot remove your own superuser status'}, status=400)
        
        if 'is_staff' in data:
            user.is_staff = data['is_staff']
        if 'is_superuser' in data:
            user.is_superuser = data['is_superuser']
            # Keep roles consistent: superusers should always be staff.
            if user.is_superuser:
                user.is_staff = True
        if 'is_active' in data:
            user.is_active = data['is_active']
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']
        
        user.save()
        
        return JsonResponse({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'is_active': user.is_active
            }
        })
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_delete_user(request, user_id):
    """Delete user - superuser only"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        # Prevent deleting own account
        if request.user.id == user_id:
            return JsonResponse({'error': 'Cannot delete your own account'}, status=400)
        
        user = User.objects.get(id=user_id)
        username = user.username
        user.delete()
        
        return JsonResponse({'success': True, 'message': f'User {username} deleted successfully'})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_create_user(request):
    """Create new user - superuser only"""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        is_staff = data.get('is_staff', False)
        is_superuser = data.get('is_superuser', False)

        # Keep roles consistent: superusers should always be staff.
        if is_superuser:
            is_staff = True
        
        # Validation
        if not username or not password or not email:
            return JsonResponse({'error': 'Username, email, and password are required'}, status=400)
        
        if User.objects.filter(username=username).exists():
            return JsonResponse({'error': 'Username already exists'}, status=400)
        
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already exists'}, status=400)
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_staff=is_staff,
            is_superuser=is_superuser
        )
        
        return JsonResponse({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'is_active': user.is_active
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
    
