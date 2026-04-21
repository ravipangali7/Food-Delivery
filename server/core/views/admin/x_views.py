"""Staff-only order actions (assign delivery)."""

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ...models import Order
from ...serializers import OrderAssignDeliverySerializer, OrderSerializer
from ...tracking import ensure_route_for_order
from ..helpers import IsStaffUser


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
