"""
व्यापारिक तर्क — अर्डर, कार्ट, सूचना, र डेलिभरी (models_logic.md संग मिल्दो)।
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
    ProductVariant,
    SuperSetting,
    User,
)

logger = logging.getLogger(__name__)

# अर्डर स्थिति परिवर्तन — अनुमतित स्थिति मात्र अर्कोमा जान सक्छ (web colors.ts संग मिल्दो)।
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
    """किलोमिटरमा great-circle दूरी।"""
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
    """Infelo SMS कन्फिगर भएमा (वा DEBUG मा no-op) ग्राहक र store सम्पर्क फोनलाई सूचित गर्नुहोस्।"""
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


def delivery_distance_km(
    *,
    delivery_lat: Decimal | None,
    delivery_lon: Decimal | None,
) -> Decimal:
    """store देखि delivery pin सम्म great-circle दूरी (km); coordinate नभए 0।"""
    store = get_store_settings()
    if (
        store is None
        or store.latitude is None
        or store.longitude is None
        or delivery_lat is None
        or delivery_lon is None
    ):
        return Decimal("0.000")
    return Decimal(
        str(round(haversine_km(delivery_lat, delivery_lon, store.latitude, store.longitude), 3))
    )


def compute_delivery_fee(
    *,
    delivery_lat: Decimal | None,
    delivery_lon: Decimal | None,
) -> tuple[Decimal, Decimal]:
    """
    (delivery_fee, distance_km) फर्काउँछ।
    Fee = distance_km × delivery_charge_per_km (NPR)।
    store वा delivery coordinate नभए distance र fee 0।
    """
    km = delivery_distance_km(delivery_lat=delivery_lat, delivery_lon=delivery_lon)
    if km <= 0:
        return Decimal("0.00"), km
    store = get_store_settings()
    per = (store.delivery_charge_per_km if store else None) or Decimal("0.00")
    fee = (km * per).quantize(Decimal("0.01"))
    return fee, km


def validate_delivery_radius(
    *,
    delivery_lat: Decimal | None,
    delivery_lon: Decimal | None,
) -> None:
    """delivery pin store को छोटो delivery radius भन्दा बाहिर भए checkout अस्वीकार गर्नुहोस्।"""
    store = get_store_settings()
    max_km = (store.delivery_under_km if store else None) or Decimal("0.00")
    if max_km <= 0:
        return
    if (
        store is None
        or store.latitude is None
        or store.longitude is None
        or delivery_lat is None
        or delivery_lon is None
    ):
        return
    km = delivery_distance_km(delivery_lat=delivery_lat, delivery_lon=delivery_lon)
    if km > max_km:
        raise ValueError("You are out of delivery radius")


def recalculate_cart_totals(cart: Cart) -> None:
    """line बाट Cart.subtotal र Cart.total पुन: गणना गर्नुहोस् (models_logic §6)।"""
    agg = cart.items.aggregate(s=Sum("total_price"))
    sub = agg["s"] or Decimal("0.00")
    cart.subtotal = sub
    cart.total = sub
    cart.save(update_fields=["subtotal", "total", "updated_at"])


def resolve_product_variant(
    product: Product,
    variant_id: int | None,
) -> ProductVariant | None:
    if variant_id is None:
        if product.has_variants:
            sole = (
                product.variants.filter(is_available=True)
                .select_related("unit")
                .order_by("sort_order", "id")
            )
            if sole.count() == 1:
                return sole.first()
            raise ValueError("Please select a variant")
        return None
    variant = (
        ProductVariant.objects.filter(pk=variant_id, product_id=product.pk, is_available=True)
        .select_related("unit")
        .first()
    )
    if variant is None:
        raise ValueError("Selected variant is not available")
    return variant


def line_unit_price(product: Product, variant: ProductVariant | None) -> Decimal:
    if variant is not None:
        return variant.effective_price
    return product.effective_price


def line_stock_quantity(product: Product, variant: ProductVariant | None) -> int:
    if variant is not None:
        return variant.stock_quantity
    return product.stock_quantity


def deduct_line_stock(product: Product, variant: ProductVariant | None, quantity: int) -> None:
    if variant is not None:
        ProductVariant.objects.filter(pk=variant.pk).update(
            stock_quantity=variant.stock_quantity - quantity
        )
        return
    Product.objects.filter(pk=product.pk).update(stock_quantity=product.stock_quantity - quantity)


def upsert_cart_line(
    cart: Cart,
    product: Product,
    quantity: int,
    notes: str | None = None,
    *,
    is_preorder: bool = False,
    variant: ProductVariant | None = None,
) -> CartItem:
    """
    UniqueConstraint (cart, product, variant, is_preorder) अनुसार line मर्ज;
    मूल्य चयनित variant वा product default बाट।
    """
    if quantity < 1:
        raise ValueError("quantity must be at least 1")
    if product.deleted_at is not None:
        raise ValueError("Product is not available")
    if not product.is_available:
        raise ValueError("Product is not available for purchase")
    if is_preorder and not product.is_sweet:
        raise ValueError("Only sweet items can be pre-ordered")
    if product.has_variants and variant is None:
        raise ValueError("Please select a variant")
    if variant is not None and variant.product_id != product.pk:
        raise ValueError("Selected variant does not belong to this product")
    if not is_preorder and line_stock_quantity(product, variant) < quantity:
        raise ValueError("Insufficient stock")

    unit = line_unit_price(product, variant)
    total = (unit * quantity).quantize(Decimal("0.01"))

    item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        variant=variant,
        is_preorder=is_preorder,
        defaults={
            "quantity": quantity,
            "unit_price": unit,
            "total_price": total,
            "notes": notes or "",
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
    transition नियम लागू; delivered_at / cancelled_at सेट; वैकल्पिक notification।
    """
    if order.status == new_status:
        return order
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

    # अर्थपूर्ण transition का लागि notification
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
    ग्राहकले रद्द गर्न अनुरोध; superuser ले स्वीकृत नगरेसम्म order अपरिवर्तित।
    मालिक ग्राहक मात्र, order अझै pending हुँदा।
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
    """superuser मात्र (caller ले enforce गर्नुपर्छ)। स्वीकृत गर्दा order रद्द र ग्राहकको कारण सुरक्षित।"""
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


