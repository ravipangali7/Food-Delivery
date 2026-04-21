"""Client-facing API: catalog, cart, checkout, orders, notifications, auth."""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ... import services
from ...tracking import (
    broadcast_chat_message_update,
    broadcast_order_chat_message,
    broadcast_tracking_location,
    build_tracking_payload,
    ensure_route_for_order,
)
from django.db.models import Prefetch

from ...models import (
    CartItem,
    Category,
    CustomerAddress,
    Notification,
    NotificationUser,
    Order,
    OrderChatMessage,
    OrderChatReceipt,
    ParentCategory,
    Product,
    SuperSetting,
    User,
)
from ...chat_utils import can_user_ack_message, record_delivered, record_read
from ...serializers import (
    CartItemWriteSerializer,
    CartSerializer,
    CategorySerializer,
    CustomerAddressSerializer,
    OrderChatMessageSerializer,
    OrderChatMessageWriteSerializer,
    ParentCategorySerializer,
    CheckoutSerializer,
    NotificationSerializer,
    OrderSerializer,
    OrderStatusUpdateSerializer,
    OrderTrackingLocationSerializer,
    ProductSerializer,
    SuperSettingSerializer,
    UserMeUpdateSerializer,
    UserSerializer,
)
from ..helpers import (
    can_access_order_chat_order,
    can_use_customer_delivery_chat_thread,
    can_use_customer_rider_chat_thread,
    can_use_rider_staff_chat_thread,
    can_use_support_chat_thread,
    can_manage_order_status,
    can_view_order_tracking,
    get_or_create_cart,
    is_delivery_boy_offline,
    order_queryset_for_user,
    persist_order_chat_message,
)


