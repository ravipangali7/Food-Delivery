"""
Domain logic for FoodDelivery (aligned with models_logic.md).
"""
from __future__ import annotations

import logging
import math
from decimal import Decimal
from datetime import datetime
from typing import Iterable

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .fcm_service import send_push_multicast
from .sms_service import infelo_sms_configured, send_notification_sms
from .models import (
    Cart,
    CartItem,
    Notification,
    NotificationUser,
    Order,
    OrderCancellationRequest,
    OrderItem,
    Product,
    SuperSetting,
    User,
)

logger = logging.getLogger(__name__)

# Mirrors web/src/lib/colors.ts validStatusTransitions
VALID_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    "pending": frozenset({"confirmed", "cancelled"}),
    "confirmed": frozenset({"preparing", "cancelled"}),
    "preparing": frozenset({"ready_for_delivery"}),
    "ready_for_delivery": frozenset({"out_for_delivery"}),
    "out_for_delivery": frozenset({"delivered", "failed"}),
    "failed": frozenset({"out_for_delivery"}),
    "delivered": frozenset(),
    "cancelled": frozenset(),
}


def is_valid_status_transition(current: str, new_status: str) -> bool:
    allowed = VALID_STATUS_TRANSITIONS.get(current, frozenset())
    return new_status in allowed


EARTH_RADIUS_KM = 6371.0


def haversine_km(
    lat1: Decimal | float, lon1: Decimal | float, lat2: Decimal | float, lon2: Decimal | float
) -> float:
    """Great-circle distance in kilometers."""
    p1, p2 = float(lat1), float(lon1)
    q1, q2 = float(lat2), float(lon2)
    r = math.radians
    dlat = r(q1 - p1)
    dlon = r(q2 - p2)
    a = math.sin(dlat / 2) ** 2 + math.cos(r(p1)) * math.cos(r(q1)) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return EARTH_RADIUS_KM * c


def get_store_settings() -> SuperSetting | None:
    return SuperSetting.objects.order_by("pk").first()


def _send_order_status_sms(order: Order, title: str, body: str) -> None:
    """Notify customer and store contact phone when Infelo SMS is configured (or DEBUG no-op)."""
    if not infelo_sms_configured() and not settings.DEBUG:
        return
    if order.user_id:
        u = User.objects.filter(pk=order.user_id).only("phone").first()
        phone = (u.phone or "").strip() if u else ""
        if phone:
            ok, err = send_notification_sms(phone=phone, title=title, body=body)
            if not ok:
                logger.warning("Order status SMS to customer failed (%s): %s", order.pk, err)
    store = get_store_settings()
    sphone = (store.phone or "").strip() if store else ""
    if sphone:
        ok, err = send_notification_sms(phone=sphone, title=title, body=body)
        if not ok:
            logger.warning("Order status SMS to store failed (%s): %s", order.pk, err)


def compute_delivery_fee(
    *,
    delivery_lat: Decimal | None,
    delivery_lon: Decimal | None,
) -> tuple[Decimal, Decimal]:
    """
    Returns (delivery_fee, distance_km).
    If store or delivery coordinates missing, distance and fee are 0.
    """
    store = get_store_settings()
    if (
        store is None
        or store.latitude is None
        or store.longitude is None
        or delivery_lat is None
        or delivery_lon is None
    ):
        return Decimal("0.00"), Decimal("0.00")
    km = Decimal(str(round(haversine_km(delivery_lat, delivery_lon, store.latitude, store.longitude), 3)))
    per = store.delivery_charge_per_km or Decimal("0.00")
    fee = (km * per).quantize(Decimal("0.01"))
    return fee, km


def recalculate_cart_totals(cart: Cart) -> None:
    """Recompute Cart.subtotal and Cart.total from lines (models_logic §6)."""
    agg = cart.items.aggregate(s=Sum("total_price"))
    sub = agg["s"] or Decimal("0.00")
    cart.subtotal = sub
    cart.total = sub
    cart.save(update_fields=["subtotal", "total", "updated_at"])