def _new_guest_access_token() -> str:
    import secrets

    return secrets.token_urlsafe(32)


def _validate_preorder_schedule(
    line_snapshots: list[tuple[Product, ProductVariant | None, int, Decimal, str, bool]],
    pre_order_date_time: datetime | None,
) -> datetime | None:
    has_preorder = any(line_is_preorder for *_rest, line_is_preorder in line_snapshots)
    if has_preorder:
        if pre_order_date_time is None:
            raise ValueError("Choose a date and time for your pre-order.")
        if pre_order_date_time <= timezone.now():
            raise ValueError("Pre-order date and time must be in the future.")
        return pre_order_date_time
    return None


def _line_snapshots_from_cart_items(
    items: list,
) -> tuple[Decimal, list[tuple[Product, ProductVariant | None, int, Decimal, str, bool]]]:
    subtotal = Decimal("0.00")
    line_snapshots: list[tuple[Product, ProductVariant | None, int, Decimal, str, bool]] = []
    for ci in items:
        p = ci.product
        variant = getattr(ci, "variant", None)
        if p.deleted_at is not None or not p.is_available:
            raise ValueError(f"Product '{p.name}' is not available")
        if ci.is_preorder and not p.is_sweet:
            raise ValueError(f"Product '{p.name}' cannot be on a pre-order line")
        if not ci.is_preorder and line_stock_quantity(p, variant) < ci.quantity:
            raise ValueError(f"Insufficient stock for '{p.name}'")
        unit = line_unit_price(p, variant)
        line_total = (unit * ci.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        line_snapshots.append((p, variant, ci.quantity, unit, ci.notes or "", ci.is_preorder))
    return subtotal, line_snapshots


def _line_snapshots_from_guest_lines(
    guest_lines: list[dict],
) -> tuple[Decimal, list[tuple[Product, ProductVariant | None, int, Decimal, str, bool]]]:
    subtotal = Decimal("0.00")
    line_snapshots: list[tuple[Product, ProductVariant | None, int, Decimal, str, bool]] = []
    for row in guest_lines:
        p = Product.objects.filter(pk=row["product_id"]).first()
        if p is None or p.deleted_at is not None or not p.is_available:
            raise ValueError("One or more products are not available")
        variant = resolve_product_variant(p, row.get("variant_id"))
        qty = row["quantity"]
        is_preorder = bool(row.get("is_preorder"))
        if is_preorder and not p.is_sweet:
            raise ValueError(f"Product '{p.name}' cannot be on a pre-order line")
        if not is_preorder and line_stock_quantity(p, variant) < qty:
            raise ValueError(f"Insufficient stock for '{p.name}'")
        unit = line_unit_price(p, variant)
        line_total = (unit * qty).quantize(Decimal("0.01"))
        subtotal += line_total
        line_snapshots.append((p, variant, qty, unit, row.get("notes") or "", is_preorder))
    return subtotal, line_snapshots


@transaction.atomic
def place_order_from_lines(
    *,
    user: User | None,
    line_snapshots: list[tuple[Product, ProductVariant | None, int, Decimal, str, bool]],
    address: str,
    delivery_latitude: Decimal | None = None,
    delivery_longitude: Decimal | None = None,
    special_instructions: str | None = None,
    pre_order_date_time: datetime | None = None,
    guest_name: str | None = None,
    guest_phone: str | None = None,
) -> Order:
    """प्रमाणित line snapshot बाट Order + OrderItems सिर्जना।"""
    if not line_snapshots:
        raise ValueError("Cart is empty")

    validate_delivery_radius(
        delivery_lat=delivery_latitude,
        delivery_lon=delivery_longitude,
    )

    pre_order_date_time = _validate_preorder_schedule(line_snapshots, pre_order_date_time)
    subtotal = sum(
        (unit * qty).quantize(Decimal("0.01"))
        for _p, _variant, qty, unit, _notes, _pre in line_snapshots
    )
    has_preorder = pre_order_date_time is not None

    delivery_fee, _ = compute_delivery_fee(
        delivery_lat=delivery_latitude,
        delivery_lon=delivery_longitude,
    )
    platform_fee_amount = Decimal("0.00")
    total_amount = (subtotal + delivery_fee + platform_fee_amount).quantize(Decimal("0.01"))

    order = Order(
        user=user,
        guest_access_token=_new_guest_access_token() if user is None else None,
        guest_name=(guest_name or "").strip() if user is None else "",
        guest_phone=(guest_phone or "").strip() if user is None else "",
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

    for p, variant, qty, unit, notes, line_is_preorder in line_snapshots:
        OrderItem.objects.create(
            order=order,
            product=p,
            variant=variant,
            unit_price=unit,
            quantity=qty,
            total_price=(unit * qty).quantize(Decimal("0.01")),
            notes=notes or None,
        )
        if not line_is_preorder:
            deduct_line_stock(p, variant, qty)

    if user is not None:
        create_order_notifications(
            order,
            Notification.Type.ORDER_PLACED,
            title="Order placed",
            body=f"Your order {order.order_number} has been received.",
            user_ids=[user.pk],
        )

    return order


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
    प्रयोगकर्ताको cart बाट Order + OrderItems; cart खाली; notification।
    """
    cart = Cart.objects.select_for_update().filter(user=user).first()
    if cart is None or not cart.items.exists():
        raise ValueError("Cart is empty")

    items = list(cart.items.select_related("product", "variant").select_for_update())
    _subtotal, line_snapshots = _line_snapshots_from_cart_items(items)
    order = place_order_from_lines(
        user=user,
        line_snapshots=line_snapshots,
        address=address,
        delivery_latitude=delivery_latitude,
        delivery_longitude=delivery_longitude,
        special_instructions=special_instructions,
        pre_order_date_time=pre_order_date_time,
    )
    cart.items.all().delete()
    recalculate_cart_totals(cart)
    return order


@transaction.atomic
def place_guest_order(
    *,
    guest_lines: list[dict],
    address: str,
    delivery_latitude: Decimal | None = None,
    delivery_longitude: Decimal | None = None,
    special_instructions: str | None = None,
    pre_order_date_time: datetime | None = None,
    guest_name: str | None = None,
    guest_phone: str | None = None,
) -> Order:
    """लगइन गरेको ग्राहक खाता बिना order राख्नुहोस्।"""
    if not guest_lines:
        raise ValueError("Cart is empty")
    _subtotal, line_snapshots = _line_snapshots_from_guest_lines(guest_lines)
    return place_order_from_lines(
        user=None,
        line_snapshots=line_snapshots,
        address=address,
        delivery_latitude=delivery_latitude,
        delivery_longitude=delivery_longitude,
        special_instructions=special_instructions,
        pre_order_date_time=pre_order_date_time,
        guest_name=guest_name,
        guest_phone=guest_phone,
    )
