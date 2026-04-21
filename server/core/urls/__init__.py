from django.urls import include, path

from .admin_urls import urlpatterns as admin_urlpatterns
from .client_urls import urlpatterns as client_urlpatterns

urlpatterns = []
urlpatterns.extend(client_urlpatterns)
urlpatterns.extend(admin_urlpatterns)
