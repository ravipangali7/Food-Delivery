from django.urls import path

from core.consumers import OrderChatConsumer, OrderTrackingConsumer, StaffInboxConsumer

websocket_urlpatterns = [
    path("ws/tracking/<int:order_id>/", OrderTrackingConsumer.as_asgi()),
    path("ws/chat/<int:order_id>/", OrderChatConsumer.as_asgi()),
    path("ws/staff/inbox/", StaffInboxConsumer.as_asgi()),
]
