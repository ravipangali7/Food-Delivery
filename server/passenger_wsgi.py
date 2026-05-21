"""
cPanel / LiteSpeed Passenger entry point.

Upload the whole `server/` directory as the Python app root for api.shyam-sweets.com
and set "Application startup file" to passenger_wsgi.py in Setup Python App.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fooddelivery.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
