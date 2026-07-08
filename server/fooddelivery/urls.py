from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings

from core.views.errors import api_root_view

handler400 = "core.views.errors.error_400"
handler403 = "core.views.errors.error_403"
handler404 = "core.views.errors.error_404"
handler500 = "core.views.errors.error_500"

# URL रूटिङ — API root मा branding मात्र; superuser कन्सोल obscure path मा।
urlpatterns = [
    path("", api_root_view),
    path("otp/", include("core.urls.otp_page_urls")),
    path("api/", include("core.urls")),
    path("admin/", include("core.urls.panel_urls")),
    path(f"{settings.ADMIN_URL}/", admin.site.urls),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)