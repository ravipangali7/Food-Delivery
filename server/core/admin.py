from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.humanize.templatetags.humanize import naturaltime
from django.utils import timezone
from django.utils.html import escape, format_html
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _

from .models import (
    Banner,
    Cart,
    CartItem,
    Category,
    Notification,
    NotificationUser,
    Order,
    OrderItem,
    OTPVerification,
    ParentCategory,
    Product,
    ProductImage,
    SuperSetting,
    Unit,
    User,
)


# --- shared admin helpers -------------------------------------------------

ORDER_STATUS_COLORS = {
    "pending": "#6c757d",
    "confirmed": "#0d6efd",
    "preparing": "#6610f2",
    "ready_for_delivery": "#6f42c1",
    "out_for_delivery": "#fd7e14",
    "delivered": "#198754",
    "cancelled": "#dc3545",
    "failed": "#842029",
}

def admin_img(url: str | None, *, size: int = 44, alt: str = "") -> str:
    if not url:
        return mark_safe('<span class="text-muted">—</span>')
    safe_url = escape(url)
    safe_alt = escape(alt or "img")
    return format_html(
        '<img src="{}" alt="{}" '
        'style="width:{}px;height:{}px;object-fit:cover;border-radius:6px;'
        'border:1px solid #dee2e6;vertical-align:middle;" loading="lazy" />',
        safe_url,
        safe_alt,
        size,
        size,
    )


def badge(text: str, *, color: str = "#495057", fg: str = "#fff") -> str:
    return format_html(
        '<span style="background:{};color:{};padding:3px 10px;border-radius:999px;'
        'font-size:11px;font-weight:600;letter-spacing:0.02em;">{}</span>',
        color,
        fg,
        escape(text),
    )


def npr(amount) -> str:
    if amount is None:
        return "—"
    return format_html(
        '<span style="font-variant-numeric:tabular-nums;font-weight:600;">NPR {}</span>',
        f"{amount:,.2f}",
    )


# --- inlines (StackedInline per project conventions) ----------------------


class ProductImageInline(admin.StackedInline):
    model = ProductImage
    extra = 0
    fields = ("image_url", "alt_text", "sort_order", "created_at")
    readonly_fields = ("created_at",)
    classes = ("collapse",)


class SubCategoryInline(admin.StackedInline):
    model = Category
    fk_name = "parent"
    extra = 0
    prepopulated_fields = {"slug": ("name",)}
    fields = ("name", "slug", "description", "image", "sort_order", "is_active")


class CartItemInline(admin.StackedInline):
    model = CartItem
    extra = 0
    autocomplete_fields = ("product",)
    readonly_fields = ("total_price", "created_at", "updated_at")
    fields = (
        "product",
        "quantity",
        "unit_price",
        "total_price",
        "notes",
        "created_at",
        "updated_at",
    )


class OrderItemInline(admin.StackedInline):
    model = OrderItem
    extra = 0
    autocomplete_fields = ("product",)
    readonly_fields = ("created_at", "line_preview")
    fields = (
        "product",
        "line_preview",
        "unit_price",
        "quantity",
        "total_price",
        "notes",
        "created_at",
    )

    @admin.display(description=_("Product preview"))
    def line_preview(self, obj: OrderItem):
        if not obj.product_id:
            return "—"
        thumb = getattr(obj.product, "thumbnail_url", None) or ""
        name = escape(obj.product.name)
        if thumb:
            return format_html(
                '<div style="display:flex;align-items:center;gap:10px;">{}'
                '<span style="font-weight:600;">{}</span></div>',
                admin_img(thumb, size=40, alt=name),
                mark_safe(name),
            )
        return format_html('<span style="font-weight:600;">{}</span>', name)


class NotificationUserInline(admin.StackedInline):
    model = NotificationUser
    extra = 0
    autocomplete_fields = ("user",)
    fields = ("user", "delivery_status", "error_message", "delivered_at")
    readonly_fields = ("delivered_at",)


