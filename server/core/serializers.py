import uuid
from decimal import Decimal

from django.core.files.storage import default_storage
from rest_framework import serializers

from . import services
from .models import (
    Cart,
    CartItem,
    Category,
    CustomerAddress,
    Notification,
    NotificationUser,
    Order,
    OrderChatMessage,
    OrderItem,
    ParentCategory,
    Product,
    ProductImage,
    SuperSetting,
    Unit,
    User,
)


def _absolute_media_url(request, relative_url: str) -> str:
    if request is not None:
        return request.build_absolute_uri(relative_url)
    return relative_url


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "phone",
            "email",
            "profile_photo",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_delivery_boy",
            "is_online",
            "role",
            "latitude",
            "longitude",
            "address",
            "fcm_token",
            "deleted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_role(self, obj: User) -> str:
        if obj.is_superuser:
            return "super_admin"
        if obj.is_staff:
            return "admin"
        if obj.is_delivery_boy:
            return "delivery_boy"
        return "customer"


class UserMeUpdateSerializer(serializers.ModelSerializer):
    """PATCH `/api/auth/me/`; send `profile_photo_file` (multipart) to upload and set `profile_photo` URL."""

    profile_photo_file = serializers.ImageField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            "name",
            "email",
            "profile_photo",
            "profile_photo_file",
            "address",
            "latitude",
            "longitude",
            "fcm_token",
            "is_online",
        )
        extra_kwargs = {"email": {"required": False}}

    def validate(self, attrs: dict) -> dict:
        if "is_online" in attrs and not self.instance.is_delivery_boy:
            attrs.pop("is_online")
        return attrs

    def update(self, instance: User, validated_data):
        photo_file = validated_data.pop("profile_photo_file", None)
        instance = super().update(instance, validated_data)
        if photo_file is not None:
            ext = "png"
            fname = getattr(photo_file, "name", "") or ""
            if "." in fname:
                raw = fname.rsplit(".", 1)[-1].lower()
                if raw in ("jpg", "jpeg", "png", "gif", "webp"):
                    ext = "jpg" if raw == "jpeg" else raw
            path = default_storage.save(f"users/profile/{uuid.uuid4().hex}.{ext}", photo_file)
            rel = default_storage.url(path)
            request = self.context.get("request")
            if request is not None:
                instance.profile_photo = request.build_absolute_uri(rel)
            else:
                instance.profile_photo = rel
            instance.save(update_fields=["profile_photo", "updated_at"])
        return instance


class UserAdminListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "phone",
            "email",
            "profile_photo",
            "is_active",
            "is_staff",
            "is_delivery_boy",
            "is_online",
            "latitude",
            "longitude",
            "address",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class UserAdminWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=1, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = (
            "name",
            "phone",
            "email",
            "password",
            "is_active",
            "is_staff",
            "is_delivery_boy",
            "latitude",
            "longitude",
            "address",
            "profile_photo",
        )

    def create(self, validated_data):
        pwd = validated_data.pop("password", None)
        user = User(**validated_data)
        if pwd:
            user.set_password(pwd)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        pwd = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if pwd:
            instance.set_password(pwd)
        instance.save()
        return instance


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "name", "phone", "profile_photo", "address")


class CategorySerializer(serializers.ModelSerializer):
    """Subcategory (products reference these)."""

    image_url = serializers.SerializerMethodField()
    parent_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "image_url",
            "parent_id",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        )

    def get_image_url(self, obj: Category) -> str | None:
        if obj.image:
            return _absolute_media_url(self.context.get("request"), obj.image.url)
        return None


class ParentCategorySerializer(serializers.ModelSerializer):
    """Parent category with nested subcategories for storefront lists."""

    image_url = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = ParentCategory
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "image_url",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
            "children",
        )

    def get_image_url(self, obj: ParentCategory) -> str | None:
        if obj.image:
            return _absolute_media_url(self.context.get("request"), obj.image.url)
        return None

    def get_children(self, obj: ParentCategory):
        subs = obj.subcategories.filter(is_active=True).order_by("sort_order", "name")
        return CategorySerializer(subs, many=True, context=self.context).data


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ("id", "product_id", "image_url", "alt_text", "sort_order", "created_at")
        read_only_fields = ("id", "product_id", "created_at")


class UnitMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ("id", "name", "sort_order")


class ProductSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all())
    effective_price = serializers.SerializerMethodField()
    unit = UnitMiniSerializer(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "category_id",
            "name",
            "slug",
            "description",
            "short_description",
            "price",
            "discount_type",
            "discount_value",
            "effective_price",
            "unit",
            "stock_quantity",
            "is_available",
            "is_featured",
            "is_veg",
            "thumbnail_url",
            "sort_order",
            "created_at",
            "updated_at",
            "deleted_at",
            "images",
        )
        read_only_fields = ("created_at", "updated_at", "images", "effective_price")

    images = ProductImageSerializer(many=True, read_only=True)

    def get_effective_price(self, obj: Product) -> str:
        return str(obj.effective_price)


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )

    class Meta:
        model = CartItem
        fields = (
            "id",
            "cart_id",
            "product_id",
            "product",
            "quantity",
            "unit_price",
            "total_price",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "cart_id", "unit_price", "total_price", "created_at", "updated_at", "product")


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "user_id", "subtotal", "total", "created_at", "updated_at", "items")
        read_only_fields = fields


class CartItemWriteSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=255)


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "order_id",
            "product_id",
            "product",
            "unit_price",
            "quantity",
            "total_price",
            "notes",
            "created_at",
        )
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    customer = UserPublicSerializer(source="user", read_only=True)
    delivery_boy = UserPublicSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "user_id",
            "delivery_boy_id",
            "customer",
            "delivery_boy",
            "status",
            "subtotal",
            "delivery_fee",
            "total_amount",
            "address",
            "delivery_latitude",
            "delivery_longitude",
            "special_instructions",
            "estimated_delivery_at",
            "delivered_at",
            "cancelled_at",
            "cancellation_reason",
            "payment_method",
            "payment_status",
            "delivery_type",
            "created_at",
            "updated_at",
            "items",
        )
        read_only_fields = (
            "id",
            "order_number",
            "user_id",
            "customer",
            "delivery_boy",
            "subtotal",
            "delivery_fee",
            "total_amount",
            "delivered_at",
            "cancelled_at",
            "created_at",
            "updated_at",
            "items",
            "payment_method",
            "payment_status",
            "delivery_type",
        )


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    cancellation_reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class OrderTrackingLocationSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=10, decimal_places=8)
    longitude = serializers.DecimalField(max_digits=11, decimal_places=8)


class OrderAssignDeliverySerializer(serializers.Serializer):
    delivery_boy_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_delivery_boy=True),
        required=False,
        allow_null=True,
    )
    delivery_type = serializers.ChoiceField(
        choices=Order.DeliveryType.choices,
        required=False,
    )

    def validate(self, attrs):
        order: Order | None = self.context.get("order")
        boy = attrs.get("delivery_boy_id")
        if boy is None and order and order.delivery_boy_id:
            attrs["delivery_boy_id"] = order.delivery_boy
        elif boy is None and not (order and order.delivery_boy_id):
            raise serializers.ValidationError(
                {"delivery_boy_id": "Select a delivery partner or assign one first."}
            )
        assignee = attrs.get("delivery_boy_id")
        if assignee is not None and not getattr(assignee, "is_online", False):
            raise serializers.ValidationError(
                {
                    "delivery_boy_id": (
                        "This delivery partner is offline and cannot receive assignments."
                    )
                }
            )
        return attrs


