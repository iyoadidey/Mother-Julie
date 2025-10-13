from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login
from .forms import SignUpForm  # Assuming SignUpForm is defined in forms.py

def signin_view(request):
    return render(request, 'signin.htm')

def signup_view(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            # Create the user and save it to the database
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password1'])  # Hash the password
            user.save()

            # Log the user in after sign-up
            login(request, user)

            # Redirect to the dashboard page after successful sign-up
            messages.success(request, 'Account created successfully! You are now logged in.')
            return redirect('dashboard')
        else:
            # If the form is invalid, render the signup page with errors
            messages.error(request, 'Please correct the errors below.')
    else:
        form = SignUpForm()  # Empty form instance

    return render(request, 'signup.htm', {'form': form})

def terms_view(request):
    return render(request, 'Terms&Conditions.htm')

def dashboard_view(request):
    return render(request, 'dashboard.htm')
