"""ब्रान्डेड error view — बाहिरी प्रयोगकर्तालाई framework traceback देखिँदैन।"""

from __future__ import annotations

from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET


def _wants_json(request) -> bool:
    accept = request.META.get("HTTP_ACCEPT", "")
    return "application/json" in accept or request.path.startswith("/api/")


@require_GET
def api_root_view(request):
    """API subdomain root — JSON for clients; browsers go to the storefront."""
    if _wants_json(request):
        return JsonResponse({"status": "ok", "api": "/api/settings/", "storefront": "https://shyam-sweets.com/"})
    return redirect("https://shyam-sweets.com/", permanent=False)


def error_404(request, exception=None):
    if _wants_json(request):
        return JsonResponse({"detail": "The requested resource was not found."}, status=404)
    return render(request, "errors/404.html", status=404)


def error_403(request, exception=None):
    if _wants_json(request):
        return JsonResponse({"detail": "You do not have permission to perform this action."}, status=403)
    return render(request, "errors/403.html", status=403)


def error_500(request):
    if _wants_json(request):
        return JsonResponse({"detail": "A server error occurred. Please try again later."}, status=500)
    return render(request, "errors/500.html", status=500)


def error_400(request, exception=None):
    if _wants_json(request):
        return JsonResponse({"detail": "The request could not be processed."}, status=400)
    return HttpResponse(status=400)
