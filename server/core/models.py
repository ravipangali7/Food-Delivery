from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone, password, **extra_fields):
        if not phone:
            raise ValueError(_("The phone must be set"))
        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(phone, password, **extra_fields)

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))
        return self._create_user(phone, password, **extra_fields)


class User(AbstractUser):
    """Custom user: OTP/phone login; `phone` is the unique login identifier."""

    username = None
    name = models.CharField(_("full name"), max_length=100)
    phone = models.CharField(_("phone"), max_length=15, unique=True, db_index=True)
    email = models.EmailField(_("email address"), blank=True)
    profile_photo = models.URLField(_("profile photo URL"), max_length=500, blank=True, null=True)
    is_delivery_boy = models.BooleanField(_("is delivery boy"), default=False)
    is_online = models.BooleanField(
        _("is online (delivery partners)"),
        default=True,
        help_text=_("When False, assigned delivery partners do not receive or see orders."),
    )
    latitude = models.DecimalField(
        _("latitude"), max_digits=10, decimal_places=8, blank=True, null=True
    )
    longitude = models.DecimalField(
        _("longitude"), max_digits=11, decimal_places=8, blank=True, null=True
    )
    address = models.TextField(_("address"), blank=True, null=True)
    fcm_token = models.CharField(_("FCM token"), max_length=500, blank=True, null=True)
    deleted_at = models.DateTimeField(_("deleted at"), blank=True, null=True)
    last_chat_ping_at = models.DateTimeField(
        _("last chat presence ping"),
        blank=True,
        null=True,
        help_text=_("Updated by WebSocket heartbeats; used for online indicators in chat."),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        db_table = "users"
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.phone})"


class OTPVerification(models.Model):
    """One-time password for phone login/registration; single-use after verification."""

    class Purpose(models.TextChoices):
        LOGIN = "login", _("Login")
        REGISTER = "register", _("Register")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="otp_verifications",
        verbose_name=_("user"),
    )
    phone_number = models.CharField(_("phone number"), max_length=15, db_index=True)
    otp_code = models.CharField(_("OTP code"), max_length=6)
    purpose = models.CharField(
        _("purpose"), max_length=16, choices=Purpose.choices, db_index=True
    )
    is_verified = models.BooleanField(_("verified"), default=False)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    expires_at = models.DateTimeField(_("expires at"))

    class Meta:
        db_table = "otp_verifications"
        verbose_name = _("OTP verification")
        verbose_name_plural = _("OTP verifications")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["phone_number", "purpose", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.phone_number} ({self.get_purpose_display()}) @ {self.created_at}"


