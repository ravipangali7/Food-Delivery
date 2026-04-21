"""Staff CRUD and dashboard APIs."""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Max, Prefetch, Q, Sum
from django.db.models.functions import TruncDate
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ...models import Category, Notification, NotificationUser, Order, ParentCategory, Product, SuperSetting, Unit, User
from ...notification_delivery import create_recipient_rows, deliver_broadcast
from ...serializers import (
    CategoryAdminSerializer,
    NotificationAdminListSerializer,
    NotificationAdminUpdateSerializer,
    NotificationBroadcastSerializer,
    NotificationRecipientSerializer,
    ParentCategoryAdminSerializer,
    ProductAdminSerializer,
    SuperSettingSerializer,
    SuperSettingUpdateSerializer,
    UnitAdminSerializer,
    UserAdminListSerializer,
    UserAdminWriteSerializer,
)
from ..helpers import IsStaffUser

logger = logging.getLogger(__name__)


def _notifications_admin_queryset():
    return Notification.objects.annotate(
        recipients_count=Count("notification_users", distinct=True),
        delivery_sent_count=Count(
            "notification_users",
            filter=Q(notification_users__delivery_status=NotificationUser.DeliveryStatus.SENT),
        ),
        delivery_failed_count=Count(
            "notification_users",
            filter=Q(notification_users__delivery_status=NotificationUser.DeliveryStatus.FAILED),
        ),
        delivery_skipped_count=Count(
            "notification_users",
            filter=Q(notification_users__delivery_status=NotificationUser.DeliveryStatus.SKIPPED),
        ),
    )


def _admin_notification_detail_payload(n: Notification) -> dict:
    n = _notifications_admin_queryset().filter(pk=n.pk).first() or n
    recs = (
        NotificationUser.objects.filter(notification=n)
        .select_related("user")
        .order_by("-delivered_at", "pk")[:500]
    )
    data = NotificationAdminListSerializer(n).data
    data["recipients"] = NotificationRecipientSerializer(recs, many=True).data
    return data


def _admin_parent_queryset():
    sub_qs = Category.objects.annotate(
        products_count=Count("products", filter=Q(products__deleted_at__isnull=True))
    ).order_by("sort_order", "name")
    return (
        ParentCategory.objects.annotate(
            products_count=Count(
                "subcategories__products",
                filter=Q(subcategories__products__deleted_at__isnull=True),
                distinct=True,
            ),
            subcategories_count=Count("subcategories", distinct=True),
        )
        .prefetch_related(Prefetch("subcategories", queryset=sub_qs))
        .order_by("sort_order", "name")
    )


def _admin_parent_tree_response(request) -> list:
    parents = list(_admin_parent_queryset())
    out = []
    for p in parents:
        pdata = ParentCategoryAdminSerializer(p, context={"request": request}).data
        pdata["children"] = [
            CategoryAdminSerializer(s, context={"request": request}).data for s in p.subcategories.all()
        ]
        out.append(pdata)
    return out


@api_view(["GET"])
@permission_classes([IsStaffUser])
def dashboard_summary(request):
    orders = Order.objects.all()
    by_status = {
        row["status"]: row["c"]
        for row in Order.objects.values("status").annotate(c=Count("id"))
    }
    pending = orders.filter(status=Order.Status.PENDING).count()
    revenue = (
        orders.filter(status=Order.Status.DELIVERED).aggregate(s=Sum("total_amount"))["s"] or 0
    )
    return Response(
        {
            "orders_total": orders.count(),
            "orders_pending": pending,
            "orders_by_status": by_status,
            "revenue_delivered_total": str(revenue),
            "products_count": Product.objects.filter(deleted_at__isnull=True).count(),
            "customers_count": User.objects.filter(
                is_staff=False, is_delivery_boy=False, deleted_at__isnull=True
            ).count(),
            "delivery_boys_count": User.objects.filter(is_delivery_boy=True, deleted_at__isnull=True).count(),
        }
    )


