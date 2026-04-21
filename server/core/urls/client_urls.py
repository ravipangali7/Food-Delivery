"""Public and authenticated client API routes."""

from django.urls import path

from ..views.client import delivery_views, home_views, otp_views, twilio_views

urlpatterns = [
    path("products/", home_views.product_list),
    path("products/<int:pk>/", home_views.product_detail),
    path("categories/", home_views.category_list),
    path("parent-categories/<int:pk>/", home_views.parent_category_detail),
    path("categories/<int:pk>/", home_views.category_detail),
    path("settings/", home_views.settings_list),
    path("settings/<int:pk>/", home_views.settings_detail),
    path("cart/", home_views.cart_detail),
    path("cart/items/", home_views.cart_add_item),
    path("cart/items/<str:item_id>/", home_views.cart_remove_item),
    path("checkout/", home_views.checkout),
    path("orders/", home_views.order_list),
    path("orders/<int:pk>/tracking/location/", home_views.order_tracking_location),
    path("orders/<int:pk>/tracking/", home_views.order_tracking),
    path("orders/<int:pk>/chat/messages/", home_views.order_chat_messages),
    path("orders/<int:pk>/chat/receipts/", home_views.order_chat_receipts),
    path("orders/<int:pk>/chat/presence/", home_views.order_chat_participants_presence),
    path("orders/<int:pk>/transition/", home_views.order_transition),
    path("orders/<int:pk>/", home_views.order_detail),
    path("addresses/", home_views.saved_address_list),
    path("addresses/<int:pk>/", home_views.saved_address_detail),
    path("notifications/unread-count/", home_views.notification_unread_count),
    path("notifications/mark-read/", home_views.notifications_mark_read),
    path("notifications/", home_views.notification_list),
    path("send-otp/", otp_views.send_otp),
    path("verify-otp/", otp_views.verify_otp),
    # SPA uses these paths; unknown /api/... routes would otherwise fall through to
    # admin's catch-all and POSTs would fail CSRF (see fooddelivery.urls order).
    path("auth/otp/send/", otp_views.send_otp),
    path("auth/otp/verify/", otp_views.verify_otp),
    path("auth/me/", home_views.me),
    path("delivery/earnings/", delivery_views.delivery_earnings),
    path("webhooks/twilio/sms/", twilio_views.twilio_inbound_sms),
]
