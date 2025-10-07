from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.contrib import messages
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Item, SignupEvent

def hello_world(request):
    return HttpResponse("Hello, world! This is your first Django view.")


def signin_view(request):
    return render(request, 'signin.htm')


def signup_view(request):
    if request.method == 'POST':
        email_or_mobile = request.POST.get('email') or request.POST.get('mobile')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
        location = request.POST.get('location', '')
        latitude = request.POST.get('latitude')
        longitude = request.POST.get('longitude')
        agreement = request.POST.get('agreement')

        if not email_or_mobile or not password:
            messages.error(request, 'Email/Mobile and password are required.')
            return render(request, 'signup.htm', { 'google_maps_api_key': getattr(settings, 'GOOGLE_MAPS_API_KEY', '') })

        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'signup.htm', { 'google_maps_api_key': getattr(settings, 'GOOGLE_MAPS_API_KEY', '') })

        if agreement is None:
            messages.error(request, 'You must agree to the Terms & Conditions.')
            return render(request, 'signup.htm', { 'google_maps_api_key': getattr(settings, 'GOOGLE_MAPS_API_KEY', '') })

        User = get_user_model()
        username = (email_or_mobile or '').split('@')[0] if '@' in (email_or_mobile or '') else (email_or_mobile or '')
        # Ensure uniqueness
        base_username = username or 'user'
        candidate = base_username
        suffix = 1
        while User.objects.filter(username=candidate).exists():
            suffix += 1
            candidate = f"{base_username}{suffix}"
        username = candidate

        user = User.objects.create_user(username=username, email=email_or_mobile, password=password)
        try:
            lat_value = float(latitude) if latitude not in (None, '') else None
            lon_value = float(longitude) if longitude not in (None, '') else None
        except ValueError:
            lat_value = None
            lon_value = None
        SignupEvent.objects.create(
            user=user,
            email=email_or_mobile or '',
            location=location,
            latitude=lat_value,
            longitude=lon_value,
        )
        messages.success(request, 'Account created successfully. You can now sign in.')
        return redirect('signin')

    return render(request, 'signup.htm', { 'google_maps_api_key': getattr(settings, 'GOOGLE_MAPS_API_KEY', '') })


def terms_view(request):
    return render(request, 'Terms&Conditions.htm')


class ItemListView(ListView):
    model = Item
    template_name = 'items/item_list.html'
    context_object_name = 'items'


class ItemDetailView(DetailView):
    model = Item
    template_name = 'items/item_detail.html'


class ItemCreateView(CreateView):
    model = Item
    fields = ['name', 'description']
    template_name = 'items/item_form.html'
    success_url = reverse_lazy('item-list')


class ItemUpdateView(UpdateView):
    model = Item
    fields = ['name', 'description']
    template_name = 'items/item_form.html'
    success_url = reverse_lazy('item-list')


class ItemDeleteView(DeleteView):
    model = Item
    template_name = 'items/item_confirm_delete.html'
    success_url = reverse_lazy('item-list')