@api_view(["GET"])
@permission_classes([IsStaffUser])
def dashboard_today(request):
    """Today's operational snapshot: orders placed today, delivery partners, etc."""
    today = timezone.localdate()

    placed_today = Order.objects.filter(created_at__date=today)
    orders_placed = placed_today.count()
    revenue_sum = placed_today.aggregate(s=Sum("total_amount"))["s"] or 0
    revenue = revenue_sum if isinstance(revenue_sum, Decimal) else Decimal(str(revenue_sum or 0))
    if orders_placed:
        avg_order = (revenue / orders_placed).quantize(Decimal("0.01"))
    else:
        avg_order = Decimal("0.00")

    delivered = Order.objects.filter(
        status=Order.Status.DELIVERED,
        delivered_at__date=today,
    ).count()

    cancelled = Order.objects.filter(
        status=Order.Status.CANCELLED,
    ).filter(Q(cancelled_at__date=today) | Q(cancelled_at__isnull=True, created_at__date=today)).count()

    on_route_statuses = (Order.Status.READY_FOR_DELIVERY, Order.Status.OUT_FOR_DELIVERY)
    boys_qs = User.objects.filter(is_delivery_boy=True, deleted_at__isnull=True).order_by("name")
    delivery_boys = []
    for b in boys_qs:
        delivered_by_boy = Order.objects.filter(
            delivery_boy=b,
            status=Order.Status.DELIVERED,
            delivered_at__date=today,
        ).count()
        busy = Order.objects.filter(delivery_boy=b, status__in=on_route_statuses).exists()
        delivery_boys.append(
            {
                "id": b.id,
                "name": b.name,
                "profile_photo": b.profile_photo or "",
                "delivered_today": delivered_by_boy,
                "availability": "busy" if busy else "available",
            }
        )

    return Response(
        {
            "date": today.isoformat(),
            "orders_placed": orders_placed,
            "revenue": str(revenue),
            "avg_order_value": str(avg_order),
            "delivered": delivered,
            "cancelled": cancelled,
            "delivery_boys": delivery_boys,
        }
    )


def _normalize_chart_day(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        return date.fromisoformat(val[:10])
    return val


@api_view(["GET"])
@permission_classes([IsStaffUser])
def dashboard_revenue_series(request):
    """Daily delivered revenue for charting (7 / 30 / 90 calendar days ending today)."""
    try:
        days = int(request.GET.get("days", "7"))
    except (TypeError, ValueError):
        days = 7
    if days not in (7, 30, 90):
        days = 7

    end = timezone.localdate()
    start = end - timedelta(days=days - 1)

    base = Order.objects.filter(
        status=Order.Status.DELIVERED,
        delivered_at__isnull=False,
        delivered_at__date__gte=start,
        delivered_at__date__lte=end,
    )

    daily_rows = (
        base.annotate(day=TruncDate("delivered_at"))
        .values("day")
        .annotate(revenue=Sum("total_amount"))
        .order_by("day")
    )
    by_day = {}
    for row in daily_rows:
        d = _normalize_chart_day(row["day"])
        if d is not None:
            by_day[d] = row["revenue"] or 0

    points = []
    d = start
    while d <= end:
        rev = by_day.get(d, 0)
        points.append({"date": d.isoformat(), "revenue": float(rev)})
        d += timedelta(days=1)

    return Response({"days": days, "points": points})


@api_view(["GET", "POST"])
@permission_classes([IsStaffUser])
def admin_product_list_create(request):
    qs = (
        Product.objects.filter(deleted_at__isnull=True)
        .select_related("category", "unit")
        .prefetch_related("images")
        .order_by("sort_order", "name")
    )
    if request.method == "GET":
        return Response(ProductAdminSerializer(qs, many=True, context={"request": request}).data)
    ser = ProductAdminSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ProductAdminSerializer(ser.instance, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsStaffUser])