def upsert_cart_line(
    cart: Cart,
    product: Product,
    quantity: int,
    notes: str | None = None,
    *,
    is_preorder: bool = False,
) -> CartItem:
    """
    Merge line per UniqueConstraint (cart, product); prices from Product.effective_price.
    Pre-order lines (sweets only) skip live stock checks; date/time is collected at checkout.
    """
    if quantity < 1:
        raise ValueError("quantity must be at least 1")
    if product.deleted_at is not None:
        raise ValueError("Product is not available")
    if not product.is_available:
        raise ValueError("Product is not available for purchase")
    if is_preorder and not product.is_sweet:
        raise ValueError("Only sweet items can be pre-ordered")
    if not is_preorder and product.stock_quantity < quantity:
        raise ValueError("Insufficient stock")

    unit = product.effective_price
    total = (unit * quantity).quantize(Decimal("0.01"))

    item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        defaults={
            "quantity": quantity,
            "unit_price": unit,
            "total_price": total,
            "notes": notes or "",
            "is_preorder": is_preorder,
        },
    )
    if not created:
        item.quantity = quantity
        item.unit_price = unit
        item.total_price = (unit * quantity).quantize(Decimal("0.01"))
        item.is_preorder = is_preorder
        if notes is not None:
            item.notes = notes
        item.save()
    recalculate_cart_totals(cart)
    return item


def create_order_notifications(
    order: Order,
    notif_type: str,
    *,
    title: str,
    body: str,
    user_ids: Iterable[int],
    medium: str = Notification.Medium.PUSH,
) -> Notification:
    now = timezone.now()
    n = Notification.objects.create(
        type=notif_type,
        title=title,
        body=body,
        medium=medium,
        target_audience=Notification.TargetAudience.DIRECT,
        data={"order_id": order.pk, "order_number": order.order_number},
    )
    uids = list(user_ids)
    for uid in uids:
        NotificationUser.objects.update_or_create(
            notification=n,
            user_id=uid,
            defaults={
                "delivery_status": NotificationUser.DeliveryStatus.PENDING,
                "delivered_at": None,
                "error_message": "",
            },
        )

    if medium == Notification.Medium.PUSH:
        users = {u.pk: u for u in User.objects.filter(pk__in=uids).only("id", "fcm_token")}
        pairs: list[tuple[int, str]] = []
        for uid in uids:
            u = users.get(uid)
            tok = (getattr(u, "fcm_token", None) or "").strip() if u else ""
            if tok:
                pairs.append((uid, tok))
            else:
                NotificationUser.objects.filter(notification=n, user_id=uid).update(
                    delivery_status=NotificationUser.DeliveryStatus.SKIPPED,
                    error_message="No FCM token registered for this user",
                    delivered_at=now,
                )
        if pairs:
            tokens = [p[1] for p in pairs]
            results = send_push_multicast(
                tokens=tokens,
                title=title,
                body=body,
                data={
                    "notification_id": str(n.pk),
                    "type": notif_type,
                    "order_id": str(order.pk),
                },
            )
            for i, (uid, _tok) in enumerate(pairs):
                if i >= len(results):
                    break
                _t, ok, err = results[i]
                if ok:
                    NotificationUser.objects.filter(notification=n, user_id=uid).update(
                        delivery_status=NotificationUser.DeliveryStatus.SENT,
                        error_message="",
                        delivered_at=now,
                    )
                else:
                    NotificationUser.objects.filter(notification=n, user_id=uid).update(
                        delivery_status=NotificationUser.DeliveryStatus.FAILED,
                        error_message=(err or "FCM error")[:500],
                        delivered_at=now,
                    )
    elif medium == Notification.Medium.SMS:
        users = {u.pk: u for u in User.objects.filter(pk__in=uids).only("id", "phone")}
        for uid in uids:
            u = users.get(uid)
            phone = (u.phone or "").strip() if u else ""
            if not phone:
                NotificationUser.objects.filter(notification=n, user_id=uid).update(
                    delivery_status=NotificationUser.DeliveryStatus.SKIPPED,
                    error_message="No phone number",
                    delivered_at=now,
                )
                continue
            ok, err = send_notification_sms(phone=phone, title=title, body=body)
            if ok:
                NotificationUser.objects.filter(notification=n, user_id=uid).update(
                    delivery_status=NotificationUser.DeliveryStatus.SENT,
                    error_message="",
                    delivered_at=now,
                )
            else:
                NotificationUser.objects.filter(notification=n, user_id=uid).update(
                    delivery_status=NotificationUser.DeliveryStatus.FAILED,
                    error_message=(err or "SMS failed")[:500],
                    delivered_at=now,
                )
    else:
        NotificationUser.objects.filter(notification=n).update(
            delivery_status=NotificationUser.DeliveryStatus.SENT,
            delivered_at=now,
        )
    return n


