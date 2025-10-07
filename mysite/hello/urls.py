from django.urls import path
from . import views

urlpatterns = [
    path('', views.signin_view, name='root'),
    path('signin/', views.signin_view, name='signin'),
    path('signup/', views.signup_view, name='signup'),
    path('terms/', views.terms_view, name='terms'),

    # Item CRUD
    path('items/', views.ItemListView.as_view(), name='item-list'),
    path('items/create/', views.ItemCreateView.as_view(), name='item-create'),
    path('items/<int:pk>/', views.ItemDetailView.as_view(), name='item-detail'),
    path('items/<int:pk>/edit/', views.ItemUpdateView.as_view(), name='item-update'),
    path('items/<int:pk>/delete/', views.ItemDeleteView.as_view(), name='item-delete'),
]