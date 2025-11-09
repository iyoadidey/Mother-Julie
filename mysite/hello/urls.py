from django.urls import path
from django.views.generic import RedirectView
from . import views 

urlpatterns = [
    path('', views.dashboard_view, name='root'),
    path('signin/', views.signin, name='signin'),
    path('login/', RedirectView.as_view(pattern_name='signin', permanent=False)),
    path('signup/', views.signup_view, name='signup'),
    path('terms/', views.terms_view, name='terms'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('orders_menu/', views.orders_menu_view, name='orders_menu'),
    path('logout/', views.logout_view, name='logout'),
    path('orders/redirect/', views.redirect_to_order, name='redirect_to_orders'),

    # Tracking Pages
    path('delivery/', views.delivery_view, name='delivery'),
    path('pick_up/', views.pickup_view, name='pick_up'),

    # Forgot password
    path('request-password-reset/', views.request_password_reset, name='request_password_reset'),
    path('reset-password/<str:token>/', views.reset_password_confirm, name='reset_password_confirm'),

    # Product Upload
    path('upload-product-image/', views.upload_product_image, name='upload_product_image'),

    # Order APIs
    path('api/orders/', views.api_create_order, name='api_create_order'),
    path('api/orders/<str:order_id>/status/', views.api_get_order_status, name='api_get_order_status'),
    path('api/orders/<str:order_id>/update-status/', views.api_update_order_status, name='api_update_order_status'),
    path('api/orders/all/', views.api_get_orders, name='api_get_orders'),

    # Admin Dashboard Backend
    path('admin_dashboard/', views.admin_dashboard, name='admin_dashboard'),

    path('debug/orders/', views.debug_orders, name='debug_orders')
]
