from django.http import HttpResponse
from django.shortcuts import render
from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from .models import Item

def hello_world(request):
    return HttpResponse("Hello, world! This is your first Django view.")


def signin_view(request):
    return render(request, 'signin.htm')


def signup_view(request):
    return render(request, 'signup.htm')


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