# --- model admins ---------------------------------------------------------


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "id",
        "list_profile_photo",
        "phone",
        "name",
        "badge_delivery",
        "is_staff",
        "is_active",
        "deleted_at",
        "created_at",
        "created_natural",
    )
    list_display_links = ("id", "phone", "name")
    list_filter = (
        "is_staff",
        "is_superuser",
        "is_active",
        "is_delivery_boy",
        "created_at",
    )
    search_fields = ("phone", "name", "email", "address")
    ordering = ("-created_at",)
    readonly_fields = (
        "last_login",
        "date_joined",
        "created_at",
        "updated_at",
        "profile_photo_preview",
    )

    fieldsets = (
        (_("Login"), {"fields": ("phone", "password")}),
        (
            _("Profile"),
            {
                "fields": (
                    "name",
                    "email",
                    "profile_photo",
                    "profile_photo_preview",
                )
            },
        ),
        (
            _("Delivery & device"),
            {
                "fields": (
                    "is_delivery_boy",
                    "latitude",
                    "longitude",
                    "address",
                    "fcm_token",
                )
            },
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            _("Important dates"),
            {
                "fields": (
                    "last_login",
                    "date_joined",
                    "deleted_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone", "name", "password1", "password2"),
            },
        ),
    )

    @admin.display(description=_("Photo"))
    def list_profile_photo(self, obj: User):
        return admin_img(obj.profile_photo, size=40, alt=obj.name)

    @admin.display(description=_("Profile photo"))
    def profile_photo_preview(self, obj: User):
        return admin_img(obj.profile_photo, size=120, alt=obj.name)

    @admin.display(description=_("Role"), ordering="is_delivery_boy")
    def badge_delivery(self, obj: User):
        if obj.is_superuser:
            return badge(_("Super Admin"), color="#6610f2", fg="#fff")
        if obj.is_delivery_boy:
            return badge(_("Delivery boy"), color="#fd7e14")
        return badge(_("Customer"), color="#0dcaf0", fg="#042")

    @admin.display(description=_("Created"), ordering="created_at")
    def created_natural(self, obj: User):
        if not obj.created_at:
            return "—"
        return naturaltime(obj.created_at)


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    """SMS OTP rows created by the API; view, search, and clean up here."""

    list_display = (
        "id",
        "phone_number",
        "purpose_badge",
        "otp_code",
        "verification_badge",
        "expiry_badge",
        "user",
        "created_at",
        "expires_at",
    )
    list_display_links = ("id", "phone_number")
    list_filter = ("purpose", "is_verified", "created_at")
    search_fields = ("phone_number", "otp_code", "user__phone", "user__name")
    autocomplete_fields = ("user",)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = (
        "user",
        "phone_number",
        "otp_code",
        "purpose",
        "is_verified",
        "created_at",
        "expires_at",
    )
    fieldsets = (
        (
            _("OTP"),
            {"fields": ("phone_number", "otp_code", "purpose", "is_verified")},
        ),
        (_("Account"), {"fields": ("user",)}),
        (_("Validity"), {"fields": ("created_at", "expires_at")}),
    )
    actions = ("delete_selected",)

    @admin.display(description=_("Purpose"), ordering="purpose")
    def purpose_badge(self, obj: OTPVerification):
        color = "#0d6efd" if obj.purpose == OTPVerification.Purpose.LOGIN else "#20c997"
        return badge(obj.get_purpose_display(), color=color)

    @admin.display(description=_("Verified"), ordering="is_verified")
    def verification_badge(self, obj: OTPVerification):
        if obj.is_verified:
            return badge(_("Yes"), color="#198754")
        return badge(_("No"), color="#6c757d")

    @admin.display(description=_("Expiry"))
    def expiry_badge(self, obj: OTPVerification):
        now = timezone.now()
        if obj.is_verified:
            return badge(_("Used"), color="#198754")
        if obj.expires_at <= now:
            return badge(_("Expired"), color="#6c757d")
        return badge(_("Active"), color="#fd7e14")

    def has_add_permission(self, request):
        return False


