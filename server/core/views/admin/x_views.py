"""Staff-only order actions (assign delivery, media proxy for invoices)."""

import mimetypes
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ...models import Order
from ...serializers import OrderAssignDeliverySerializer, OrderSerializer
from ...tracking import ensure_route_for_order
from ..helpers import IsStaffUser


def _resolve_media_file(relative: str) -> Path:
    """Map ``/media/foo/bar.jpg`` to a file under ``MEDIA_ROOT``."""
    rel = (relative or "").strip()
    if not rel.startswith("/media/"):
        raise ValueError("invalid media path")
    inner = rel[len("/media/") :].lstrip("/")
    if not inner or ".." in inner.split("/"):
        raise ValueError("invalid media path")
    root = Path(settings.MEDIA_ROOT).resolve()
    full = (root / inner).resolve()
    if not str(full).startswith(str(root)):
        raise ValueError("invalid media path")
    return full


@api_view(["GET"])
@permission_classes([IsStaffUser])
def admin_media_file(request):
    """
    Staff-only media proxy for invoice PDF generation.

    Static ``/media/`` responses often omit CORS headers; this endpoint is served
    through Django with the same CORS policy as other API routes.
    """
    raw = (request.GET.get("path") or request.GET.get("url") or "").strip()
    if not raw:
        return Response({"detail": "path or url is required"}, status=400)
    if raw.startswith("http://") or raw.startswith("https://"):
        raw = urlparse(raw).path or ""
    if not raw.startswith("/"):
        raw = f"/{raw}"
    try:
        target = _resolve_media_file(raw)
    except ValueError:
        return Response({"detail": "invalid media path"}, status=400)
    if not target.is_file():
        raise Http404
    content_type, _encoding = mimetypes.guess_type(str(target))
    return FileResponse(target.open("rb"), content_type=content_type or "application/octet-stream")


@api_view(["POST"])
@permission_classes([IsStaffUser])
def order_assign_delivery(request, pk):
    order = get_object_or_404(
        Order.objects.select_related("user", "delivery_boy").prefetch_related(
            "items__product__images"
        ),
        pk=pk,
    )
    ser = OrderAssignDeliverySerializer(data=request.data, context={"order": order})
    ser.is_valid(raise_exception=True)
    dboy = ser.validated_data["delivery_boy_id"]
    order.delivery_boy = dboy
    update_fields = ["delivery_boy", "updated_at"]
    if "delivery_type" in ser.validated_data:
        order.delivery_type = ser.validated_data["delivery_type"]
        update_fields.append("delivery_type")
    order.save(update_fields=update_fields)
    if order.status == Order.Status.OUT_FOR_DELIVERY:
        ensure_route_for_order(order)
        order.refresh_from_db()
    return Response(OrderSerializer(order).data)