def admin_product_detail(request, slug):
    obj = get_object_or_404(
        Product.objects.select_related("category", "unit").prefetch_related("images"),
        slug=slug,
    )
    if request.method == "GET":
        return Response(ProductAdminSerializer(obj, context={"request": request}).data)
    if request.method == "DELETE":
        Product.objects.filter(pk=obj.pk).update(deleted_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = ProductAdminSerializer(obj, data=request.data, partial=True, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ProductAdminSerializer(ser.instance, context={"request": request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsStaffUser])
def admin_parent_category_list_create(request):
    if request.method == "GET":
        if request.GET.get("format") == "flat":
            qs = (
                ParentCategory.objects.annotate(
                    products_count=Count(
                        "subcategories__products",
                        filter=Q(subcategories__products__deleted_at__isnull=True),
                        distinct=True,
                    ),
                    subcategories_count=Count("subcategories", distinct=True),
                )
                .order_by("sort_order", "name")
            )
            return Response(
                ParentCategoryAdminSerializer(qs, many=True, context={"request": request}).data
            )
        return Response(_admin_parent_tree_response(request))
    ser = ParentCategoryAdminSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(
        ParentCategoryAdminSerializer(ser.instance, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsStaffUser])
def admin_parent_category_detail(request, pk):
    obj = get_object_or_404(
        ParentCategory.objects.annotate(
            products_count=Count(
                "subcategories__products",
                filter=Q(subcategories__products__deleted_at__isnull=True),
                distinct=True,
            ),
            subcategories_count=Count("subcategories", distinct=True),
        ).prefetch_related(
            Prefetch(
                "subcategories",
                queryset=Category.objects.annotate(
                    products_count=Count("products", filter=Q(products__deleted_at__isnull=True))
                ).order_by("sort_order", "name"),
            )
        ),
        pk=pk,
    )
    if request.method == "GET":
        data = ParentCategoryAdminSerializer(obj, context={"request": request}).data
        data["children"] = [
            CategoryAdminSerializer(s, context={"request": request}).data for s in obj.subcategories.all()
        ]
        return Response(data)
    if request.method == "DELETE":
        if obj.subcategories.exists():
            return Response(
                {"detail": "Remove or reassign all subcategories before deleting this parent category."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = ParentCategoryAdminSerializer(
        obj, data=request.data, partial=True, context={"request": request}
    )
    ser.is_valid(raise_exception=True)
    ser.save()
    data = ParentCategoryAdminSerializer(ser.instance, context={"request": request}).data
    data["children"] = [
        CategoryAdminSerializer(s, context={"request": request}).data
        for s in ser.instance.subcategories.order_by("sort_order", "name")
    ]
    return Response(data)


@api_view(["GET", "POST"])
@permission_classes([IsStaffUser])
def admin_category_list_create(request):
    if request.method == "GET":
        fmt = request.GET.get("format", "tree")
        if fmt == "flat":
            annotated = (
                Category.objects.select_related("parent")
                .annotate(products_count=Count("products", filter=Q(products__deleted_at__isnull=True)))
                .order_by("sort_order", "name")
            )
            return Response(
                CategoryAdminSerializer(annotated, many=True, context={"request": request}).data
            )
        return Response(_admin_parent_tree_response(request))
    ser = CategoryAdminSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(
        CategoryAdminSerializer(ser.instance, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsStaffUser])
def admin_category_detail(request, pk):
    obj = get_object_or_404(
        Category.objects.annotate(
            products_count=Count("products", filter=Q(products__deleted_at__isnull=True))
        ),
        pk=pk,
    )
    if request.method == "GET":
        return Response(CategoryAdminSerializer(obj, context={"request": request}).data)
    if request.method == "DELETE":
        try:
            obj.delete()
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete a category that still has products."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = CategoryAdminSerializer(
        obj, data=request.data, partial=True, context={"request": request}
    )
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(CategoryAdminSerializer(ser.instance, context={"request": request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsStaffUser])
def admin_user_list_create(request):
    role = request.GET.get("role", "")
    qs = User.objects.filter(deleted_at__isnull=True).order_by("-created_at")
    if role == "customers":
        qs = qs.filter(is_staff=False, is_delivery_boy=False)
    elif role == "delivery-boys":
        qs = qs.filter(is_delivery_boy=True)
    if request.method == "GET":
        return Response(UserAdminListSerializer(qs, many=True).data)
    ser = UserAdminWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(UserAdminListSerializer(ser.instance).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsStaffUser])
def admin_user_detail(request, pk):
    obj = get_object_or_404(User.objects.filter(deleted_at__isnull=True), pk=pk)
    if request.method == "GET":
        return Response(UserAdminListSerializer(obj).data)
    if request.method == "DELETE":
        User.objects.filter(pk=pk).update(deleted_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = UserAdminWriteSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(UserAdminListSerializer(ser.instance).data)


@api_view(["PATCH"])
@permission_classes([IsStaffUser])
def admin_settings_update(request, pk):
    obj = get_object_or_404(SuperSetting.objects.all(), pk=pk)
    ser = SuperSettingUpdateSerializer(
        obj, data=request.data, partial=True, context={"request": request}
    )
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(SuperSettingSerializer(ser.instance).data)


@api_view(["GET"])
@permission_classes([IsStaffUser])
def admin_notification_list(request):
    qs = _notifications_admin_queryset().order_by("-created_at")[:300]
    return Response(NotificationAdminListSerializer(qs, many=True).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsStaffUser])
def admin_notification_detail(request, pk):
    n = get_object_or_404(_notifications_admin_queryset(), pk=pk)
    if request.method == "GET":
        return Response(_admin_notification_detail_payload(n))
    if request.method == "DELETE":
        n.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = NotificationAdminUpdateSerializer(n, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    n = _notifications_admin_queryset().filter(pk=ser.instance.pk).first()
    return Response(_admin_notification_detail_payload(n))


@api_view(["POST"])
@permission_classes([IsStaffUser])
def admin_notification_broadcast(request):
    ser = NotificationBroadcastSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    target = ser.validated_data["target"]
    recipient_ids = ser.validated_data.get("recipient_ids")

    qs = User.objects.filter(is_active=True, deleted_at__isnull=True)
    if target == "all_customers":
        qs = qs.filter(is_staff=False, is_delivery_boy=False)
    elif target == "all_delivery_boys":
        qs = qs.filter(is_delivery_boy=True)

    if recipient_ids:
        wanted = set(recipient_ids)
        matched = set(qs.filter(pk__in=wanted).values_list("pk", flat=True))
        if matched != wanted:
            return Response(
                {"detail": "One or more user IDs are invalid or do not match the selected audience."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_ids = list(matched)
        audience_value = Notification.TargetAudience.DIRECT
        segment = "customers" if target == "all_customers" else "delivery_boys"
        extra_data = {"segment": segment}
    else:
        user_ids = list(qs.values_list("pk", flat=True))
        audience_value = target
        extra_data = {}

    if not user_ids:
        return Response(
            {"detail": "No active recipients match the selected audience."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        with transaction.atomic():
            n = Notification.objects.create(
                type=ser.validated_data["type"],
                title=ser.validated_data["title"],
                body=ser.validated_data["body"],
                medium=ser.validated_data["medium"],
                target_audience=audience_value,
                data=extra_data or {},
            )
            create_recipient_rows(n, user_ids)
        summary = deliver_broadcast(n, user_ids)
    except Exception:
        logger.exception("Admin notification broadcast failed")
        return Response(
            {"detail": "Failed to send notification. Check server logs for details."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    n = _notifications_admin_queryset().filter(pk=n.pk).first()
    out = NotificationAdminListSerializer(n).data
    out["delivery"] = summary
    out["recipients_total"] = len(user_ids)
    return Response(out, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsStaffUser])
def admin_unit_list_create(request):
    if request.method == "GET":
        qs = Unit.objects.order_by("sort_order", "name")
        return Response(UnitAdminSerializer(qs, many=True).data)
    ser = UnitAdminSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(UnitAdminSerializer(ser.instance).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsStaffUser])
def admin_unit_detail(request, pk):
    obj = get_object_or_404(Unit.objects.all(), pk=pk)
    if request.method == "GET":
        return Response(UnitAdminSerializer(obj).data)
    if request.method == "DELETE":
        if obj.products.filter(deleted_at__isnull=True).exists():
            return Response(
                {"detail": "Cannot delete a unit that is assigned to products."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = UnitAdminSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(UnitAdminSerializer(ser.instance).data)


@api_view(["GET"])
@permission_classes([IsStaffUser])
def support_inbox(request):
    """Orders with active pipeline status or any chat activity — for staff support console."""
    active_statuses = [
        Order.Status.PENDING,
        Order.Status.CONFIRMED,
        Order.Status.PREPARING,
        Order.Status.READY_FOR_DELIVERY,
        Order.Status.OUT_FOR_DELIVERY,
    ]
    qs = (
        Order.objects.filter(Q(status__in=active_statuses) | Q(chat_messages__isnull=False))
        .distinct()
        .select_related("user", "delivery_boy")
        .annotate(last_chat=Max("chat_messages__created_at"))
        .order_by("-last_chat", "-updated_at")[:200]
    )
    rows = []
    for o in qs:
        u = o.user
        db = o.delivery_boy
        rows.append(
            {
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status,
                "customer_user_id": u.id if u else None,
                "customer_name": u.name if u else "",
                "customer_phone": u.phone if u else "",
                "customer_profile_photo": (u.profile_photo or "").strip() if u else "",
                "delivery_boy_name": db.name if db else None,
                "delivery_boy_id": o.delivery_boy_id,
                "delivery_boy_profile_photo": (db.profile_photo or "").strip() if db else "",
                "last_message_at": o.last_chat.isoformat() if o.last_chat else None,
            }
        )
    return Response(rows)