def apply_order_status_change(
    order: Order,
    new_status: str,
    *,
    cancellation_reason: str | None = None,
    actor: User | None = None,
) -> Order:
    """
    Enforce transition rules; set delivered_at / cancelled_at; optional notifications.
    """
    if not is_valid_status_transition(order.status, new_status):
        raise ValueError(f"Cannot transition from {order.status} to {new_status}")

    old = order.status
    order.status = new_status
    now = timezone.now()
    fields = ["status", "updated_at"]

    if new_status == Order.Status.DELIVERED:
        order.delivered_at = now
        fields.append("delivered_at")
        if order.payment_method == Order.PaymentMethod.CASH_ON_DELIVERY:
            order.payment_status = Order.PaymentStatus.PAID
            fields.append("payment_status")
    if new_status == Order.Status.CANCELLED:
        order.cancelled_at = now
        fields.append("cancelled_at")
        if cancellation_reason:
            order.cancellation_reason = cancellation_reason
            fields.append("cancellation_reason")

    order.save(update_fields=fields)

    if new_status == Order.Status.OUT_FOR_DELIVERY and old != new_status:
        from .tracking import ensure_route_for_order

        ensure_route_for_order(order)

    # Notifications for meaningful transitions
    customer_id = order.user_id
    targets = [customer_id]
    if new_status == Order.Status.CONFIRMED and old != new_status:
        title, body = "Order confirmed", f"Your order {order.order_number} has been confirmed."
        create_order_notifications(
            order,
            Notification.Type.ORDER_CONFIRMED,
            title=title,
            body=body,
            user_ids=targets,
        )
        _send_order_status_sms(order, title, body)
    elif new_status == Order.Status.OUT_FOR_DELIVERY and old != new_status:
        title, body = "On the way", f"Your order {order.order_number} is out for delivery."
        create_order_notifications(
            order,
            Notification.Type.OUT_FOR_DELIVERY,
            title=title,
            body=body,
            user_ids=targets,
        )
        _send_order_status_sms(order, title, body)
    elif new_status == Order.Status.DELIVERED and old != new_status:
        title, body = "Delivered", f"Your order {order.order_number} has been delivered."
        create_order_notifications(
            order,
            Notification.Type.DELIVERED,
            title=title,
            body=body,
            user_ids=targets,
        )
        _send_order_status_sms(order, title, body)
    elif new_status == Order.Status.CANCELLED and old != new_status:
        title, body = "Order cancelled", f"Your order {order.order_number} has been cancelled."
        create_order_notifications(
            order,
            Notification.Type.CANCELLED,
            title=title,
            body=body,
            user_ids=targets,
        )
        _send_order_status_sms(order, title, body)
    _ = actor
    return order


def submit_order_cancellation_request(*, order: Order, user: User, reason: str) -> OrderCancellationRequest:
    """
    Customer asks to cancel; order is unchanged until a superuser approves.
    Only the owning customer may submit, while the order is still pending.
    """
    text = (reason or "").strip()
    if len(text) < 3:
        raise ValueError("Please enter a cancellation reason (at least 3 characters).")
    if order.user_id != user.id:
        raise ValueError("You cannot cancel this order.")
    if order.status != Order.Status.PENDING:
        raise ValueError("Cancellation can only be requested while the order is pending.")
    if OrderCancellationRequest.objects.filter(
        order=order, status=OrderCancellationRequest.Status.PENDING
    ).exists():
        raise ValueError("A cancellation request is already waiting for review.")
    return OrderCancellationRequest.objects.create(
        order=order,
        requested_by=user,
        reason=text[:2000],
        status=OrderCancellationRequest.Status.PENDING,
    )


