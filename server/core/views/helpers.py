"""Shared helpers and permission classes for API views."""

from types import SimpleNamespace

from django.contrib.auth import get_user_model

from rest_framework.permissions import IsAuthenticated

from ..models import Cart, Order, OrderCancellationRequest, OrderChatMessage
from ..chat_utils import maybe_stub_offline_notification

User = get_user_model()


def get_or_create_cart(user) -> Cart:
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def is_delivery_boy_offline(user) -> bool:
    """True when the user is a delivery partner and has marked themselves offline."""
    if not getattr(user, "is_delivery_boy", False):
        return False
    online = User.objects.filter(pk=user.pk).values_list("is_online", flat=True).first()
    return online is False


def can_manage_order_status(user, order) -> bool:
    if user.is_staff:
        return True
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_submit_order_cancellation_request(user, order) -> bool:
    """Customer-owned order still pending; actual cancel goes through superuser approval."""
    return user.id == order.user_id and order.status == Order.Status.PENDING


class IsSuperuser(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and bool(
            request.user and getattr(request.user, "is_superuser", False)
        )


class IsStaffUser(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and bool(
            request.user and request.user.is_staff
        )


def can_view_order_tracking(user, order) -> bool:
    """Customer, assigned delivery partner, or staff may view live tracking."""
    if user.is_staff:
        return True
    if order.user_id == user.id:
        return True
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_access_order_chat_order(user, order) -> bool:
    """User may call order chat HTTP/WS for this order (any thread)."""
    if user.is_staff:
        return True
    if order.user_id == user.id:
        return True
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_chat_on_order(user, order) -> bool:
    """Legacy: delivery-thread access (customer or rider once assigned). Kept for WS imports."""
    return can_use_delivery_chat_thread(user, order)


def can_use_support_chat_thread(user, order) -> bool:
    """Support messages: customer who owns the order, or staff. Not delivery partners."""
    if user.is_staff:
        return True
    if order.user_id == user.id:
        return True
    return False


def can_use_customer_delivery_chat_thread(user, order) -> bool:
    """Customer ↔ staff coordination on the non-support thread (no delivery partner)."""
    if user.is_staff:
        return True
    if order.delivery_boy_id is None:
        return False
    if order.user_id == user.id:
        return True
    return False


def can_use_rider_staff_chat_thread(user, order) -> bool:
    """Rider ↔ restaurant/admin only; assigned rider or staff."""
    if user.is_staff:
        return True
    if order.delivery_boy_id is None:
        return False
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_use_customer_rider_chat_thread(user, order) -> bool:
    """Private customer ↔ assigned delivery partner (+ staff). Requires an assigned rider."""
    if order.delivery_boy_id is None:
        return False
    if user.is_staff:
        return True
    if order.user_id == user.id:
        return True
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_use_delivery_chat_thread(user, order) -> bool:
    """Either customer-delivery or rider-ops thread (used for legacy WS imports)."""
    return can_use_customer_delivery_chat_thread(user, order) or can_use_rider_staff_chat_thread(
        user, order
    )


def _serializer_context_for_chat(serializer_context: dict | None) -> dict:
    if not serializer_context:
        return {}
    if "request" in serializer_context:
        return serializer_context
    u = serializer_context.get("user")
    if u is not None:
        return {**serializer_context, "request": SimpleNamespace(user=u)}
    return serializer_context


def persist_order_chat_message(
    order: Order,
    sender,
    body: str,
    *,
    support: bool = False,
    rider_staff: bool = False,
    customer_rider: bool = False,
    serializer_context: dict | None = None,
) -> dict:
    """Create a chat row and return serialized payload for HTTP + WebSocket broadcast."""
    from ..serializers import OrderChatMessageSerializer

    text = (body or "").strip()[:2000]
    if not text:
        raise ValueError("Message body is empty")
    if support:
        rider_staff = False
        customer_rider = False
    elif rider_staff:
        customer_rider = False
    elif customer_rider:
        support = False
        rider_staff = False
    msg = OrderChatMessage.objects.create(
        order=order,
        sender=sender,
        body=text,
        support=support,
        rider_staff=rider_staff,
        customer_rider=customer_rider,
    )
    msg = OrderChatMessage.objects.select_related(
        "sender", "order", "order__user", "order__delivery_boy"
    ).get(pk=msg.pk)
    ctx = _serializer_context_for_chat(serializer_context)
    data = OrderChatMessageSerializer(msg, context=ctx).data
    maybe_stub_offline_notification(order, msg)
    from ..chat_sms import maybe_send_staff_chat_reply_sms

    maybe_send_staff_chat_reply_sms(msg.order, msg, sender)
    return data


def order_queryset_for_user(user):
    from django.db.models import Prefetch

    pending_cancel = OrderCancellationRequest.objects.filter(
        status=OrderCancellationRequest.Status.PENDING
    )
    qs = (
        Order.objects.all()
        .select_related("user", "delivery_boy")
        .prefetch_related(
            "items__product__images",
            Prefetch(
                "cancellation_requests",
                queryset=pending_cancel,
                to_attr="_prefetched_pending_cancellations",
            ),
        )
        .order_by("-created_at")
    )
    if user.is_staff:
        return qs
    if getattr(user, "is_delivery_boy", False):
        return qs.filter(delivery_boy_id=user.id)
    return qs.filter(user=user)