@admin.register(SuperSetting)
class SuperSettingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "list_logo",
        "name",
        "phone",
        "is_open",
        "delivery_charge_per_km",
        "updated_at",
    )
    readonly_fields = ("created_at", "updated_at", "logo_preview")
    fieldsets = (
        (
            _("Branding"),
            {"fields": ("name", "logo", "logo_preview", "phone", "is_open")},
        ),
        (_("Location"), {"fields": ("latitude", "longitude", "address")}),
        (
            _("Delivery & SEO"),
            {
                "fields": (
                    "delivery_charge_per_km",
                    "meta_title",
                    "meta_description",
                    "meta_keywords",
                )
            },
        ),
        (
            _("Customer app pages"),
            {
                "fields": (
                    "about_us",
                    "terms_and_conditions",
                    "privacy_policy",
                )
            },
        ),
        (
            _("App version"),
            {
                "fields": (
                    "android_version",
                    "android_file",
                    "google_playstore_link",
                    "ios_version",
                    "ios_file",
                    "applestore_link",
                )
            },
        ),
        (_("Timestamps"), {"fields": ("created_at", "updated_at")}),
    )

    def has_add_permission(self, request):
        return not SuperSetting.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description=_("Logo"))
    def list_logo(self, obj: SuperSetting):
        return admin_img(obj.logo, size=36, alt=obj.name)

    @admin.display(description=_("Logo preview"))
    def logo_preview(self, obj: SuperSetting):
        return admin_img(obj.logo, size=96, alt=obj.name)


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("id", "list_image", "url", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("url",)
    ordering = ("id",)
    readonly_fields = ("created_at", "updated_at", "image_preview")
    fieldsets = (
        (None, {"fields": ("image", "image_preview", "url", "is_active")}),
        (_("Timestamps"), {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description=_("Image"))
    def list_image(self, obj: Banner):
        url = obj.image.url if obj.image else None
        return admin_img(url, size=56, alt=f"Banner {obj.pk}")

    @admin.display(description=_("Image preview"))
    def image_preview(self, obj: Banner):
        url = obj.image.url if obj.image else None
        return admin_img(url, size=160, alt=f"Banner {obj.pk}")


@admin.register(ParentCategory)
class ParentCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "list_image",
        "name",
        "slug",
        "sort_order",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (SubCategoryInline,)
    fieldsets = (
        (None, {"fields": ("name", "slug", "description", "image", "image_preview")}),
        (_("Display"), {"fields": ("sort_order", "is_active")}),
        (_("Timestamps"), {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at", "image_preview")

    @admin.display(description=_("Image"))
    def list_image(self, obj: ParentCategory):
        return admin_img(obj.resolved_image_url(), size=40, alt=obj.name)

    @admin.display(description=_("Image preview"))
    def image_preview(self, obj: ParentCategory):
        return admin_img(obj.resolved_image_url(), size=120, alt=obj.name)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "list_image",
        "name",
        "slug",
        "parent",
        "sort_order",
        "is_active",
        "product_count",
        "updated_at",
    )
    list_filter = ("is_active", "parent")
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ("parent",)
    fieldsets = (
        (None, {"fields": ("name", "slug", "parent", "description", "image", "image_preview")}),
        (_("Display"), {"fields": ("sort_order", "is_active")}),
        (_("Timestamps"), {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at", "image_preview")

    @admin.display(description=_("Image"))
    def list_image(self, obj: Category):
        return admin_img(obj.resolved_image_url(), size=40, alt=obj.name)

    @admin.display(description=_("Image preview"))
    def image_preview(self, obj: Category):
        return admin_img(obj.resolved_image_url(), size=120, alt=obj.name)

    @admin.display(description=_("Products"))
    def product_count(self, obj: Category):
        return obj.products.count()


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "sort_order", "updated_at")
    search_fields = ("name",)
    ordering = ("sort_order", "name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "list_thumb",
        "name",
        "category",
        "price_display",
        "effective_price_display",
        "stock_quantity",
        "flags_badges",
        "is_available",
        "updated_at",
    )
    list_filter = ("is_available", "is_featured", "is_veg", "is_sweet", "category", "deleted_at")
    search_fields = ("name", "slug", "short_description", "description")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ("category", "unit")
    inlines = (ProductImageInline,)
    readonly_fields = (
        "created_at",
        "updated_at",
        "thumbnail_preview",
        "effective_price_display",
    )
    fieldsets = (
        (
            _("Catalog"),
            {
                "fields": (
                    "category",
                    "name",
                    "slug",
                    "short_description",
                    "description",
                    "unit",
                    "sort_order",
                )
            },
        ),
        (
            _("Pricing & stock"),
            {
                "fields": (
                    "price",
                    "discount_type",
                    "discount_value",
                    "effective_price_display",
                    "stock_quantity",
                    "is_available",
                    "is_featured",
                    "is_veg",
                    "is_sweet",
                )
            },
        ),
        (
            _("Media"),
            {"fields": ("thumbnail_url", "thumbnail_preview", "deleted_at")},
        ),
        (_("Timestamps"), {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description=_("Thumb"))
    def list_thumb(self, obj: Product):
        return admin_img(obj.thumbnail_url, size=40, alt=obj.name)

    @admin.display(description=_("Thumbnail preview"))
    def thumbnail_preview(self, obj: Product):
        return admin_img(obj.thumbnail_url, size=140, alt=obj.name)

    @admin.display(description=_("Price"), ordering="price")
    def price_display(self, obj: Product):
        return npr(obj.price)

    @admin.display(description=_("Effective"))
    def effective_price_display(self, obj: Product):
        return npr(obj.effective_price)

    @admin.display(description=_("Flags"))
    def flags_badges(self, obj: Product):
        parts = []
        if obj.is_featured:
            parts.append(badge(_("Featured"), color="#ffc107", fg="#212529"))
        if obj.is_veg:
            parts.append(badge(_("Veg"), color="#198754"))
        else:
            parts.append(badge(_("Non-veg"), color="#6c757d"))
        if obj.is_sweet:
            parts.append(badge(_("Sweet"), color="#e91e8c"))
        if obj.deleted_at:
            parts.append(badge(_("Deleted"), color="#343a40"))
        return mark_safe(" ".join(str(p) for p in parts)) if parts else "—"


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "subtotal_display",
        "total_display",
        "item_count",
        "updated_at",
    )
    search_fields = ("user__phone", "user__name")
    autocomplete_fields = ("user",)
    inlines = (CartItemInline,)
    readonly_fields = ("created_at", "updated_at", "subtotal", "total")

    @admin.display(description=_("Subtotal"))
    def subtotal_display(self, obj: Cart):
        return npr(obj.subtotal)

    @admin.display(description=_("Total"))
    def total_display(self, obj: Cart):
        return npr(obj.total)

    @admin.display(description=_("Items"))
    def item_count(self, obj: Cart):
        return obj.items.count()


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "list_customer_thumb",
        "user",
        "status_badge",
        "subtotal_display",
        "delivery_fee_display",
        "total_display",
        "delivery_boy",
        "placed_at",
        "placed_natural",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "order_number",
        "user__phone",
        "user__name",
        "address",
        "special_instructions",
    )
    autocomplete_fields = ("user", "delivery_boy")
    readonly_fields = (
        "order_number",
        "created_at",
        "updated_at",
        "delivered_at",
        "cancelled_at",
        "map_links",
    )
    inlines = (OrderItemInline,)
    date_hierarchy = "created_at"
    fieldsets = (
        (
            _("Order"),
            {
                "fields": (
                    "order_number",
                    "user",
                    "delivery_boy",
                    "status",
                )
            },
        ),
        (
            _("Amounts"),
            {
                "fields": (
                    "subtotal",
                    "delivery_fee",
                    "platform_fee_amount",
                    "total_amount",
                )
            },
        ),
        (
            _("Delivery"),
            {
                "fields": (
                    "address",
                    "delivery_latitude",
                    "delivery_longitude",
                    "map_links",
                    "special_instructions",
                    "estimated_delivery_at",
                    "delivered_at",
                    "cancelled_at",
                    "cancellation_reason",
                )
            },
        ),
        (
            _("Pre-order"),
            {"fields": ("is_preorder", "pre_order_date_time")},
        ),
        (_("Timestamps"), {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description=_("Customer"))
    def list_customer_thumb(self, obj: Order):
        u = obj.user
        return admin_img(getattr(u, "profile_photo", None), size=40, alt=u.name)

    @admin.display(description=_("Status"), ordering="status")
    def status_badge(self, obj: Order):
        color = ORDER_STATUS_COLORS.get(obj.status, "#495057")
        return badge(obj.get_status_display(), color=color)

    @admin.display(description=_("Subtotal"))
    def subtotal_display(self, obj: Order):
        return npr(obj.subtotal)

    @admin.display(description=_("Delivery"))
    def delivery_fee_display(self, obj: Order):
        return npr(obj.delivery_fee)

    @admin.display(description=_("Total"))
    def total_display(self, obj: Order):
        return npr(obj.total_amount)

    @admin.display(description=_("Placed"), ordering="created_at")
    def placed_at(self, obj: Order):
        return obj.created_at.strftime("%Y-%m-%d %H:%M") if obj.created_at else "—"

    @admin.display(description=_("When"))
    def placed_natural(self, obj: Order):
        return naturaltime(obj.created_at) if obj.created_at else "—"

    @admin.display(description=_("Maps"))
    def map_links(self, obj: Order):
        if obj.delivery_latitude is None or obj.delivery_longitude is None:
            return _("No coordinates on this order.")
        lat = escape(str(obj.delivery_latitude))
        lng = escape(str(obj.delivery_longitude))
        gmaps = f"https://www.google.com/maps?q={lat},{lng}"
        osm = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=16/{lat}/{lng}"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener">Google Maps</a>'
            ' · <a href="{}" target="_blank" rel="noopener">OpenStreetMap</a>',
            gmaps,
            osm,
        )


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "type_badge",
        "medium_badge",
        "target_audience",
        "title",
        "recipient_count",
        "created_at",
        "created_natural",
    )
    list_filter = ("type", "medium", "target_audience", "created_at")
    search_fields = ("title", "body")
    filter_horizontal = ()  # using inline for recipients
    inlines = (NotificationUserInline,)
    readonly_fields = ("created_at",)
    fieldsets = (
        (None, {"fields": ("type", "title", "body", "medium", "target_audience", "data")}),
        (_("Meta"), {"fields": ("created_at",)}),
    )

    @admin.display(description=_("Type"), ordering="type")
    def type_badge(self, obj: Notification):
        return badge(obj.get_type_display(), color="#6f42c1")

    @admin.display(description=_("Medium"), ordering="medium")
    def medium_badge(self, obj: Notification):
        color = "#0d6efd" if obj.medium == Notification.Medium.PUSH else "#20c997"
        return badge(obj.get_medium_display(), color=color)

    @admin.display(description=_("Recipients"))
    def recipient_count(self, obj: Notification):
        return obj.recipients.count()

    @admin.display(description=_("When"))
    def created_natural(self, obj: Notification):
        return naturaltime(obj.created_at) if obj.created_at else "—"


# ProductImage registered only via inline — optional direct admin for bulk work
@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("id", "list_thumb", "product", "sort_order", "created_at")
    list_filter = ("product__category",)
    search_fields = ("product__name", "alt_text", "image_url")
    autocomplete_fields = ("product",)
    readonly_fields = ("created_at", "preview")

    @admin.display(description=_("Image"))
    def list_thumb(self, obj: ProductImage):
        return admin_img(obj.image_url, size=40, alt=obj.alt_text or "")

    @admin.display(description=_("Preview"))
    def preview(self, obj: ProductImage):
        return admin_img(obj.image_url, size=160, alt=obj.alt_text or "")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("id", "cart", "product", "quantity", "is_preorder", "unit_price_display", "total_price_display")
    search_fields = ("cart__user__phone", "product__name")
    autocomplete_fields = ("cart", "product")

    @admin.display(description=_("Unit"))
    def unit_price_display(self, obj: CartItem):
        return npr(obj.unit_price)

    @admin.display(description=_("Line"))
    def total_price_display(self, obj: CartItem):
        return npr(obj.total_price)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "list_product_thumb",
        "order",
        "product",
        "quantity",
        "unit_price_display",
        "total_price_display",
    )
    search_fields = ("order__order_number", "product__name")
    autocomplete_fields = ("order", "product")

    @admin.display(description=_("Product"))
    def list_product_thumb(self, obj: OrderItem):
        thumb = getattr(obj.product, "thumbnail_url", None)
        return admin_img(thumb, size=36, alt=obj.product.name)

    @admin.display(description=_("Unit"))
    def unit_price_display(self, obj: OrderItem):
        return npr(obj.unit_price)

    @admin.display(description=_("Line"))
    def total_price_display(self, obj: OrderItem):
        return npr(obj.total_price)


@admin.register(NotificationUser)
class NotificationUserAdmin(admin.ModelAdmin):
    list_display = ("id", "notification", "user", "delivery_status", "delivered_at")
    autocomplete_fields = ("notification", "user")
    list_filter = ("delivery_status",)
