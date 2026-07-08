"""प्रविधि पहिचान गर्ने response header हटाउँछ र आधारभूत security header लगाउँछ।"""

from __future__ import annotations

from django.conf import settings

# बाहिरी प्रयोगकर्तालाई server/framework पहिचान नदिन यी header हटाउँछ।
_HEADERS_TO_STRIP = (    "Server",
    "X-Powered-By",
    "X-AspNet-Version",
    "X-AspNetMvc-Version",
    "X-Runtime",
    "X-Version",
)


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        for header in _HEADERS_TO_STRIP:
            if header in response:
                del response[header]

        # WSGI deployment का लागि generic मान; ASGI dev server आफ्नै थप्न सक्छ।
        response.headers["Server"] = "WebServer"

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

        if not settings.DEBUG:
            response.headers.setdefault("X-Frame-Options", "DENY")
            response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

        return response
