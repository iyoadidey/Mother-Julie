import os
from pathlib import Path

import dj_database_url

from dotenv import load_dotenv
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_LOCAL_DB_PATH = Path(
    os.getenv(
        'LOCAL_SQLITE_PATH',
        # Keep fallback sqlite inside the project, not temp storage.
        # Temp directories are often ephemeral on deployed platforms.
        str(BASE_DIR / 'db.sqlite3')
    )
)


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-local-dev-key')
# Local default is DEBUG on, but keep production off by default.
# PythonAnywhere exposes PYTHONANYWHERE_DOMAIN in its environment.
DEBUG = env_bool('DEBUG', default=not bool(os.getenv('PYTHONANYWHERE_DOMAIN')))
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", default="iyoadidey.pythonanywhere.com,127.0.0.1,localhost")
# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'anymail',
    'hello',  # Add your app here
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# TEMPLATES Directory
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'templates',  # Points to your main templates folder
            BASE_DIR / 'hello' / 'templates',  # Ensure app templates are found in production
            BASE_DIR / 'hello' / 'Templates',  # Compatibility for case-sensitive Linux deploys
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mysite.wsgi.application'

# Database configuration
DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{DEFAULT_LOCAL_DB_PATH}",
        conn_max_age=600,
    )
}

# Password validation settings
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Static files directories
STATICFILES_DIRS = [
    BASE_DIR / 'hello' / 'static',  # App static assets
]
STATICFILES_STORAGE = (
    'django.contrib.staticfiles.storage.StaticFilesStorage'
    if DEBUG else
    'whitenoise.storage.CompressedManifestStaticFilesStorage'
)

# Media files (User uploaded files)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    default="https://iyoadidey.pythonanywhere.com,http://iyoadidey.pythonanywhere.com,http://localhost:8000,http://127.0.0.1:8000",
)

# Ensure cookies work properly
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Login URL for authentication redirects
LOGIN_URL = '/signin/'
LOGIN_REDIRECT_URL = '/dashboard/'





EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'anymail.backends.brevo.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp-relay.brevo.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', True)
EMAIL_USE_SSL = env_bool('EMAIL_USE_SSL', False)
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '30'))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Mother Julie <noreply.motherjulie@gmail.com>')
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-local-dev-key')
SERVER_EMAIL = os.getenv('SERVER_EMAIL', DEFAULT_FROM_EMAIL)

ANYMAIL = {
    "BREVO_API_KEY": BREVO_API_KEY,
    "IGNORE_RECIPIENT_STATUS": True,  # Optional: prevents errors for invalid recipients
}

# Admin error reporting
ADMINS = [
    ('Iyo Adidey', 'iyoadidey11@gmail.com'),
]

# Lalamove API configuration (set in environment variables in production)
LALAMOVE_API_KEY = os.getenv('LALAMOVE_API_KEY', '')
LALAMOVE_API_SECRET = os.getenv('LALAMOVE_API_SECRET', '')
LALAMOVE_MODE = os.getenv('LALAMOVE_MODE', 'sandbox').lower()  # sandbox or production
DELIVERY_FEE_BASE = float(os.getenv('DELIVERY_FEE_BASE', '50'))
DELIVERY_FEE_INCLUDED_KM = float(os.getenv('DELIVERY_FEE_INCLUDED_KM', '2'))
DELIVERY_FEE_PER_KM_AFTER_INCLUDED = float(os.getenv('DELIVERY_FEE_PER_KM_AFTER_INCLUDED', '10'))

# PayMongo API configuration (set in environment variables in production)
PAYMONGO_PUBLIC_KEY = os.getenv('PAYMONGO_PUBLIC_KEY', '')
PAYMONGO_SECRET_KEY = os.getenv('PAYMONGO_SECRET_KEY', '')
PAYMONGO_MODE = os.getenv('PAYMONGO_MODE', 'sandbox').lower()  # sandbox or production
# Optional Basic auth header for direct QRPH generation flow
PAYMONGO_QRPH_BASIC_AUTH = os.getenv('PAYMONGO_QRPH_BASIC_AUTH', '')


ROOT_URLCONF = 'mysite.urls'