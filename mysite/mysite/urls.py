from django.contrib import admin
from django.urls import path, include  # include allows linking app URLs

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('hello.urls')),  # root goes to hello app
]