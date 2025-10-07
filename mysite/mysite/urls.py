from django.contrib import admin
from django.urls import path, include  # include allows linking app URLs

urlpatterns = [
    path('admin/', admin.site.urls),
    path('hello/', include('hello.urls')),  # connects to hello/urls.py
]