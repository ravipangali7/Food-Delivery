"""
ASGI config for fooddelivery project.

HTTP is served by Django; WebSockets power live order tracking.
Run with: daphne fooddelivery.asgi:application
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings
from django.core.asgi import get_asgi_application

import fooddelivery.routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fooddelivery.settings")

django_asgi_app = get_asgi_application()


def _websocket_allowed_origins():
    """
    Browser WebSocket Same-Origin Policy sends the *page* Origin (e.g. https://shyam-sweets.com),
    not the API host. AllowedHostsOriginValidator compares that to ALLOWED_HOSTS entries, so
    production often rejects WS when the API subdomain is the only allowed host. Align WS with
    the same origins we already allow for CORS / CSRF.
    """
    out: dict[str, None] = {}
    for origin in getattr(settings, "CORS_ALLOWED_ORIGINS", ()) or ():
        o = str(origin).strip()
        if o:
            out[o] = None
    for origin in getattr(settings, "CSRF_TRUSTED_ORIGINS", ()) or ():
        o = str(origin).strip()
        if o:
            out[o] = None
    pb = str(getattr(settings, "PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
    if pb:
        out[pb] = None
    for o in os.environ.get("WEBSOCKET_ALLOWED_ORIGINS", "").split(","):
        o = o.strip()
        if o:
            out[o] = None
    # "*" only when Django allows any host (keeps dev parity with old validator behavior).
    if "*" in (getattr(settings, "ALLOWED_HOSTS", None) or []):
        out.clear()
        out["*"] = None
    return list(out.keys())


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": OriginValidator(
            AuthMiddlewareStack(URLRouter(fooddelivery.routing.websocket_urlpatterns)),
            allowed_origins=_websocket_allowed_origins(),
        ),
    }
)
