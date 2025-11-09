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

from .models import SignupEvent, PasswordResetToken, Product, Order, OrderItem
from django.db import transaction
from django.db.models import F


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
    """Admin dashboard"""
    return render(request, 'admin_dashboard.html')


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
        print(f"Customer: {customer_name}, User: {request.user}")  # ADD THIS


        with transaction.atomic():
            print("Creating order...")  # ADD THIS
            order = Order.objects.create(
                order_id=order_id,
                user=request.user if request.user.is_authenticated else None,
                customer_name=customer_name,
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
                    if product.stock_quantity <= 0:
                        product.stock_quantity = 0
                        product.show_in_all_menu = False
                        product.is_active = False
                        product.save(update_fields=['stock_quantity', 'show_in_all_menu', 'is_active'])
                except Product.DoesNotExist:
                # If no product matches, skip stock updates
                    print(f"Product '{name}' not found, skipping stock update")  # ADD THIS                
                    pass

        print("=== DEBUG: Order creation SUCCESS ===")  # ADD THIS       
        return JsonResponse({'success': True, 'orderId': order_id})
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
                } for item in order.orderitem_set.all()
            ]
        }
        return JsonResponse(order_data)
    except Order.DoesNotExist:
        return JsonResponse({'error': 'Order not found'}, status=404)


@csrf_exempt
def api_update_order_status(request, order_id):
    """Update order status from admin dashboard"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            new_status = data.get('status')
            
            order = Order.objects.get(order_id=order_id)
            order.status = new_status
            order.updated_at = timezone.now()
            order.save()
            
            return JsonResponse({'success': True, 'message': 'Order status updated'})
        except Order.DoesNotExist:
            return JsonResponse({'error': 'Order not found'}, status=404)
        except Exception as e:
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
                'created_at': order.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'items_count': order.orderitem_set.count(),
                'items': [
                    {
                        'name': item.product_name,
                        'quantity': item.quantity,
                        'price': float(item.unit_price)
                    } for item in order.orderitem_set.all()
                ]
            }
            orders_data.append(order_data)
        
        return JsonResponse(orders_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    
