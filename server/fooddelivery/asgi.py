"""
fooddelivery परियोजनाको ASGI कन्फिग।

HTTP Django ले सेवा गर्छ; WebSocket ले live order tracking चलाउँछ।
चलाउने: daphne fooddelivery.asgi:application
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
    ब्राउजर WebSocket Same-Origin Policy ले *पेज* Origin पठाउँछ (उदाहरण: https://shyam-sweets.com),
    API host होइन। AllowedHostsOriginValidator ले त्यसलाई ALLOWED_HOSTS सँग तुलना गर्छ, त्यसैले
    उत्पादनमा API subdomain मात्र allowed भए WS प्रायः reject हुन्छ। WS लाई CORS / CSRF मा
    पहिले नै अनुमति दिइएका origin सँग मिलाउनुहोस्।
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
    # "*" मात्र जब Django कुनै पनि host अनुमति दिन्छ (पुरानो validator व्यवहारसँग dev मिलाउन)।
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
