"""Authenticated delivery-role endpoints."""

from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...models import Order


class IsDeliveryBoyUser(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and bool(
            request.user and getattr(request.user, "is_delivery_boy", False)
        )


@api_view(["GET"])
@permission_classes([IsDeliveryBoyUser])
def delivery_earnings(request):
    """Aggregated delivered-order totals for the logged-in delivery user."""
    days = int(request.GET.get("days", "7"))
    days = max(1, min(days, 90))
    start = timezone.now() - timedelta(days=days)

    base = Order.objects.filter(
        delivery_boy_id=request.user.id,
        status=Order.Status.DELIVERED,
        delivered_at__isnull=False,
        delivered_at__gte=start,
    )

    total = base.aggregate(
        amount=Sum("total_amount"),
        deliveries=Count("id"),
    )

    daily = (
        base.annotate(day=TruncDate("delivered_at"))
        .values("day")
        .annotate(deliveries=Count("id"), amount=Sum("total_amount"))
        .order_by("-day")
    )

    return Response(
        {
            "days": days,
            "total_amount": str(total["amount"] or 0),
            "total_deliveries": total["deliveries"] or 0,
            "daily": [
                {
                    "date": row["day"].isoformat() if row["day"] else None,
                    "deliveries": row["deliveries"],
                    "amount": str(row["amount"] or 0),
                }
                for row in daily
            ],
        }
    )
