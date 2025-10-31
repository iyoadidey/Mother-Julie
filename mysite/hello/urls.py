from django.urls import path
from . import views

urlpatterns = [
    path('', views.signin_view, name='root'),
    path('signin/', views.signin_view, name='signin'),
    path('signup/', views.signup_view, name='signup'),
    path('terms/', views.terms_view, name='terms'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('orders_menu/', views.orders_menu_view, name='orders_menu'),
    path('logout/', views.logout_view, name='logout'),
]