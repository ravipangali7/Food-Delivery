"""
cPanel / LiteSpeed Passenger प्रवेश बिन्दु।

api.shyam-sweets.com का लागि सम्पूर्ण `server/` डाइरेक्टरी Python app root मा अपलोड गर्नुहोस्
र Setup Python App मा "Application startup file" लाई passenger_wsgi.py सेट गर्नुहोस्।
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fooddelivery.settings")


def _apply_pending_migrations() -> None:
    """Passenger ले app load गर्दा pending migration एक पटक लागू गर्नुहोस्।"""
    import django

    django.setup()
    from django.core.management import call_command

    call_command("migrate", "--noinput", verbosity=1)


_apply_pending_migrations()

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
