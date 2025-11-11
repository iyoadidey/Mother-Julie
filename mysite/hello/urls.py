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
    path('api/orders/<str:order_id>/delete/', views.api_delete_order, name='api_delete_order'),
    path('api/orders/delete-all/', views.api_delete_all_orders, name='api_delete_all_orders'),
    path('api/orders/all/', views.api_get_orders, name='api_get_orders'),

    # Admin Dashboard Backend
    path('admin_dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('signin_admindashboard/', views.signin_admindashboard, name='signin_admindashboard'),
    path('admin_logout/', views.admin_logout, name='admin_logout'),
    
    # Admin Dashboard APIs
    path('api/analytics/', views.api_get_analytics, name='api_get_analytics'),
    path('api/products/', views.api_get_products, name='api_get_products'),
    path('api/products/public/', views.api_get_products_public, name='api_get_products_public'),
    path('api/products/<int:product_id>/stock/', views.api_get_product_stock, name='api_get_product_stock'),
    path('api/products/create/', views.api_create_product, name='api_create_product'),
    path('api/products/<int:product_id>/update/', views.api_update_product, name='api_update_product'),
    path('api/products/<int:product_id>/update-image/', views.api_update_product_image, name='api_update_product_image'),
    path('api/products/<int:product_id>/delete/', views.api_delete_product, name='api_delete_product'),
    path('api/reports/<str:period>/', views.api_get_reports, name='api_get_reports'),

    # Frontend Content Management APIs
    path('api/frontend-content/', views.api_get_frontend_content, name='api_get_frontend_content'),
    path('api/frontend-content/all/', views.api_get_all_frontend_content, name='api_get_all_frontend_content'),
    path('api/frontend-content/create/', views.api_create_frontend_content, name='api_create_frontend_content'),
    path('api/frontend-content/<int:content_id>/update/', views.api_update_frontend_content, name='api_update_frontend_content'),
    path('api/frontend-content/<int:content_id>/delete/', views.api_delete_frontend_content, name='api_delete_frontend_content'),

    path('debug/orders/', views.debug_orders, name='debug_orders')
]