class SuperSetting(models.Model):
    """Singleton store configuration (convention: single row, typically id=1)."""

    name = models.CharField(_("store name"), max_length=100)
    logo = models.URLField(_("logo URL"), max_length=500, blank=True, null=True)
    latitude = models.DecimalField(
        _("latitude"), max_digits=10, decimal_places=8, blank=True, null=True
    )
    longitude = models.DecimalField(
        _("longitude"), max_digits=11, decimal_places=8, blank=True, null=True
    )
    address = models.TextField(_("address"), blank=True, null=True)
    phone = models.CharField(_("contact phone"), max_length=15, blank=True, null=True)
    meta_title = models.CharField(_("meta title"), max_length=255, blank=True, null=True)
    meta_description = models.TextField(_("meta description"), blank=True, null=True)
    meta_keywords = models.CharField(_("meta keywords"), max_length=500, blank=True, null=True)
    delivery_charge_per_km = models.DecimalField(
        _("delivery charge per km (NPR)"),
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    is_open = models.BooleanField(_("store open"), default=True)
    android_file = models.URLField(_("Android package URL"), max_length=500, blank=True, null=True)
    google_playstore_link = models.URLField(_("Google Play Store link"), max_length=500, blank=True, null=True)
    ios_file = models.URLField(_("iOS package URL"), max_length=500, blank=True, null=True)
    applestore_link = models.URLField(_("Apple App Store link"), max_length=500, blank=True, null=True)
    android_version = models.CharField(_("Android app version"), max_length=32, blank=True, null=True)
    ios_version = models.CharField(_("iOS app version"), max_length=32, blank=True, null=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "super_setting"
        verbose_name = _("super setting")
        verbose_name_plural = _("super settings")

    def __str__(self) -> str:
        return self.name


class ParentCategory(models.Model):
    """Top-level category (e.g. Mithai, Snacks). Subcategories are stored as `Category` rows."""

    name = models.CharField(_("name"), max_length=100)
    slug = models.SlugField(_("slug"), max_length=120, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    image = models.ImageField(_("image"), upload_to="parent_categories/", blank=True, null=True)
    sort_order = models.PositiveSmallIntegerField(_("sort order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "parent_categories"
        verbose_name = _("parent category")
        verbose_name_plural = _("parent categories")
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name

    def resolved_image_url(self) -> str | None:
        return self.image.url if self.image else None


class Category(models.Model):
    """Subcategory under a parent. Products are always assigned to a subcategory."""

    parent = models.ForeignKey(
        ParentCategory,
        on_delete=models.CASCADE,
        related_name="subcategories",
        verbose_name=_("parent category"),
    )
    name = models.CharField(_("name"), max_length=100)
    slug = models.SlugField(_("slug"), max_length=120, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    image = models.ImageField(_("image"), upload_to="categories/subs/", blank=True, null=True)
    sort_order = models.PositiveSmallIntegerField(_("sort order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "categories"
        verbose_name = _("subcategory")
        verbose_name_plural = _("subcategories")
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name

    def resolved_image_url(self) -> str | None:
        return self.image.url if self.image else None


class Unit(models.Model):
    """Sellable unit label (kg, piece, plate, …) managed from admin."""

    name = models.CharField(_("name"), max_length=50, unique=True)
    sort_order = models.PositiveSmallIntegerField(_("sort order"), default=0)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "units"
        verbose_name = _("unit")
        verbose_name_plural = _("units")
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    class DiscountType(models.TextChoices):
        FLAT = "flat", _("Flat amount")
        PERCENTAGE = "percentage", _("Percentage")

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name=_("category"),
    )
    name = models.CharField(_("name"), max_length=200)
    slug = models.SlugField(_("slug"), max_length=220, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    short_description = models.CharField(
        _("short description"), max_length=300, blank=True, null=True
    )
    price = models.DecimalField(_("price (NPR)"), max_digits=10, decimal_places=2)
    discount_type = models.CharField(
        _("discount type"),
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.FLAT,
    )
    discount_value = models.DecimalField(
        _("discount value"),
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text=_("Flat: NPR off. Percentage: 0–100."),
    )
    unit = models.ForeignKey(
        Unit,
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name=_("unit"),
    )
    stock_quantity = models.PositiveIntegerField(_("stock quantity"), default=0)
    is_available = models.BooleanField(_("available"), default=True)
    is_featured = models.BooleanField(_("featured"), default=False)
    is_veg = models.BooleanField(_("vegetarian"), default=True)
    thumbnail_url = models.URLField(_("thumbnail URL"), max_length=500, blank=True, null=True)
    sort_order = models.PositiveSmallIntegerField(_("sort order"), default=0)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    deleted_at = models.DateTimeField(_("deleted at"), blank=True, null=True)

    class Meta:
        db_table = "products"
        verbose_name = _("product")
        verbose_name_plural = _("products")
        ordering = ["sort_order", "name"]
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["is_available", "deleted_at"]),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def effective_price(self) -> Decimal:
        base = self.price
        if self.discount_value is None or self.discount_value <= 0:
            return base
        if self.discount_type == self.DiscountType.PERCENTAGE:
            pct = self.discount_value
            if pct > 100:
                pct = Decimal("100")
            deduction = (base * pct / Decimal("100")).quantize(Decimal("0.01"))
            out = base - deduction
        else:
            out = base - self.discount_value
        return out if out > 0 else Decimal("0.00")


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name=_("product"),
    )
    image_url = models.URLField(_("image URL"), max_length=500)
    alt_text = models.CharField(_("alt text"), max_length=255, blank=True, null=True)
    sort_order = models.PositiveSmallIntegerField(_("sort order"), default=0)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "product_images"
        verbose_name = _("product image")
        verbose_name_plural = _("product images")
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        u = self.image_url or ""
        return f"{self.product_id}: {u[:48]}…" if len(u) > 48 else (u or f"Image #{self.pk}")


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
        verbose_name=_("user"),
    )
    subtotal = models.DecimalField(
        _("subtotal"), max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    total = models.DecimalField(
        _("total"), max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "carts"
        verbose_name = _("cart")
        verbose_name_plural = _("carts")

    def __str__(self) -> str:
        return f"Cart #{self.pk} — {self.user}"


class CartItem(models.Model):
    cart = models.ForeignKey(
        Cart, on_delete=models.CASCADE, related_name="items", verbose_name=_("cart")
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="cart_items", verbose_name=_("product")
    )
    quantity = models.PositiveSmallIntegerField(_("quantity"), default=1)
    unit_price = models.DecimalField(_("unit price"), max_digits=10, decimal_places=2)
    total_price = models.DecimalField(_("total price"), max_digits=10, decimal_places=2)
    notes = models.CharField(_("notes"), max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "cart_items"
        verbose_name = _("cart item")
        verbose_name_plural = _("cart items")
        constraints = [
            models.UniqueConstraint(fields=["cart", "product"], name="uq_cart_items_cart_product")
        ]

    def __str__(self) -> str:
        return f"{self.product} × {self.quantity}"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        CONFIRMED = "confirmed", _("Confirmed")
        PREPARING = "preparing", _("Preparing")
        READY_FOR_DELIVERY = "ready_for_delivery", _("Ready for delivery")
        OUT_FOR_DELIVERY = "out_for_delivery", _("Out for delivery")
        DELIVERED = "delivered", _("Delivered")
        CANCELLED = "cancelled", _("Cancelled")
        FAILED = "failed", _("Failed")

    class PaymentMethod(models.TextChoices):
        CASH_ON_DELIVERY = "cash_on_delivery", _("Cash on delivery")

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", _("Pending")
        PAID = "paid", _("Paid")

    class DeliveryType(models.TextChoices):
        BIKE = "bike", _("Bike")
        WALKING = "walking", _("Walking")

    order_number = models.CharField(
        _("order number"), max_length=20, unique=True, editable=False, blank=True, null=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name=_("customer"),
    )
    delivery_boy = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_orders",
        verbose_name=_("delivery boy"),
    )
    status = models.CharField(
        _("status"), max_length=32, choices=Status.choices, default=Status.PENDING
    )
    subtotal = models.DecimalField(_("subtotal"), max_digits=10, decimal_places=2)
    delivery_fee = models.DecimalField(
        _("delivery fee"), max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    total_amount = models.DecimalField(_("total amount"), max_digits=10, decimal_places=2)
    address = models.TextField(_("delivery address"))
    delivery_latitude = models.DecimalField(
        _("delivery latitude"), max_digits=10, decimal_places=8, blank=True, null=True
    )
    delivery_longitude = models.DecimalField(
        _("delivery longitude"), max_digits=11, decimal_places=8, blank=True, null=True
    )
    special_instructions = models.TextField(_("special instructions"), blank=True, null=True)
    estimated_delivery_at = models.DateTimeField(
        _("estimated delivery"), blank=True, null=True
    )
    delivered_at = models.DateTimeField(_("delivered at"), blank=True, null=True)
    cancelled_at = models.DateTimeField(_("cancelled at"), blank=True, null=True)
    cancellation_reason = models.CharField(
        _("cancellation reason"), max_length=255, blank=True, null=True
    )
    driver_latitude = models.DecimalField(
        _("driver latitude"), max_digits=10, decimal_places=8, blank=True, null=True
    )
    driver_longitude = models.DecimalField(
        _("driver longitude"), max_digits=11, decimal_places=8, blank=True, null=True
    )
    route_polyline = models.TextField(_("route polyline (encoded)"), blank=True, null=True)
    route_straight_fallback = models.BooleanField(_("straight-line route fallback"), default=False)
    route_distance_meters = models.PositiveIntegerField(
        _("route distance (meters)"), blank=True, null=True
    )
    route_duration_seconds = models.PositiveIntegerField(
        _("route duration (seconds)"), blank=True, null=True
    )
    tracking_updated_at = models.DateTimeField(_("tracking updated at"), blank=True, null=True)
    payment_method = models.CharField(
        _("payment method"),
        max_length=32,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH_ON_DELIVERY,
    )
    payment_status = models.CharField(
        _("payment status"),
        max_length=16,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    delivery_type = models.CharField(
        _("delivery type"),
        max_length=16,
        choices=DeliveryType.choices,
        default=DeliveryType.BIKE,
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "orders"
        verbose_name = _("order")
        verbose_name_plural = _("orders")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return self.order_number or f"Order #{self.pk}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        expected = f"SS-{self.pk:08d}"
        if self.order_number != expected:
            Order.objects.filter(pk=self.pk).update(order_number=expected)
            self.order_number = expected


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items", verbose_name=_("order")
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="order_items", verbose_name=_("product")
    )
    unit_price = models.DecimalField(_("unit price"), max_digits=10, decimal_places=2)
    quantity = models.PositiveSmallIntegerField(_("quantity"))
    total_price = models.DecimalField(_("total price"), max_digits=10, decimal_places=2)
    notes = models.CharField(_("notes"), max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "order_items"
        verbose_name = _("order item")
        verbose_name_plural = _("order items")
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.order_id}: {self.product} × {self.quantity}"


class Notification(models.Model):
    class Type(models.TextChoices):
        ORDER_PLACED = "order_placed", _("Order placed")
        ORDER_CONFIRMED = "order_confirmed", _("Order confirmed")
        OUT_FOR_DELIVERY = "out_for_delivery", _("Out for delivery")
        DELIVERED = "delivered", _("Delivered")
        CANCELLED = "cancelled", _("Cancelled")
        PROMO = "promo", _("Promo")

    class Medium(models.TextChoices):
        SMS = "sms", _("SMS")
        PUSH = "push_notification", _("Push notification")

    class TargetAudience(models.TextChoices):
        ALL_CUSTOMERS = "all_customers", _("All customers")
        ALL_DELIVERY_BOYS = "all_delivery_boys", _("All delivery partners")
        ALL_USERS = "all_users", _("All users (legacy broadcast)")
        DIRECT = "direct", _("Direct (selected recipients)")

    type = models.CharField(_("type"), max_length=32, choices=Type.choices)
    title = models.CharField(_("title"), max_length=255)
    body = models.TextField(_("body"))
    medium = models.CharField(_("medium"), max_length=32, choices=Medium.choices)
    target_audience = models.CharField(
        _("target audience"),
        max_length=32,
        choices=TargetAudience.choices,
        default=TargetAudience.ALL_CUSTOMERS,
    )
    data = models.JSONField(_("data"), blank=True, null=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="NotificationUser",
        related_name="notifications",
        verbose_name=_("recipients"),
    )

    class Meta:
        db_table = "notifications"
        verbose_name = _("notification")
        verbose_name_plural = _("notifications")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_type_display()}: {self.title[:50]}"


class NotificationUser(models.Model):
    class DeliveryStatus(models.TextChoices):
        PENDING = "pending", _("Pending")
        SENT = "sent", _("Sent")
        FAILED = "failed", _("Failed")
        SKIPPED = "skipped", _("Skipped")

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="notification_users",
        verbose_name=_("notification"),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_links",
        verbose_name=_("user"),
    )
    delivery_status = models.CharField(
        _("delivery status"),
        max_length=16,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )
    error_message = models.CharField(_("error message"), max_length=500, blank=True, default="")
    delivered_at = models.DateTimeField(_("delivered at"), blank=True, null=True)
    read_at = models.DateTimeField(_("read at"), blank=True, null=True)

    class Meta:
        db_table = "notification_users"
        verbose_name = _("notification recipient")
        verbose_name_plural = _("notification recipients")
        constraints = [
            models.UniqueConstraint(
                fields=["notification", "user"],
                name="uq_notification_users_notification_user",
            )
        ]

    def __str__(self) -> str:
        return f"{self.notification_id} → {self.user_id}"


class CustomerAddress(models.Model):
    """Multiple delivery addresses saved by a customer (checkout selection)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_addresses",
        verbose_name=_("customer"),
    )
    label = models.CharField(_("label"), max_length=80, blank=True, default="")
    address = models.TextField(_("address"))
    latitude = models.DecimalField(
        _("latitude"), max_digits=10, decimal_places=8, blank=True, null=True
    )
    longitude = models.DecimalField(
        _("longitude"), max_digits=11, decimal_places=8, blank=True, null=True
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        db_table = "customer_addresses"
        verbose_name = _("saved address")
        verbose_name_plural = _("saved addresses")
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.label or 'Address'} — {self.user_id}"


class OrderChatMessage(models.Model):
    """In-app chat: support (customer ↔ staff), customer delivery coordination, or rider ↔ staff ops."""

    class AggregateStatus(models.TextChoices):
        SENT = "sent", _("Sent")
        DELIVERED = "delivered", _("Delivered")
        SEEN = "seen", _("Seen")

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="chat_messages",
        verbose_name=_("order"),
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="order_chat_messages",
        verbose_name=_("sender"),
    )
    body = models.TextField(_("message"), max_length=2000)
    support = models.BooleanField(
        _("support thread"),
        default=False,
        help_text=_("If true, only the customer and store staff see this message (not the delivery partner)."),
    )
    rider_staff = models.BooleanField(
        _("rider–staff thread"),
        default=False,
        help_text=_(
            "If true, only the assigned delivery partner and store staff see this message (not the customer)."
        ),
    )
    customer_rider = models.BooleanField(
        _("customer–rider thread"),
        default=False,
        help_text=_(
            "If true, only the ordering customer, the assigned delivery partner, and store staff see this message."
        ),
    )
    aggregate_status = models.CharField(
        _("delivery status"),
        max_length=16,
        choices=AggregateStatus.choices,
        default=AggregateStatus.SENT,
        db_index=True,
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "order_chat_messages"
        verbose_name = _("order chat message")
        verbose_name_plural = _("order chat messages")
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["order", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"#{self.order_id} from {self.sender_id}"


class OrderChatReceipt(models.Model):
    """Per-recipient delivery/read state for an order chat message (WhatsApp-style ticks)."""

    message = models.ForeignKey(
        OrderChatMessage,
        on_delete=models.CASCADE,
        related_name="receipts",
        verbose_name=_("message"),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="order_chat_receipts",
        verbose_name=_("recipient"),
    )
    delivered_at = models.DateTimeField(_("delivered at"), blank=True, null=True)
    read_at = models.DateTimeField(_("read at"), blank=True, null=True)

    class Meta:
        db_table = "order_chat_receipts"
        verbose_name = _("order chat receipt")
        verbose_name_plural = _("order chat receipts")
        constraints = [
            models.UniqueConstraint(fields=["message", "user"], name="uq_order_chat_receipt_message_user")
        ]
        indexes = [
            models.Index(fields=["message"]),
        ]

    def __str__(self) -> str:
        return f"msg {self.message_id} → user {self.user_id}"