@transaction.atomic
def review_order_cancellation_request(
    *,
    req: OrderCancellationRequest,
    reviewer: User,
    approve: bool,
) -> OrderCancellationRequest:
    """Superuser only (caller must enforce). Approving cancels the order and stores the customer's reason."""
    if not reviewer.is_superuser:
        raise ValueError("Only a super admin can review cancellation requests.")
    if req.status != OrderCancellationRequest.Status.PENDING:
        raise ValueError("This request has already been reviewed.")
    now = timezone.now()
    if approve:
        order = Order.objects.select_for_update().get(pk=req.order_id)
        if order.status != Order.Status.PENDING:
            raise ValueError("The order is no longer pending; it cannot be cancelled this way.")
        reason_for_order = req.reason[:255]
        apply_order_status_change(
            order,
            Order.Status.CANCELLED,
            cancellation_reason=reason_for_order,
            actor=reviewer,
        )
        req.status = OrderCancellationRequest.Status.APPROVED
    else:
        req.status = OrderCancellationRequest.Status.REJECTED
    req.reviewed_by = reviewer
    req.reviewed_at = now
    req.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    return req


@transaction.atomic
def place_order_from_cart(
    *,
    user: User,
    address: str,
    delivery_latitude: Decimal | None = None,
    delivery_longitude: Decimal | None = None,
    special_instructions: str | None = None,
    pre_order_date_time: datetime | None = None,
) -> Order:
    """
    Create Order + OrderItems from user's cart; clear cart; notification.
    """
    cart = Cart.objects.select_for_update().filter(user=user).first()
    if cart is None or not cart.items.exists():
        raise ValueError("Cart is empty")

    items = list(cart.items.select_related("product").select_for_update())
    has_preorder = any(ci.is_preorder for ci in items)
    if has_preorder:
        if pre_order_date_time is None:
            raise ValueError("Choose a date and time for your pre-order.")
        if pre_order_date_time <= timezone.now():
            raise ValueError("Pre-order date and time must be in the future.")
    else:
        pre_order_date_time = None

    subtotal = Decimal("0.00")
    line_snapshots: list[tuple[Product, int, Decimal, str, bool]] = []

    for ci in items:
        p = ci.product
        if p.deleted_at is not None or not p.is_available:
            raise ValueError(f"Product '{p.name}' is not available")
        if ci.is_preorder and not p.is_sweet:
            raise ValueError(f"Product '{p.name}' cannot be on a pre-order line")
        if not ci.is_preorder and p.stock_quantity < ci.quantity:
            raise ValueError(f"Insufficient stock for '{p.name}'")
        unit = p.effective_price
        line_total = (unit * ci.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        line_snapshots.append((p, ci.quantity, unit, ci.notes or "", ci.is_preorder))

    delivery_fee, _ = compute_delivery_fee(
        delivery_lat=delivery_latitude,
        delivery_lon=delivery_longitude,
    )
    platform_fee_amount = Decimal("0.00")
    total_amount = (subtotal + delivery_fee + platform_fee_amount).quantize(Decimal("0.01"))

    order = Order(
        user=user,
        status=Order.Status.PENDING,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        platform_fee_amount=platform_fee_amount,
        total_amount=total_amount,
        address=address,
        delivery_latitude=delivery_latitude,
        delivery_longitude=delivery_longitude,
        special_instructions=special_instructions or "",
        payment_method=Order.PaymentMethod.CASH_ON_DELIVERY,
        payment_status=Order.PaymentStatus.PENDING,
        is_preorder=has_preorder,
        pre_order_date_time=pre_order_date_time,
    )
    order.save()

    for p, qty, unit, notes, line_is_preorder in line_snapshots:
        OrderItem.objects.create(
            order=order,
            product=p,
            unit_price=unit,
            quantity=qty,
            total_price=(unit * qty).quantize(Decimal("0.01")),
            notes=notes or None,
        )
        if not line_is_preorder:
            Product.objects.filter(pk=p.pk).update(stock_quantity=p.stock_quantity - qty)

    cart.items.all().delete()
    recalculate_cart_totals(cart)

    create_order_notifications(
        order,
        Notification.Type.ORDER_PLACED,
        title="Order placed",
        body=f"Your order {order.order_number} has been received.",
        user_ids=[user.pk],
    )

    return order