def _product_queryset(request):
    if request.user.is_authenticated and request.user.is_staff:
        return Product.objects.select_related("category", "unit").prefetch_related("images")
    return (
        Product.objects.filter(deleted_at__isnull=True, is_available=True)
        .select_related("category", "unit")
        .prefetch_related("images")
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def product_list(request):
    qs = _product_queryset(request)
    return Response(ProductSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def product_detail(request, pk):
    qs = _product_queryset(request)
    product = get_object_or_404(qs, pk=pk)
    return Response(ProductSerializer(product).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def category_list(request):
    sub_qs = Category.objects.filter(is_active=True).order_by("sort_order", "name")
    qs = (
        ParentCategory.objects.filter(is_active=True)
        .order_by("sort_order", "name")
        .prefetch_related(Prefetch("subcategories", queryset=sub_qs))
    )
    return Response(ParentCategorySerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def parent_category_detail(request, pk):
    sub_qs = Category.objects.filter(is_active=True).order_by("sort_order", "name")
    obj = get_object_or_404(
        ParentCategory.objects.filter(is_active=True).prefetch_related(
            Prefetch("subcategories", queryset=sub_qs)
        ),
        pk=pk,
    )
    return Response(ParentCategorySerializer(obj, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def category_detail(request, pk):
    obj = get_object_or_404(
        Category.objects.filter(is_active=True)
        .select_related("parent")
        .order_by("sort_order", "name"),
        pk=pk,
    )
    return Response(CategorySerializer(obj, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def settings_list(request):
    s = SuperSetting.objects.order_by("pk").first()
    if not s:
        s = SuperSetting.objects.create(name="My store")
    return Response(SuperSettingSerializer(s).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def settings_detail(request, pk):
    return settings_list(request)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cart_detail(request):
    cart = get_or_create_cart(request.user)
    services.recalculate_cart_totals(cart)
    cart.refresh_from_db()
    return Response(CartSerializer(cart).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cart_add_item(request):
    ser = CartItemWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    cart = get_or_create_cart(request.user)
    product = get_object_or_404(Product, pk=ser.validated_data["product_id"])
    try:
        services.upsert_cart_line(
            cart,
            product,
            ser.validated_data["quantity"],
            notes=ser.validated_data.get("notes"),
        )
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    cart.refresh_from_db()
    return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def cart_remove_item(request, item_id):
    cart = get_or_create_cart(request.user)
    CartItem.objects.filter(pk=item_id, cart=cart).delete()
    services.recalculate_cart_totals(cart)
    cart.refresh_from_db()
    return Response(CartSerializer(cart).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def checkout(request):
    ser = CheckoutSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    try:
        order = services.place_order_from_cart(
            user=request.user,
            address=ser.validated_data["address"],
            delivery_latitude=ser.validated_data.get("delivery_latitude"),
            delivery_longitude=ser.validated_data.get("delivery_longitude"),
            special_instructions=ser.validated_data.get("special_instructions"),
        )
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(
        {"order": OrderSerializer(order).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def order_list(request):
    user = request.user
    if is_delivery_boy_offline(user):
        return Response([])
    qs = order_queryset_for_user(user)
    return Response(OrderSerializer(qs, many=True).data)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def order_detail(request, pk):
    user = request.user
    if is_delivery_boy_offline(user):
        return Response(
            {"detail": "You are offline. Go online to view assigned orders."},
            status=status.HTTP_403_FORBIDDEN,
        )
    qs = order_queryset_for_user(user)
    order = get_object_or_404(qs, pk=pk)
    if request.method == "DELETE":
        if not request.user.is_staff:
            return Response(status=status.HTTP_403_FORBIDDEN)
        order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def order_transition(request, pk):
    qs = order_queryset_for_user(request.user)
    order = get_object_or_404(qs, pk=pk)
    if not can_manage_order_status(request.user, order):
        return Response(status=status.HTTP_403_FORBIDDEN)
    if is_delivery_boy_offline(request.user):
        return Response(
            {"detail": "You are offline. Go online to update orders."},
            status=status.HTTP_403_FORBIDDEN,
        )
    ser = OrderStatusUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    new_status = ser.validated_data["status"]
    reason = ser.validated_data.get("cancellation_reason")
    if (
        getattr(request.user, "is_delivery_boy", False)
        and order.delivery_boy_id == request.user.id
        and order.status
        in (Order.Status.PENDING, Order.Status.CONFIRMED)
    ):
        return Response(
            {
                "detail": "Delivery partners may update status only from Preparing onward.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    if (
        request.user.id == order.user_id
        and not request.user.is_staff
        and not getattr(request.user, "is_delivery_boy", False)
        and new_status != Order.Status.CANCELLED
    ):
        return Response(status=status.HTTP_403_FORBIDDEN)
    try:
        services.apply_order_status_change(
            order,
            new_status,
            cancellation_reason=reason,
            actor=request.user,
        )
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    order.refresh_from_db()
    return Response(OrderSerializer(order).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def order_tracking(request, pk):
    if is_delivery_boy_offline(request.user):
        return Response(
            {"detail": "You are offline. Go online to view live tracking."},
            status=status.HTTP_403_FORBIDDEN,
        )
    qs = order_queryset_for_user(request.user)
    order = get_object_or_404(qs, pk=pk)
    if not can_view_order_tracking(request.user, order):
        return Response(status=status.HTTP_403_FORBIDDEN)
    if order.status == Order.Status.OUT_FOR_DELIVERY and not order.route_polyline:
        ensure_route_for_order(order)
        order.refresh_from_db()
    return Response(build_tracking_payload(order))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def order_tracking_location(request, pk):
    qs = order_queryset_for_user(request.user)
    order = get_object_or_404(qs, pk=pk)
    if not getattr(request.user, "is_delivery_boy", False) or order.delivery_boy_id != request.user.id:
        return Response(status=status.HTTP_403_FORBIDDEN)
    if is_delivery_boy_offline(request.user):
        return Response(
            {"detail": "You are offline. Go online to share your location."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if order.status != Order.Status.OUT_FOR_DELIVERY:
        return Response(
            {"detail": "Location updates are only accepted while the order is out for delivery."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ser = OrderTrackingLocationSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    lat = ser.validated_data["latitude"]
    lng = ser.validated_data["longitude"]
    order.driver_latitude = lat
    order.driver_longitude = lng
    order.tracking_updated_at = timezone.now()
    order.save(
        update_fields=[
            "driver_latitude",
            "driver_longitude",
            "tracking_updated_at",
            "updated_at",
        ]
    )
    u = User.objects.get(pk=request.user.pk)
    u.latitude = lat
    u.longitude = lng
    u.save(update_fields=["latitude", "longitude", "updated_at"])
    payload = build_tracking_payload(order)
    broadcast_tracking_location(order.pk, payload)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_list(request):
    qs = (
        Notification.objects.filter(recipients=request.user)
        .prefetch_related(
            Prefetch(
                "notification_users",
                queryset=NotificationUser.objects.filter(user=request.user),
            )
        )
        .order_by("-created_at")[:100]
    )
    ser = NotificationSerializer(
        qs, many=True, context={"request": request}
    )
    return Response(ser.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_unread_count(request):
    n = NotificationUser.objects.filter(
        user=request.user, read_at__isnull=True
    ).count()
    return Response({"count": n})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notifications_mark_read(request):
    now = timezone.now()
    NotificationUser.objects.filter(user=request.user, read_at__isnull=True).update(
        read_at=now
    )
    return Response({"ok": True})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)
    ser = UserMeUpdateSerializer(
        request.user, data=request.data, partial=True, context={"request": request}
    )
    ser.is_valid(raise_exception=True)
    ser.save()
    request.user.refresh_from_db()
    return Response(UserSerializer(request.user).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def saved_address_list(request):
    if request.method == "GET":
        qs = CustomerAddress.objects.filter(user=request.user).order_by("-updated_at")
        return Response(CustomerAddressSerializer(qs, many=True).data)
    ser = CustomerAddressSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = CustomerAddress.objects.create(user=request.user, **ser.validated_data)
    return Response(CustomerAddressSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def saved_address_detail(request, pk):
    obj = get_object_or_404(CustomerAddress.objects.filter(user=request.user), pk=pk)
    if request.method == "GET":
        return Response(CustomerAddressSerializer(obj).data)
    if request.method == "DELETE":
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = CustomerAddressSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(CustomerAddressSerializer(obj).data)


def _non_staff_order_chat_queryset(request, order: Order):
    """Resolve queryset for GET messages (customers and delivery partners only)."""
    thread = (request.query_params.get("thread") or "").strip().lower()
    if thread == "support":
        if not can_use_support_chat_thread(request.user, order):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return OrderChatMessage.objects.filter(order=order, support=True)
    if thread == "rider_ops":
        if not can_use_rider_staff_chat_thread(request.user, order):
            return Response(
                {"detail": "Rider chat with the store is not available for this order."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return OrderChatMessage.objects.filter(order=order, support=False, rider_staff=True)
    if thread == "customer_rider":
        if not can_use_customer_rider_chat_thread(request.user, order):
            return Response(
                {"detail": "Customer–delivery partner chat is not available for this order."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return OrderChatMessage.objects.filter(
            order=order, support=False, rider_staff=False, customer_rider=True
        )
    if thread in ("delivery", ""):
        if not can_use_customer_delivery_chat_thread(request.user, order):
            return Response(
                {
                    "detail": "This chat is available only when a delivery partner is assigned to this order."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return OrderChatMessage.objects.filter(
            order=order, support=False, rider_staff=False, customer_rider=False
        )
    return Response(
        {"detail": "Invalid thread. Use support, delivery, rider_ops, or customer_rider."},
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def order_chat_messages(request, pk):
    qs = order_queryset_for_user(request.user)
    order = get_object_or_404(qs, pk=pk)
    if not can_access_order_chat_order(request.user, order):
        return Response(
            {"detail": "You do not have access to chat for this order."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if request.method == "GET":
        if request.user.is_staff:
            thread = (request.query_params.get("thread") or "").strip().lower()
            if thread not in ("", "all", "support", "delivery", "rider_ops", "customer_rider"):
                return Response(
                    {"detail": "Invalid thread. Use support, delivery, rider_ops, customer_rider, or all."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if thread in ("", "all"):
                msgs = OrderChatMessage.objects.filter(order=order)
            elif thread == "support":
                msgs = OrderChatMessage.objects.filter(order=order, support=True)
            elif thread == "rider_ops":
                msgs = OrderChatMessage.objects.filter(order=order, support=False, rider_staff=True)
            elif thread == "customer_rider":
                msgs = OrderChatMessage.objects.filter(
                    order=order, support=False, rider_staff=False, customer_rider=True
                )
            else:
                msgs = OrderChatMessage.objects.filter(
                    order=order, support=False, rider_staff=False, customer_rider=False
                )
        else:
            q = _non_staff_order_chat_queryset(request, order)
            if isinstance(q, Response):
                return q
            msgs = q
        msgs = (
            msgs.select_related("sender")
            .prefetch_related(
                Prefetch(
                    "receipts",
                    queryset=OrderChatReceipt.objects.filter(user=request.user),
                    to_attr="_my_receipts",
                )
            )
            .order_by("created_at")[:500]
        )
        return Response(
            OrderChatMessageSerializer(msgs, many=True, context={"request": request}).data
        )

    if is_delivery_boy_offline(request.user):
        return Response(
            {"detail": "You are offline. Go online to send messages."},
            status=status.HTTP_403_FORBIDDEN,
        )
    ser = OrderChatMessageWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    support = bool(ser.validated_data.get("support"))
    rider_staff_req = bool(ser.validated_data.get("rider_staff"))
    customer_rider_req = bool(ser.validated_data.get("customer_rider"))
    u = request.user
    is_rider = getattr(u, "is_delivery_boy", False) and order.delivery_boy_id == u.id
    is_customer = order.user_id == u.id

    rider_staff = False
    customer_rider = False

    if u.is_staff:
        if support:
            if not can_use_support_chat_thread(u, order):
                return Response(
                    {"detail": "Only the customer or store staff can use the support chat."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif rider_staff_req:
            rider_staff = True
            if not can_use_rider_staff_chat_thread(u, order):
                return Response(
                    {"detail": "Rider chat is not available for this order."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif customer_rider_req:
            customer_rider = True
            if not can_use_customer_rider_chat_thread(u, order):
                return Response(
                    {
                        "detail": "Customer–delivery partner chat is not available for this order."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            if not can_use_customer_delivery_chat_thread(u, order):
                return Response(
                    {"detail": "Customer delivery chat is not available for this order."},
                    status=status.HTTP_403_FORBIDDEN,
                )
    elif is_rider:
        support = False
        if customer_rider_req:
            customer_rider = True
            if not can_use_customer_rider_chat_thread(u, order):
                return Response(
                    {
                        "detail": "Customer–delivery partner chat is not available for this order."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            rider_staff = True
            if not can_use_rider_staff_chat_thread(u, order):
                return Response(
                    {"detail": "Rider chat with the store is not available for this order."},
                    status=status.HTTP_403_FORBIDDEN,
                )
    elif is_customer:
        if support:
            if not can_use_support_chat_thread(u, order):
                return Response(
                    {"detail": "Only the customer or store staff can use the support chat."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif customer_rider_req:
            support = False
            customer_rider = True
            if not can_use_customer_rider_chat_thread(u, order):
                return Response(
                    {
                        "detail": "Customer–delivery partner chat is available once a partner is assigned."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif rider_staff_req:
            return Response(
                {"detail": "You cannot post to the rider–store thread from the customer account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        else:
            support = False
            if not can_use_customer_delivery_chat_thread(u, order):
                return Response(
                    {
                        "detail": "This chat is available only when a delivery partner is assigned to this order."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
    else:
        return Response(status=status.HTTP_403_FORBIDDEN)

    try:
        data = persist_order_chat_message(
            order,
            request.user,
            ser.validated_data["body"],
            support=support,
            rider_staff=rider_staff,
            customer_rider=customer_rider,
            serializer_context={"request": request},
        )
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    broadcast_order_chat_message(
        order.pk,
        data,
        support=support,
        rider_staff=rider_staff,
        customer_rider=customer_rider,
    )
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def order_chat_receipts(request, pk):
    """Mark message(s) delivered or read (WhatsApp-style ticks)."""
    qs = order_queryset_for_user(request.user)
    order = get_object_or_404(qs, pk=pk)
    if not can_access_order_chat_order(request.user, order):
        return Response(
            {"detail": "You do not have access to chat for this order."},
            status=status.HTTP_403_FORBIDDEN,
        )
    action = (request.data.get("action") or "").strip().lower()
    if action == "delivered":
        mid = request.data.get("message_id")
        if mid is None:
            return Response({"detail": "message_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            msg = OrderChatMessage.objects.get(pk=int(mid), order=order)
        except (OrderChatMessage.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)
        if not can_user_ack_message(request.user, order, msg):
            return Response(status=status.HTTP_403_FORBIDDEN)
        updated = record_delivered(msg.id, request.user.id)
        if not updated:
            return Response({"detail": "Could not update."}, status=status.HTTP_400_BAD_REQUEST)
        fresh = OrderChatMessage.objects.select_related("sender", "order").prefetch_related(
            Prefetch(
                "receipts",
                queryset=OrderChatReceipt.objects.filter(user=request.user),
                to_attr="_my_receipts",
            )
        ).get(pk=updated.pk)
        payload = OrderChatMessageSerializer(fresh, context={"request": request}).data
        broadcast_chat_message_update(order.pk, payload)
        return Response(payload)
    if action == "read":
        ids = request.data.get("message_ids") or []
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "message_ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)
        clean: list[int] = []
        for x in ids:
            try:
                clean.append(int(x))
            except (TypeError, ValueError):
                continue
        if not clean:
            return Response({"detail": "No valid message ids."}, status=status.HTTP_400_BAD_REQUEST)
        allowed: list[int] = []
        for mid in clean:
            try:
                msg = OrderChatMessage.objects.get(pk=mid, order=order)
            except OrderChatMessage.DoesNotExist:
                continue
            if not can_user_ack_message(request.user, order, msg):
                continue
            allowed.append(mid)
        record_read(allowed, request.user.id, order_id=order.pk)
        return Response({"ok": True})
    return Response({"detail": "Invalid action. Use delivered or read."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def order_chat_participants_presence(request, pk):
    """Online / last-seen for users involved in this order chat (best-effort)."""
    qs = order_queryset_for_user(request.user)
    order = get_object_or_404(qs, pk=pk)
    if not can_access_order_chat_order(request.user, order):
        return Response(
            {"detail": "You do not have access to chat for this order."},
            status=status.HTTP_403_FORBIDDEN,
        )
    user_ids: set[int] = {order.user_id}
    if order.delivery_boy_id:
        user_ids.add(order.delivery_boy_id)
    staff_ids = list(
        User.objects.filter(is_staff=True, is_active=True).values_list("id", flat=True)[:50]
    )
    user_ids.update(staff_ids)
    now = timezone.now()
    out = []
    for u in User.objects.filter(id__in=user_ids).only(
        "id", "name", "is_delivery_boy", "is_online", "last_chat_ping_at"
    ):
        ping = u.last_chat_ping_at
        online = False
        if getattr(u, "is_delivery_boy", False):
            online = bool(u.is_online)
        if ping and (now - ping).total_seconds() < 90:
            online = True
        out.append(
            {
                "user_id": u.id,
                "name": u.name,
                "is_online": online,
                "last_chat_ping_at": ping.isoformat() if ping else None,
            }
        )
    return Response(out)
