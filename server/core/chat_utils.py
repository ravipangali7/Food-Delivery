"""Order chat: receipts, aggregate status, and optional offline notification hooks."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from .models import Order, OrderChatMessage, OrderChatReceipt, User

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def refresh_message_aggregate_status(message: OrderChatMessage) -> None:
    """Recompute aggregate_status from receipts (non-sender)."""
    qs = message.receipts.exclude(user_id=message.sender_id)
    has_delivered = qs.filter(delivered_at__isnull=False).exists()
    has_read = qs.filter(read_at__isnull=False).exists()
    if has_read:
        new_status = OrderChatMessage.AggregateStatus.SEEN
    elif has_delivered:
        new_status = OrderChatMessage.AggregateStatus.DELIVERED
    else:
        new_status = OrderChatMessage.AggregateStatus.SENT
    if message.aggregate_status != new_status:
        message.aggregate_status = new_status
        message.save(update_fields=["aggregate_status"])


@transaction.atomic
def record_delivered(message_id: int, user_id: int) -> OrderChatMessage | None:
    if user_id <= 0:
        return None
    try:
        msg = OrderChatMessage.objects.select_related("order", "sender").get(pk=message_id)
    except OrderChatMessage.DoesNotExist:
        return None
    if msg.sender_id == user_id:
        return msg
    rec, _ = OrderChatReceipt.objects.get_or_create(message=msg, user_id=user_id)
    if rec.delivered_at is None:
        rec.delivered_at = timezone.now()
        rec.save(update_fields=["delivered_at"])
    refresh_message_aggregate_status(msg)
    msg.refresh_from_db(fields=["aggregate_status"])
    return msg


@transaction.atomic
def record_read(
    message_ids: list[int], user_id: int, *, order_id: int | None = None
) -> None:
    if not message_ids or user_id <= 0:
        return
    now = timezone.now()
    for mid in message_ids:
        try:
            msg = OrderChatMessage.objects.select_related("sender").get(pk=mid)
        except OrderChatMessage.DoesNotExist:
            continue
        if order_id is not None and msg.order_id != order_id:
            continue
        if msg.sender_id == user_id:
            continue
        rec, _ = OrderChatReceipt.objects.get_or_create(message=msg, user_id=user_id)
        changed = False
        if rec.delivered_at is None:
            rec.delivered_at = now
            changed = True
        if rec.read_at is None:
            rec.read_at = now
            changed = True
        if changed:
            rec.save(update_fields=["delivered_at", "read_at"])
        refresh_message_aggregate_status(msg)


def can_user_ack_message(user: User, order: Order, msg: OrderChatMessage) -> bool:
    """Non-sender may ack delivered/read if they participate in this thread."""
    if msg.order_id != order.id:
        return False
    if msg.sender_id == user.id:
        return False
    if user.is_staff:
        return True
    if msg.support:
        return order.user_id == user.id
    if getattr(msg, "rider_staff", False):
        return getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id
    if getattr(msg, "customer_rider", False):
        return order.user_id == user.id or (
            getattr(user, "is_delivery_boy", False) and order.delivery_boy_id == user.id
        )
    return order.user_id == user.id


def maybe_stub_offline_notification(order: Order, message: OrderChatMessage) -> None:
    """
    Optional SMS/email when recipient may be offline (hook for Celery / providers).
    Controlled by env CHAT_OFFLINE_NOTIFY=1 — logs only by default.
    """
    from django.conf import settings

    if not getattr(settings, "CHAT_OFFLINE_NOTIFY", False):
        return
    logger.info(
        "chat offline notify stub: order=%s msg=%s support=%s",
        order.pk,
        message.pk,
        message.support,
    )


def touch_presence(user_id: int) -> None:
    User.objects.filter(pk=user_id).update(last_chat_ping_at=timezone.now())
