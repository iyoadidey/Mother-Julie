from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login, authenticate
from django.contrib.auth.models import User
from .models import SignupEvent
from django.contrib.auth import logout
from django.shortcuts import redirect

def signin_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')  # Get username from form
        password = request.POST.get('password')
        
        # Authenticate user using username
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            messages.success(request, 'Logged in successfully!')
            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid username or password.')
    
    return render(request, 'signin.html')

def signup_view(request):
    if request.method == 'POST':
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        username = request.POST.get('username')
        email = request.POST.get('email')
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')
        agreement = request.POST.get('agreement')
        
        # Basic validation
        if password1 != password2:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'signup.html')
            
        if not agreement:
            messages.error(request, 'You must agree to the terms and conditions.')
            return render(request, 'signup.html')
        
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            messages.error(request, 'An account with this email already exists.')
            return render(request, 'signup.html')
        
        try:
            # Create user
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password1,
                first_name=first_name,
                last_name=last_name
            )
            
            # Create SignupEvent with first and last names
            SignupEvent.objects.create(
                user=user,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            
            # Log the user in
            login(request, user)
            messages.success(request, 'Account created successfully! You are now logged in.')
            return redirect('signin')
            
        except Exception as e:
            messages.error(request, f'An error occurred during signup: {str(e)}')
            return render(request, 'signup.html')
    
    return render(request, 'signup.html')

def logout_view(request):
    logout(request)
    return redirect('signin')

def terms_view(request):
    return render(request, 'Terms&Conditions.html')

def dashboard_view(request):
    return render(request, 'dashboard.html')

def orders_menu_view(request):
    return render(request, 'orders_menu.html')