from django.http import HttpResponse
from django.shortcuts import render

def hello_world(request):
    return HttpResponse("Hello, world! This is your first Django view.")


def signin_view(request):
    return render(request, 'signin.htm')


def signup_view(request):
    return render(request, 'signup.htm')


def terms_view(request):
    return render(request, 'Terms&Conditions.htm')