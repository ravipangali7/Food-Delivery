"""Browser OTP pages (not under /api/)."""

from django.urls import path

from ..views import otp_page_views

urlpatterns = [
    path("", otp_page_views.otp_verification_page, name="otp_verification"),
    path("help/csrf/", otp_page_views.otp_help, name="otp_csrf_help"),
]
