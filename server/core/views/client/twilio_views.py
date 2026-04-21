"""Twilio webhooks: inbound SMS → order support chat (optional)."""

from __future__ import annotations

import logging
import re

from django.db.models import Q
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ...models import Order, User
from ...tracking import broadcast_order_chat_message
from ...views.helpers import persist_order_chat_message

logger = logging.getLogger(__name__)

_ACTIVE_STATUSES = frozenset(
    {
        Order.Status.PENDING,
        Order.Status.CONFIRMED,
        Order.Status.PREPARING,
        Order.Status.READY_FOR_DELIVERY,
        Order.Status.OUT_FOR_DELIVERY,
    }
)


def _phone_variants(raw: str) -> set[str]:
    s = (raw or "").strip()
    if not s:
        return set()
    digits = re.sub(r"\D", "", s)
    out = {s}
    if digits:
        out.add(digits)
        out.add("+" + digits)
        if len(digits) == 10:
            out.add("+977" + digits)
    return {x for x in out if x}


@csrf_exempt
@require_POST
def twilio_inbound_sms(request):
    """
    When a customer texts your Twilio number, append the body to their most recent active order
    support thread so staff see it in the admin chat in real time.
    """
    body = (request.POST.get("Body") or "").strip()
    from_raw = (request.POST.get("From") or "").strip()
    if not body or not from_raw:
        return HttpResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            content_type="text/xml",
        )

    phones = _phone_variants(from_raw)
    user = None
    if phones:
        q = Q()
        for p in phones:
            q |= Q(phone=p)
        user = User.objects.filter(q).first()
    if not user and phones:
        tail = next(iter(phones)).lstrip("+")[-10:]
        if len(tail) >= 8:
            user = User.objects.filter(phone__endswith=tail).first()

    if not user:
        logger.info("Twilio inbound SMS: unknown caller %s", from_raw[:32])
        return HttpResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            content_type="text/xml",
        )

    order = (
        Order.objects.filter(user_id=user.id, status__in=_ACTIVE_STATUSES)
        .order_by("-updated_at")
        .first()
    )
    if not order:
        logger.info("Twilio inbound SMS: no active order for user %s", user.pk)
        return HttpResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            content_type="text/xml",
        )

    try:
        data = persist_order_chat_message(
            order,
            user,
            body,
            support=True,
            rider_staff=False,
            serializer_context={"user": user},
        )
    except ValueError as e:
        logger.warning("Twilio inbound SMS persist failed: %s", e)
        return HttpResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            content_type="text/xml",
        )

    broadcast_order_chat_message(order.pk, data, support=True, rider_staff=False)
    return HttpResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        content_type="text/xml",
    )
