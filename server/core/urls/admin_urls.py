"""Staff-only API routes."""

from django.urls import path

from ..views.admin import crud_views, x_views

urlpatterns = [
    path("orders/<int:pk>/assign-delivery/", x_views.order_assign_delivery),
    path(
        "admin/order-cancellation-requests/<int:pk>/review/",
        crud_views.admin_order_cancellation_request_review,
    ),
    path("admin/order-cancellation-requests/", crud_views.admin_order_cancellation_request_list),
    path("admin/dashboard/summary/", crud_views.dashboard_summary),
    path("admin/dashboard/revenue/", crud_views.dashboard_revenue_series),
    path("admin/dashboard/today/", crud_views.dashboard_today),
    path("admin/products/", crud_views.admin_product_list_create),
    path("admin/products/<slug:slug>/", crud_views.admin_product_detail),
    path("admin/units/", crud_views.admin_unit_list_create),
    path("admin/units/<int:pk>/", crud_views.admin_unit_detail),
    path("admin/parent-categories/", crud_views.admin_parent_category_list_create),
    path("admin/parent-categories/<int:pk>/", crud_views.admin_parent_category_detail),
    path("admin/categories/", crud_views.admin_category_list_create),
    path("admin/categories/<int:pk>/", crud_views.admin_category_detail),
    path("admin/users/", crud_views.admin_user_list_create),
    path("admin/users/<int:pk>/", crud_views.admin_user_detail),
    path("admin/settings/<int:pk>/", crud_views.admin_settings_update),
    path("admin/notifications/", crud_views.admin_notification_list),
    path("admin/notifications/send/", crud_views.admin_notification_broadcast),
    path("admin/notifications/<int:pk>/", crud_views.admin_notification_detail),
    path("admin/support/inbox/", crud_views.support_inbox),
    path("admin/sms/overview/", crud_views.admin_sms_overview),
    path("admin/sms/test-send/", crud_views.admin_sms_test_send),
    path("admin/banners/", crud_views.admin_banner_list_create),
    path("admin/banners/<int:pk>/", crud_views.admin_banner_detail),
]
