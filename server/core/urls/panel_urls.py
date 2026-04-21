"""Custom staff panel (template CRUD) under /admin/."""

from django.urls import path

from ..views.panel import views as panel

urlpatterns = [
    path("login/", panel.PanelLoginView.as_view(), name="panel_login"),
    path("logout/", panel.PanelLogoutView.as_view(), name="panel_logout"),
    path("", panel.PanelHomeRedirectView.as_view(), name="panel_home"),
    # Products
    path("products/", panel.ProductListView.as_view(), name="panel_product_list"),
    path("products/create/", panel.ProductCreateView.as_view(), name="panel_product_create"),
    path("products/<int:pk>/edit/", panel.ProductUpdateView.as_view(), name="panel_product_edit"),
    path("products/<int:pk>/delete/", panel.ProductDeleteView.as_view(), name="panel_product_delete"),
    # Categories
    path("categories/", panel.CategoryListView.as_view(), name="panel_category_list"),
    path(
        "parent-categories/create/",
        panel.ParentCategoryCreateView.as_view(),
        name="panel_parent_category_create",
    ),
    path(
        "parent-categories/<int:pk>/edit/",
        panel.ParentCategoryUpdateView.as_view(),
        name="panel_parent_category_edit",
    ),
    path("categories/create/", panel.CategoryCreateView.as_view(), name="panel_category_create"),
    path("categories/<int:pk>/edit/", panel.CategoryUpdateView.as_view(), name="panel_category_edit"),
    path("categories/<int:pk>/delete/", panel.CategoryDeleteView.as_view(), name="panel_category_delete"),
    # Orders
    path("orders/", panel.OrderListView.as_view(), name="panel_order_list"),
    path("orders/<int:pk>/", panel.OrderDetailView.as_view(), name="panel_order_detail"),
    path(
        "orders/<int:pk>/status/",
        panel.OrderStatusUpdateView.as_view(),
        name="panel_order_status",
    ),
    # Delivery boys
    path("delivery-boys/", panel.DeliveryBoyListView.as_view(), name="panel_delivery_boy_list"),
    path(
        "delivery-boys/create/",
        panel.DeliveryBoyCreateView.as_view(),
        name="panel_delivery_boy_create",
    ),
    path(
        "delivery-boys/<int:pk>/edit/",
        panel.DeliveryBoyUpdateView.as_view(),
        name="panel_delivery_boy_edit",
    ),
    path(
        "delivery-boys/<int:pk>/delete/",
        panel.DeliveryBoyDeleteView.as_view(),
        name="panel_delivery_boy_delete",
    ),
    # Notifications
    path("notifications/", panel.NotificationListView.as_view(), name="panel_notification_list"),
    path(
        "notifications/create/",
        panel.NotificationCreateView.as_view(),
        name="panel_notification_create",
    ),
    path(
        "notifications/<int:pk>/edit/",
        panel.NotificationUpdateView.as_view(),
        name="panel_notification_edit",
    ),
    path(
        "notifications/<int:pk>/delete/",
        panel.NotificationDeleteView.as_view(),
        name="panel_notification_delete",
    ),
    # Store settings (singleton)
    path("store-settings/", panel.StoreSettingsView.as_view(), name="panel_store_settings"),
]
