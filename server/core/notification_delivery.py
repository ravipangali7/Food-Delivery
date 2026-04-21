"""
Dispatch admin broadcast notifications over SMS or FCM and persist per-recipient status.
"""

from __future__ import annotations

from collections.abc import Sequence

from django.db import transaction
from django.utils import timezone

from .fcm_service import send_push_multicast
from .models import Notification, NotificationUser, User
from .sms_service import send_notification_sms


def deliver_broadcast(notification: Notification, user_ids: Sequence[int]) -> dict[str, int]:
    """
    For each ``NotificationUser`` row for this notification, send via the chosen medium
    and update ``delivery_status`` / ``error_message`` / ``delivered_at``.

    Returns counts: sent, failed, skipped.
    """
    ids = list(user_ids)
    if not ids:
        return {"sent": 0, "failed": 0, "skipped": 0}

    medium = notification.medium
    now = timezone.now()

    users = {
        u.pk: u
        for u in User.objects.filter(pk__in=ids).only(
            "id",
            "phone",
            "fcm_token",
        )
    }
    nu_map = {
        nu.user_id: nu
        for nu in NotificationUser.objects.filter(notification_id=notification.id, user_id__in=ids)
    }

    sent = failed = skipped = 0

    if medium == Notification.Medium.SMS:
        for uid in ids:
            nu = nu_map.get(uid)
            if nu is None:
                continue
            user = users.get(uid)
            if not user or not (user.phone or "").strip():
                _mark(nu, NotificationUser.DeliveryStatus.SKIPPED, "No phone number", now)
                skipped += 1
                continue
            ok, err = send_notification_sms(
                phone=user.phone.strip(),
                title=notification.title,
                body=notification.body,
            )
            if ok:
                _mark(nu, NotificationUser.DeliveryStatus.SENT, "", now)
                sent += 1
            else:
                _mark(nu, NotificationUser.DeliveryStatus.FAILED, err or "SMS failed", now)
                failed += 1

    elif medium == Notification.Medium.PUSH:
        uid_token_pairs: list[tuple[int, str]] = []
        for uid in ids:
            user = users.get(uid)
            tok = (getattr(user, "fcm_token", None) or "").strip() if user else ""
            if tok:
                uid_token_pairs.append((uid, tok))
            else:
                nu = nu_map.get(uid)
                if nu is None:
                    continue
                _mark(
                    nu,
                    NotificationUser.DeliveryStatus.SKIPPED,
                    "No FCM token registered for this user",
                    now,
                )
                skipped += 1

        if uid_token_pairs:
            tokens = [p[1] for p in uid_token_pairs]
            data = {"notification_id": str(notification.pk), "type": notification.type}
            results = send_push_multicast(
                tokens=tokens,
                title=notification.title,
                body=notification.body,
                data=data,
            )
            for i, (uid, _tok) in enumerate(uid_token_pairs):
                if i >= len(results):
                    break
                _r_tok, ok, err = results[i]
                nu = nu_map.get(uid)
                if nu is None:
                    continue
                if ok:
                    _mark(nu, NotificationUser.DeliveryStatus.SENT, "", now)
                    sent += 1
                else:
                    _mark(
                        nu,
                        NotificationUser.DeliveryStatus.FAILED,
                        err or "Push delivery failed",
                        now,
                    )
                    failed += 1

    else:
        for uid in ids:
            nu = nu_map.get(uid)
            if nu is None:
                continue
            _mark(nu, NotificationUser.DeliveryStatus.SKIPPED, f"Unknown medium {medium!r}", now)
            skipped += 1

    summary = {"sent": sent, "failed": failed, "skipped": skipped}
    notification.data = {**(notification.data or {}), "delivery_summary": summary}
    notification.save(update_fields=["data"])
    return summary


def _mark(
    nu: NotificationUser,
    status: str,
    error: str,
    now,
) -> None:
    nu.delivery_status = status
    nu.error_message = (error or "")[:500]
    nu.delivered_at = now if status in (
        NotificationUser.DeliveryStatus.SENT,
        NotificationUser.DeliveryStatus.FAILED,
        NotificationUser.DeliveryStatus.SKIPPED,
    ) else None
    nu.save(update_fields=["delivery_status", "error_message", "delivered_at"])


@transaction.atomic
def create_recipient_rows(notification: Notification, user_ids: Sequence[int]) -> None:
    for uid in user_ids:
        NotificationUser.objects.get_or_create(
            notification=notification,
            user_id=uid,
            defaults={
                "delivery_status": NotificationUser.DeliveryStatus.PENDING,
                "error_message": "",
            },
        )
