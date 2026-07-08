"""
fooddelivery परियोजनाको WSGI कन्फिग।

``application`` नामको module-level WSGI callable प्रदान गर्छ।

थप जानकारी:
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fooddelivery.settings')

application = get_wsgi_application()
