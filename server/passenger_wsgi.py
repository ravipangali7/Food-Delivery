"""
cPanel / LiteSpeed Passenger प्रवेश बिन्दु।

api.shyam-sweets.com का लागि सम्पूर्ण `server/` डाइरेक्टरी Python app root मा अपलोड गर्नुहोस्
र Setup Python App मा "Application startup file" लाई passenger_wsgi.py सेट गर्नुहोस्।
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fooddelivery.settings")


from core.startup import prepare_database

prepare_database()

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
