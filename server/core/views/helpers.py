"""API view का साझा helper र permission class।"""

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
    """प्रयोगकर्ता delivery partner हो र offline चिन्ह लगाएको छ भने True।"""
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
    """ग्राहकको order अझै pending; वास्तविक रद्द superuser स्वीकृतिबाट।"""
    if order.user_id is None:
        return False
    return user.id == order.user_id and order.status == Order.Status.PENDING


def guest_token_matches_order(order: Order, token: str | None) -> bool:
    if order.user_id is not None or not order.guest_access_token:
        return False
    return bool(token) and token == order.guest_access_token


def resolve_order_for_request(request, pk: int) -> Order | None:
    """request ले पढ्न मिल्छ भने order फर्काउनुहोस् (auth user, staff, वा guest token)।"""
    from django.shortcuts import get_object_or_404

    order = get_object_or_404(
        Order.objects.select_related("user", "delivery_boy").prefetch_related("items__product__images"),
        pk=pk,
    )
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        if user.is_staff:
            return order
        if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
            return order
        if order.user_id == user.id:
            return order
    token = request.query_params.get("guest_token") or request.headers.get("X-Guest-Order-Token")
    if guest_token_matches_order(order, token):
        return order
    return None


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


def can_view_order_tracking(user, order, *, guest_token: str | None = None) -> bool:
    """ग्राहक, तोकिएको delivery partner, staff, वा guest token धारक tracking हेर्न सक्छ।"""
    if guest_token_matches_order(order, guest_token):
        return True
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff:
        return True
    if order.user_id and order.user_id == user.id:
        return True
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_access_order_chat_order(user, order) -> bool:
    """प्रयोगकर्ताले यो order का लागि order chat HTTP/WS कल गर्न सक्छ (कुनै पनि thread)।"""
    if user.is_staff:
        return True
    if order.user_id == user.id:
        return True
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_chat_on_order(user, order) -> bool:
    """Legacy: delivery-thread पहुँच (ग्राहक वा rider तोकिएपछि)। WS import का लागि राखिएको।"""
    return can_use_delivery_chat_thread(user, order)


def can_use_support_chat_thread(user, order) -> bool:
    """support सन्देश: order मालिक ग्राहक वा staff। delivery partner होइन।"""
    if user.is_staff:
        return True
    if order.user_id == user.id:
        return True
    return False


def can_use_customer_delivery_chat_thread(user, order) -> bool:
    """ग्राहक ↔ staff coordination non-support thread मा (delivery partner बिना)।"""
    if user.is_staff:
        return True
    if order.delivery_boy_id is None:
        return False
    if order.user_id == user.id:
        return True
    return False


def can_use_rider_staff_chat_thread(user, order) -> bool:
    """rider ↔ restaurant/admin मात्र; तोकिएको rider वा staff।"""
    if user.is_staff:
        return True
    if order.delivery_boy_id is None:
        return False
    if getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id:
        return True
    return False


def can_use_customer_rider_chat_thread(user, order) -> bool:
    """निजी ग्राहक ↔ तोकिएको delivery partner (+ staff)। तोकिएको rider आवश्यक।"""
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
    """customer-delivery वा rider-ops thread (legacy WS import का लागि)।"""
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
    """chat row सिर्जना गरी HTTP + WebSocket broadcast का लागि serialized payload फर्काउनुहोस्।"""
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

    from ..startup import order_items_prefetch_queryset, order_queryset_compat

    pending_cancel = OrderCancellationRequest.objects.filter(
        status=OrderCancellationRequest.Status.PENDING
    )
    qs = (
        Order.objects.all()
        .select_related("user", "delivery_boy")
        .prefetch_related(
            Prefetch("items", queryset=order_items_prefetch_queryset()),
            Prefetch(
                "cancellation_requests",
                queryset=pending_cancel,
                to_attr="_prefetched_pending_cancellations",
            ),
        )
        .order_by("-created_at")
    )
    if user.is_staff:
        return order_queryset_compat(qs)
    if getattr(user, "is_delivery_boy", False):
        return order_queryset_compat(qs.filter(delivery_boy_id=user.id))
    return order_queryset_compat(qs.filter(user=user))
