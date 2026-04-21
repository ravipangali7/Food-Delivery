"""Order live tracking: Google Directions polyline, ETA, and WebSocket broadcast."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.utils import timezone

from .models import Order
from .services import get_store_settings, haversine_km

# Urban averages when only straight-line distance is known (fallback route)
DEFAULT_ETA_SPEED_KMH = 30.0
BIKE_ETA_SPEED_KMH = 18.0
WALK_ETA_SPEED_KMH = 5.0


def _directions_mode_for_order(order: Order) -> str:
    if order.delivery_type == Order.DeliveryType.WALKING:
        return "walking"
    if order.delivery_type == Order.DeliveryType.BIKE:
        return "bicycling"
    return "driving"


def _fallback_speed_kmh_for_order(order: Order) -> float:
    if order.delivery_type == Order.DeliveryType.WALKING:
        return WALK_ETA_SPEED_KMH
    if order.delivery_type == Order.DeliveryType.BIKE:
        return BIKE_ETA_SPEED_KMH
    return DEFAULT_ETA_SPEED_KMH


def _eta_speed_kmh_for_order(order: Order) -> float:
    """Speed for remaining-distance ETA along the last leg."""
    return _fallback_speed_kmh_for_order(order)


def _encode_signed(num: int) -> str:
    sgn_num = num << 1
    if num < 0:
        sgn_num = ~sgn_num
    chunks: list[str] = []
    num = sgn_num
    while num >= 0x20:
        chunks.append(chr((0x20 | (num & 0x1F)) + 63))
        num >>= 5
    chunks.append(chr(num + 63))
    return "".join(chunks)


def encode_polyline(latlng_pairs: list[tuple[float, float]]) -> str:
    """Google Encoded Polyline Algorithm Format."""
    if not latlng_pairs:
        return ""
    result: list[str] = []
    prev_lat = 0
    prev_lng = 0
    for lat, lng in latlng_pairs:
        ilat = int(round(lat * 1e5))
        ilng = int(round(lng * 1e5))
        dlat = ilat - prev_lat
        dlng = ilng - prev_lng
        prev_lat, prev_lng = ilat, ilng
        result.append(_encode_signed(dlat))
        result.append(_encode_signed(dlng))
    return "".join(result)


def haversine_meters(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    return haversine_km(lat1, lon1, lat2, lon2) * 1000.0


def _directions_via_google(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    *,
    mode: str = "driving",
) -> tuple[str | None, int | None, int | None]:
    key = (getattr(settings, "GOOGLE_MAPS_API_KEY", None) or "").strip()
    if not key:
        return None, None, None
    params = urllib.parse.urlencode(
        {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "mode": mode,
            "key": key,
        }
    )
    url = f"https://maps.googleapis.com/maps/api/directions/json?{params}"
    try:
        with urllib.request.urlopen(url, timeout=12) as resp:
            raw = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None, None, None
    routes = raw.get("routes") or []
    if not routes:
        return None, None, None
    leg = (routes[0].get("legs") or [{}])[0]
    poly = routes[0].get("overview_polyline") or {}
    enc = poly.get("points")
    dist = leg.get("distance", {}).get("value")
    dur = leg.get("duration", {}).get("value")
    return enc, dist, dur


def ensure_route_for_order(order: Order) -> None:
    """
    Compute and store driving route (Google Directions) or straight-line fallback.
    Call when order moves to out_for_delivery or when tracking is first requested.
    """
    store = get_store_settings()
    if store is None or store.latitude is None or store.longitude is None:
        return
    if order.delivery_latitude is None or order.delivery_longitude is None:
        return

    o_lat, o_lng = float(store.latitude), float(store.longitude)
    d_lat, d_lng = float(order.delivery_latitude), float(order.delivery_longitude)

    travel_mode = _directions_mode_for_order(order)
    enc, dist_m, dur_s = _directions_via_google(
        o_lat, o_lng, d_lat, d_lng, mode=travel_mode
    )
    speed_kmh = _fallback_speed_kmh_for_order(order)
    if enc:
        order.route_polyline = enc
        order.route_straight_fallback = False
        order.route_distance_meters = dist_m
        order.route_duration_seconds = dur_s
    else:
        order.route_polyline = encode_polyline([(o_lat, o_lng), (d_lat, d_lng)])
        order.route_straight_fallback = True
        straight_km = haversine_km(o_lat, o_lng, d_lat, d_lng)
        order.route_distance_meters = int(round(straight_km * 1000))
        order.route_duration_seconds = int(round((straight_km / speed_kmh) * 3600))

    # Driver starts at restaurant when route is first set for active delivery
    if order.status == Order.Status.OUT_FOR_DELIVERY:
        if order.driver_latitude is None or order.driver_longitude is None:
            order.driver_latitude = store.latitude
            order.driver_longitude = store.longitude
            order.tracking_updated_at = timezone.now()

    order.save(
        update_fields=[
            "route_polyline",
            "route_straight_fallback",
            "route_distance_meters",
            "route_duration_seconds",
            "driver_latitude",
            "driver_longitude",
            "tracking_updated_at",
            "updated_at",
        ]
    )


def tracking_display_phase(status: str) -> str:
    if status in (
        Order.Status.PENDING,
        Order.Status.CONFIRMED,
        Order.Status.PREPARING,
        Order.Status.READY_FOR_DELIVERY,
    ):
        return "preparing"
    if status == Order.Status.OUT_FOR_DELIVERY:
        return "on_the_way"
    if status == Order.Status.DELIVERED:
        return "delivered"
    return "preparing"


def tracking_status_label(phase: str) -> str:
    return {
        "preparing": "Preparing",
        "on_the_way": "On the way",
        "delivered": "Delivered",
    }.get(phase, "Preparing")


def build_tracking_payload(order: Order) -> dict[str, Any]:
    store = get_store_settings()
    rest_lat = float(store.latitude) if store and store.latitude is not None else None
    rest_lng = float(store.longitude) if store and store.longitude is not None else None
    rest_name = store.name if store else "Restaurant"

    dest_lat = float(order.delivery_latitude) if order.delivery_latitude is not None else None
    dest_lng = float(order.delivery_longitude) if order.delivery_longitude is not None else None

    phase = tracking_display_phase(order.status)
    drv_lat = float(order.driver_latitude) if order.driver_latitude is not None else None
    drv_lng = float(order.driver_longitude) if order.driver_longitude is not None else None

    distance_remaining_m: float | None = None
    eta_seconds: int | None = None

    speed_kmh = _eta_speed_kmh_for_order(order)
    if dest_lat is not None and dest_lng is not None and drv_lat is not None and drv_lng is not None:
        distance_remaining_m = haversine_meters(drv_lat, drv_lng, dest_lat, dest_lng)
        # Road factor ~1.15 over crow-flies for urban last leg
        distance_remaining_m *= 1.15
        speed_ms = (speed_kmh * 1000.0) / 3600.0
        eta_seconds = max(60, int(distance_remaining_m / speed_ms)) if speed_ms > 0 else None
    elif order.route_distance_meters and phase == "on_the_way" and drv_lat is None:
        distance_remaining_m = float(order.route_distance_meters)
        eta_seconds = order.route_duration_seconds

    del_label = (
        "Walking"
        if order.delivery_type == Order.DeliveryType.WALKING
        else "Bike"
    )

    pay_status_label = (
        "Paid" if order.payment_status == Order.PaymentStatus.PAID else "Pending"
    )

    return {
        "order_id": order.pk,
        "order_number": order.order_number,
        "status": order.status,
        "tracking_phase": phase,
        "tracking_status_label": tracking_status_label(phase),
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "payment_status_label": pay_status_label,
        "delivery_type": order.delivery_type,
        "delivery_type_label": del_label,
        "restaurant": {
            "name": rest_name,
            "latitude": rest_lat,
            "longitude": rest_lng,
        },
        "destination": {
            "address": order.address,
            "latitude": dest_lat,
            "longitude": dest_lng,
        },
        "driver": (
            {"latitude": drv_lat, "longitude": drv_lng}
            if drv_lat is not None and drv_lng is not None
            else None
        ),
        "route_polyline": order.route_polyline,
        "route_straight_fallback": order.route_straight_fallback,
        "route_distance_meters": order.route_distance_meters,
        "route_duration_seconds": order.route_duration_seconds,
        "distance_remaining_meters": (
            round(distance_remaining_m, 1) if distance_remaining_m is not None else None
        ),
        "eta_seconds": eta_seconds,
        "estimated_delivery_at": (
            order.estimated_delivery_at.isoformat() if order.estimated_delivery_at else None
        ),
        "tracking_updated_at": (
            order.tracking_updated_at.isoformat() if order.tracking_updated_at else None
        ),
    }


def broadcast_tracking_location(order_id: int, payload: dict[str, Any]) -> None:
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(layer.group_send)(
        f"order_track_{order_id}",
        {"type": "location.update", "payload": payload},
    )


def broadcast_order_chat_message(
    order_id: int,
    message_payload: dict[str, Any],
    *,
    support: bool = False,
    rider_staff: bool = False,
    customer_rider: bool = False,
) -> None:
    layer = get_channel_layer()
    if not layer:
        return
    event = {"type": "chat.message", "payload": message_payload}
    if support:
        group = f"order_support_{order_id}"
    elif rider_staff:
        group = f"order_rider_ops_{order_id}"
    elif customer_rider:
        group = f"order_customer_rider_{order_id}"
    else:
        group = f"order_chat_customer_{order_id}"
    async_to_sync(layer.group_send)(group, event)
    # Unified stream for staff dashboards (both threads in one socket).
    async_to_sync(layer.group_send)(f"order_staff_observer_{order_id}", event)
    preview = (message_payload.get("body") or "")[:140]
    inbox_payload: dict[str, Any] = {
        "kind": "new_message",
        "order_id": order_id,
        "support": support,
        "rider_staff": rider_staff,
        "customer_rider": customer_rider,
        "message": message_payload,
        "preview": preview,
    }
    async_to_sync(layer.group_send)(
        "staff_inbox_feed",
        {"type": "staff.inbox", "payload": inbox_payload},
    )


def broadcast_chat_message_update(order_id: int, message_payload: dict[str, Any]) -> None:
    """Broadcast receipt / status changes to all order chat channel groups."""
    layer = get_channel_layer()
    if not layer:
        return
    event = {"type": "chat.receipt", "payload": message_payload}
    for group in (
        f"order_support_{order_id}",
        f"order_chat_customer_{order_id}",
        f"order_rider_ops_{order_id}",
        f"order_customer_rider_{order_id}",
        f"order_staff_observer_{order_id}",
    ):
        async_to_sync(layer.group_send)(group, event)
