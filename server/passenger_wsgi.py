"""
cPanel / LiteSpeed Passenger entry point.

Upload the whole `server/` directory as the Python app root for api.shyam-sweets.com
and set "Application startup file" to passenger_wsgi.py in Setup Python App.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fooddelivery.settings")


def _apply_pending_migrations() -> None:
    """Apply pending migrations once when Passenger loads the app."""
    import django

    django.setup()
    from django.core.management import call_command

    call_command("migrate", "--noinput", verbosity=1)


_apply_pending_migrations()

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
