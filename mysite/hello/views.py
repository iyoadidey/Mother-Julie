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

from .models import SignupEvent, PasswordResetToken, Product, Order, OrderItem, FrontendContent
from django.db import transaction, close_old_connections
from django.db.models import F
from django.templatetags.static import static
from django.core.mail import EmailMultiAlternatives
from django.contrib.staticfiles import finders

def signin(request):
    """Handle user signin"""
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        user = authenticate(request, username=username, password=password)

        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            # AJAX request
            if user is not None:
                login(request, user)
                return JsonResponse({"success": True, "redirect_url": "/dashboard/"})
            else:
                return JsonResponse({"success": False, "message": "Invalid username or password"})
        else:
            # Normal form submission fallback
            if user is not None:
                login(request, user)
                return redirect("dashboard")
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
        
        if latest_order:
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
                print(f"DEBUG: Unknown order type '{order_type}' - defaulting to PICKUP")
                return redirect(f'/pick_up/?orderId={order_id}')
        else:
            print("DEBUG: No orders found for user - redirecting to dashboard with message")
            # No orders found - redirect to dashboard with a message
            messages.info(request, "📦 You don't have any orders yet. Click 'OUR MENU' to place your first order!")
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
            # Inline logo (CID) so it renders without public static hosting
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
                <!-- Logo removed -->
                <h1 style="margin:16px 0 0 0;font-size:22px;line-height:28px;color:#ff5b89;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0 28px;font-size:14px;line-height:22px;color:#333;">
                We received a request to reset the password for your Mother Julie account.
                If you didn’t make this request, you can safely ignore this email.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 28px 8px 28px;">
                <a href="{reset_url}" style="display:inline-block;background:#ff5b89;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                  Reset Password
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 28px 20px 28px;font-size:12px;line-height:18px;color:#666;">
                This link will expire in 1 hour for your security.
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px 28px;font-size:12px;line-height:18px;color:#666;">
                If the button doesn't work, copy and paste this URL into your browser:<br />
                <a href="{reset_url}" style="color:#ff5b89;word-break:break-all;">{reset_url}</a>
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
  </html>
"""

            # Build email with inline image
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Reset your password here: {reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email],
            )
            msg.attach_alternative(html_message, "text/html")

            # No inline images

            msg.send(fail_silently=False)

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


@csrf_exempt
def api_update_product_image(request, product_id):
    """Update product image"""
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
    """Admin dashboard"""
    if not request.user.is_authenticated:
        return redirect('signin_admindashboard')
    if not request.user.is_superuser:
        messages.error(request, 'You do not have permission to access this page.')
        return redirect('signin_admindashboard')
    return render(request, 'admin_dashboard.html')


def signin_admindashboard(request):
    """Handle admin dashboard signin"""
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        remember_me = request.POST.get("remember_me") == 'on'
        user = authenticate(request, username=username, password=password)

        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            # AJAX request
            if user is not None and user.is_superuser:
                login(request, user)
                # Set session expiry based on remember me
                if remember_me:
                    request.session.set_expiry(1209600)  # 2 weeks
                else:
                    request.session.set_expiry(0)  # Session expires when browser closes
                return JsonResponse({"success": True, "redirect_url": "/admin_dashboard/"})
            else:
                return JsonResponse({"success": False, "message": "Invalid credentials or insufficient permissions"})
        else:
            # Normal form submission fallback
            if user is not None and user.is_superuser:
                login(request, user)
                # Set session expiry based on remember me
                if remember_me:
                    request.session.set_expiry(1209600)  # 2 weeks
                else:
                    request.session.set_expiry(0)  # Session expires when browser closes
                return redirect("admin_dashboard")
            else:
                messages.error(request, "Invalid credentials or insufficient permissions")

    return render(request, "signin_admindashboard.html")


def admin_logout(request):
    """Handle admin logout"""
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('signin_admindashboard')


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
                name = item.get('name', '')
                qty = int(item.get('quantity', 1))
                unit_price = item.get('price', 0)
                total_price = item.get('total', 0)
                size = item.get('size', '')
                print(f"Creating order item: {name} x {qty}")  # ADD THIS

                # Save order line
                OrderItem.objects.create(
                    order=order,
                    product_name=name,
                    quantity=qty,
                    unit_price=unit_price,
                    total_price=total_price,
                    size=size
                )

                # Decrement stock on matching Product by name
                try:
                    product = Product.objects.select_for_update().get(name=name)
                    product.stock_quantity = F('stock_quantity') - qty
                    product.save(update_fields=['stock_quantity'])
                    product.refresh_from_db(fields=['stock_quantity'])
                    if product.stock_quantity < 0:
                        product.stock_quantity = 0
                        product.save(update_fields=['stock_quantity'])
                    # Keep product visible but it will show as "Out of Stock" on frontend
                except Product.DoesNotExist:
                # If no product matches, skip stock updates
                    print(f"Product '{name}' not found, skipping stock update")  # ADD THIS                
                    pass

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
            'order_placed': order.created_at.strftime('%Y-%m-%d %H:%M:%S'),
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
                'order_type': order.order_type,
                'order_placed': order.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'delivery_pickup_date': order.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
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
            'period_start': start_date.strftime('%Y-%m-%d %H:%M:%S'),
            'period_end': now.strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
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
                'created_at': content.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': content.updated_at.strftime('%Y-%m-%d %H:%M:%S')
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
    
