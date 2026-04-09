import sys
import os

# Path to your project folder
path = '/home/iyoadidey/Mother-Julie/mysite'
if path not in sys.path:
    sys.path.append(path)

# Set Django settings module
os.environ['DJANGO_SETTINGS_MODULE'] = 'mysite.settings'

# Get WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()