class CheckoutSerializer(serializers.Serializer):
    address = serializers.CharField()
    delivery_latitude = serializers.DecimalField(
        max_digits=10, decimal_places=8, required=False, allow_null=True
    )
    delivery_longitude = serializers.DecimalField(
        max_digits=11, decimal_places=8, required=False, allow_null=True
    )
    special_instructions = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        lat = attrs.get("delivery_latitude")
        lon = attrs.get("delivery_longitude")
        if lat is None or lon is None:
            raise serializers.ValidationError(
                "Delivery map pin (latitude and longitude) is required."
            )
        return attrs


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = ("id", "label", "address", "latitude", "longitude", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class OrderChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.name", read_only=True)
    order_id = serializers.IntegerField(read_only=True)
    my_delivered_at = serializers.SerializerMethodField()
    my_read_at = serializers.SerializerMethodField()

    class Meta:
        model = OrderChatMessage
        fields = (
            "id",
            "order_id",
            "sender",
            "sender_name",
            "body",
            "support",
            "rider_staff",
            "customer_rider",
            "aggregate_status",
            "created_at",
            "my_delivered_at",
            "my_read_at",
        )
        read_only_fields = (
            "id",
            "order_id",
            "sender",
            "sender_name",
            "aggregate_status",
            "created_at",
            "my_delivered_at",
            "my_read_at",
        )

    def _viewer(self):
        req = self.context.get("request")
        if req is not None and getattr(req, "user", None) is not None:
            return req.user
        return self.context.get("user")

    def _first_my_receipt(self, obj: OrderChatMessage):
        rlist = getattr(obj, "_my_receipts", None)
        if rlist:
            return rlist[0]
        user = self._viewer()
        if user and getattr(user, "is_authenticated", True):
            return obj.receipts.filter(user_id=user.id).only("delivered_at", "read_at").first()
        return None

    def get_my_delivered_at(self, obj: OrderChatMessage):
        rec = self._first_my_receipt(obj)
        return rec.delivered_at.isoformat() if rec and rec.delivered_at else None

    def get_my_read_at(self, obj: OrderChatMessage):
        rec = self._first_my_receipt(obj)
        return rec.read_at.isoformat() if rec and rec.read_at else None


class OrderChatMessageWriteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, min_length=1, trim_whitespace=True)
    support = serializers.BooleanField(required=False, default=False)
    rider_staff = serializers.BooleanField(required=False, default=False)
    customer_rider = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        s = bool(attrs.get("support"))
        r = bool(attrs.get("rider_staff"))
        c = bool(attrs.get("customer_rider"))
        if sum(1 for x in (s, r, c) if x) > 1:
            raise serializers.ValidationError(
                {"detail": "Choose only one thread: support, rider_staff, or customer_rider."}
            )
        return attrs


class SuperSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuperSetting
        fields = (
            "id",
            "name",
            "logo",
            "latitude",
            "longitude",
            "address",
            "phone",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "delivery_charge_per_km",
            "is_open",
            "android_file",
            "google_playstore_link",
            "ios_file",
            "applestore_link",
            "android_version",
            "ios_version",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


def _save_supersetting_uploaded_file(request, uploaded, subdir: str, default_ext: str) -> str:
    ext = default_ext
    fname = getattr(uploaded, "name", "") or ""
    if "." in fname:
        raw = fname.rsplit(".", 1)[-1].lower()
        if raw:
            ext = raw
    path = default_storage.save(f"store/{subdir}/{uuid.uuid4().hex}.{ext}", uploaded)
    rel = default_storage.url(path)
    if request is not None:
        return request.build_absolute_uri(rel)
    return rel


class SuperSettingUpdateSerializer(serializers.ModelSerializer):
    """PATCH store settings; send `logo_file` (multipart) to upload and set `logo` URL."""

    logo_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    android_file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    ios_file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = SuperSetting
        fields = (
            "name",
            "logo",
            "logo_file",
            "latitude",
            "longitude",
            "address",
            "phone",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "delivery_charge_per_km",
            "is_open",
            "android_file",
            "google_playstore_link",
            "ios_file",
            "applestore_link",
            "android_version",
            "ios_version",
            "android_file_upload",
            "ios_file_upload",
        )

    def update(self, instance: SuperSetting, validated_data):
        logo_file = validated_data.pop("logo_file", None)
        android_file_upload = validated_data.pop("android_file_upload", None)
        ios_file_upload = validated_data.pop("ios_file_upload", None)
        instance = super().update(instance, validated_data)
        request = self.context.get("request")
        extra_fields: list[str] = []

        if logo_file is not None:
            ext = "png"
            fname = getattr(logo_file, "name", "") or ""
            if "." in fname:
                raw = fname.rsplit(".", 1)[-1].lower()
                if raw in ("jpg", "jpeg", "png", "gif", "webp"):
                    ext = "jpg" if raw == "jpeg" else raw
            path = default_storage.save(f"store/logo/{uuid.uuid4().hex}.{ext}", logo_file)
            rel = default_storage.url(path)
            if request is not None:
                instance.logo = request.build_absolute_uri(rel)
            else:
                instance.logo = rel
            extra_fields.append("logo")

        if android_file_upload is not None:
            instance.android_file = _save_supersetting_uploaded_file(
                request, android_file_upload, "apps/android", "apk"
            )
            extra_fields.append("android_file")

        if ios_file_upload is not None:
            instance.ios_file = _save_supersetting_uploaded_file(
                request, ios_file_upload, "apps/ios", "ipa"
            )
            extra_fields.append("ios_file")

        if extra_fields:
            instance.save(update_fields=extra_fields + ["updated_at"])
        return instance


class UnitAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ("id", "name", "sort_order", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ProductAdminSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all())
    category_name = serializers.CharField(source="category.name", read_only=True)
    unit_id = serializers.PrimaryKeyRelatedField(
        source="unit", queryset=Unit.objects.all(), required=False, allow_null=False
    )
    unit = UnitMiniSerializer(read_only=True)
    effective_price = serializers.SerializerMethodField(read_only=True)
    thumbnail_file = serializers.ImageField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "category_id",
            "category_name",
            "name",
            "slug",
            "description",
            "short_description",
            "price",
            "discount_type",
            "discount_value",
            "effective_price",
            "unit_id",
            "unit",
            "stock_quantity",
            "is_available",
            "is_featured",
            "is_veg",
            "thumbnail_url",
            "thumbnail_file",
            "sort_order",
            "created_at",
            "updated_at",
            "deleted_at",
            "images",
        )
        read_only_fields = ("created_at", "updated_at", "images", "effective_price", "unit", "category_name")

    images = ProductImageSerializer(many=True, read_only=True)

    def get_effective_price(self, obj: Product) -> str:
        return str(obj.effective_price)

    def validate(self, attrs):
        inst = self.instance
        if inst is None and attrs.get("unit") is None:
            raise serializers.ValidationError({"unit_id": "This field is required."})
        dtype = attrs.get("discount_type", getattr(inst, "discount_type", None) if inst else Product.DiscountType.FLAT)
        if dtype is None:
            dtype = Product.DiscountType.FLAT
        val = attrs.get("discount_value", None)
        if inst is not None and "discount_value" not in attrs and self.partial:
            val = inst.discount_value
        if val is not None and val > 0:
            if dtype == Product.DiscountType.PERCENTAGE and val > 100:
                raise serializers.ValidationError({"discount_value": "Percentage must be between 0 and 100."})
        return attrs

    def _save_thumbnail_from_upload(self, instance: Product, thumbnail_file) -> None:
        ext = "png"
        fname = getattr(thumbnail_file, "name", "") or ""
        if "." in fname:
            raw = fname.rsplit(".", 1)[-1].lower()
            if raw in ("jpg", "jpeg", "png", "gif", "webp"):
                ext = "jpg" if raw == "jpeg" else raw
        path = default_storage.save(f"products/thumbnails/{uuid.uuid4().hex}.{ext}", thumbnail_file)
        rel = default_storage.url(path)
        request = self.context.get("request")
        if request is not None:
            instance.thumbnail_url = request.build_absolute_uri(rel)
        else:
            instance.thumbnail_url = rel
        instance.save(update_fields=["thumbnail_url", "updated_at"])

    def create(self, validated_data):
        thumbnail_file = validated_data.pop("thumbnail_file", None)
        instance = super().create(validated_data)
        if thumbnail_file:
            self._save_thumbnail_from_upload(instance, thumbnail_file)
        return instance

    def update(self, instance, validated_data):
        thumbnail_file = validated_data.pop("thumbnail_file", None)
        instance = super().update(instance, validated_data)
        if thumbnail_file:
            self._save_thumbnail_from_upload(instance, thumbnail_file)
        return instance


class ParentCategoryAdminSerializer(serializers.ModelSerializer):
    kind = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    image = serializers.ImageField(write_only=True, required=False, allow_null=True)
    products_count = serializers.SerializerMethodField()
    subcategories_count = serializers.SerializerMethodField()

    class Meta:
        model = ParentCategory
        fields = (
            "id",
            "kind",
            "name",
            "slug",
            "description",
            "image_url",
            "image",
            "sort_order",
            "is_active",
            "products_count",
            "subcategories_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "image_url",
            "products_count",
            "subcategories_count",
            "kind",
        )

    def get_kind(self, obj: ParentCategory) -> str:
        return "parent"

    def get_products_count(self, obj: ParentCategory) -> int:
        annotated = getattr(obj, "products_count", None)
        if annotated is not None:
            return int(annotated)
        return (
            Product.objects.filter(
                category__parent=obj,
                deleted_at__isnull=True,
            ).count()
        )

    def get_subcategories_count(self, obj: ParentCategory) -> int:
        annotated = getattr(obj, "subcategories_count", None)
        if annotated is not None:
            return int(annotated)
        return obj.subcategories.count()

    def get_image_url(self, obj: ParentCategory) -> str | None:
        if obj.image:
            return _absolute_media_url(self.context.get("request"), obj.image.url)
        return None


