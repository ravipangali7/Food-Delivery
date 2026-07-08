"""staff ले order chat मा जवाफ दिँदा वैकल्पिक SMS mirror (Infelo)।"""

from __future__ import annotations

import logging

from django.conf import settings

from .models import Order, OrderChatMessage, User
from .sms_service import send_chat_reply_sms

logger = logging.getLogger(__name__)


def maybe_send_staff_chat_reply_sms(order: Order, msg: OrderChatMessage, sender: User) -> None:
    """
    store staff ले chat मा जवाफ दिँदा, वैकल्पिक रूपमा SMS पनि पठाउँछ ताकि app बिना पनि देखियोस्।
    ``CHAT_REPLY_SMS`` ले नियन्त्रण (``INFELO_SMS_API_KEY`` सेट भए Infelo प्रयोग)।
    """
    if not getattr(sender, "is_staff", False) or not sender.is_active:
        return
    if not getattr(settings, "CHAT_REPLY_SMS", True):
        return

    prefix = f"[{order.order_number or order.pk}] "
    text = f"{prefix}{msg.body}".strip()[:1600]

    if msg.rider_staff:
        if order.delivery_boy_id:
            db = order.delivery_boy
            if db:
                phone = (db.phone or "").strip()
                if phone:
                    ok, err = send_chat_reply_sms(phone=phone, body=text)
                    if not ok:
                        logger.warning("Staff chat SMS to rider failed: %s", err)
        return

    # support वा ग्राहकले देख्ने delivery coordination → ग्राहकलाई सूचित
    phone = ""
    if order.user_id and order.user:
        phone = (order.user.phone or "").strip()
    if phone:
        ok, err = send_chat_reply_sms(phone=phone, body=text)
        if not ok:
            logger.warning("Staff chat SMS to customer failed: %s", err)
