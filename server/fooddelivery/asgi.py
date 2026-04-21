"""
ASGI config for fooddelivery project.

HTTP is served by Django; WebSockets power live order tracking.
Run with: daphne fooddelivery.asgi:application
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

import fooddelivery.routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fooddelivery.settings")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(fooddelivery.routing.websocket_urlpatterns))
        ),
    }
)