class CategoryAdminSerializer(serializers.ModelSerializer):
    """Subcategory (admin)."""

    kind = serializers.SerializerMethodField()
    parent_id = serializers.PrimaryKeyRelatedField(source="parent", queryset=ParentCategory.objects.all())
    image_url = serializers.SerializerMethodField()
    image = serializers.ImageField(write_only=True, required=False, allow_null=True)
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = (
            "id",
            "kind",
            "name",
            "slug",
            "description",
            "image_url",
            "image",
            "parent_id",
            "sort_order",
            "is_active",
            "products_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "image_url", "products_count", "kind")

    def get_kind(self, obj: Category) -> str:
        return "sub"

    def get_products_count(self, obj: Category) -> int:
        annotated = getattr(obj, "products_count", None)
        if annotated is not None:
            return int(annotated)
        return obj.products.filter(deleted_at__isnull=True).count()

    def get_image_url(self, obj: Category) -> str | None:
        if obj.image:
            return _absolute_media_url(self.context.get("request"), obj.image.url)
        return None


class NotificationBroadcastSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=Notification.Type.choices)
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    medium = serializers.ChoiceField(choices=Notification.Medium.choices)
    target = serializers.ChoiceField(
        choices=[
            ("all_customers", "all_customers"),
            ("all_delivery_boys", "all_delivery_boys"),
        ],
        default="all_customers",
    )
    recipient_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )

    def validate(self, attrs: dict) -> dict:
        ids = attrs.get("recipient_ids")
        if ids is not None and len(ids) != len(set(ids)):
            raise serializers.ValidationError({"recipient_ids": "Duplicate user IDs are not allowed."})
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    """Client-facing notification feed (no admin-only fields)."""

    read_at = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "title",
            "body",
            "medium",
            "data",
            "created_at",
            "read_at",
        )
        read_only_fields = fields

    def get_read_at(self, obj: Notification):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        link = next(iter(obj.notification_users.all()), None)
        if link is None:
            return None
        return link.read_at


class NotificationRecipientSerializer(serializers.ModelSerializer):
    """Admin: per-user delivery outcome."""

    user_name = serializers.CharField(source="user.name", read_only=True)
    user_phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = NotificationUser
        fields = (
            "user_id",
            "user_name",
            "user_phone",
            "delivery_status",
            "error_message",
            "delivered_at",
        )
        read_only_fields = fields


class NotificationAdminListSerializer(serializers.ModelSerializer):
    """Staff: list/history with audience and delivery aggregates."""

    recipients_count = serializers.IntegerField(read_only=True, required=False)
    delivery_sent_count = serializers.IntegerField(read_only=True, required=False)
    delivery_failed_count = serializers.IntegerField(read_only=True, required=False)
    delivery_skipped_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "title",
            "body",
            "medium",
            "target_audience",
            "data",
            "created_at",
            "recipients_count",
            "delivery_sent_count",
            "delivery_failed_count",
            "delivery_skipped_count",
        )
        read_only_fields = fields


class NotificationAdminUpdateSerializer(serializers.ModelSerializer):
    """Staff: update stored notification metadata (does not re-send)."""

    class Meta:
        model = Notification
        fields = ("type", "title", "body", "medium", "target_audience")


class OtpSendSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    purpose = serializers.ChoiceField(choices=("login", "register"))

    def validate_phone(self, value: str) -> str:
        from .utils.phone import normalize_phone

        digits = normalize_phone(value)
        if len(digits) < 7 or len(digits) > 15:
            raise serializers.ValidationError("Enter a valid phone number.")
        return digits


class OtpVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    purpose = serializers.ChoiceField(choices=("login", "register"))
    otp = serializers.CharField(max_length=10, trim_whitespace=True)
    name = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_phone(self, value: str) -> str:
        from .utils.phone import normalize_phone

        digits = normalize_phone(value)
        if len(digits) < 7 or len(digits) > 15:
            raise serializers.ValidationError("Enter a valid phone number.")
        return digits

    def validate(self, attrs):
        purpose = attrs["purpose"]
        name = (attrs.get("name") or "").strip()
        if purpose == "register" and len(name) < 2:
            raise serializers.ValidationError({"name": "Enter your full name."})
        if purpose == "register":
            attrs["name"] = name
        else:
            attrs["name"] = name if len(name) >= 2 else ""
        return attrs
