from django.urls import path
from django.views.generic import RedirectView
from . import views

urlpatterns = [
    path('', views.signin, name='root'),
    path('signin/', views.signin, name='signin'),
    path('login/', RedirectView.as_view(pattern_name='signin', permanent=False)),
    path('signup/', views.signup_view, name='signup'),
    path('terms/', views.terms_view, name='terms'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('orders_menu/', views.orders_menu_view, name='orders_menu'),
    path('logout/', views.logout_view, name='logout'),
    path('delivery/', views.delivery_view, name='delivery'),
    path('pick_up/', views.pickup_view, name='pick_up'),
    path('request-password-reset/', views.request_password_reset, name='request_password_reset'),
    path('reset-password/<str:token>/', views.reset_password_confirm, name='reset_password_confirm'),
    path('upload-product-image/', views.upload_product_image, name='upload_product_image'),
]
