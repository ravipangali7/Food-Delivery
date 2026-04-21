"""
SMS delivery for OTP codes and admin broadcast notifications.

Set ``SMS_PROVIDER`` to ``console`` (default), ``twilio``, or extend for other gateways.
"""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


def send_otp_sms(phone: str, code: str, purpose: str) -> None:
    """
    Send OTP to ``phone`` via SMS.

    In development, the message is logged. Set ``SMS_PROVIDER`` and related
    settings to integrate a real gateway in production.
    """
    message = _build_message(code, purpose)
    provider = getattr(settings, "SMS_PROVIDER", "console").lower()

    if provider == "console" or settings.DEBUG:
        logger.info("[SMS → %s] %s", phone, message)
        return

    # Example hook for a real provider (implement as needed):
    # if provider == "twilio":
    #     from twilio.rest import Client
    #     ...
    raise NotImplementedError(f"SMS_PROVIDER={provider!r} is not configured.")


def _build_message(code: str, purpose: str) -> str:
    action = "sign in" if purpose == "login" else "complete registration"
    return f"Your verification code is {code}. Use it to {action}. Valid for 5 minutes."


def send_chat_reply_sms(*, phone: str, body: str) -> tuple[bool, str]:
    """
    Send a plain chat reply SMS (same transport as notifications).
    Returns ``(success, error_message)``.
    """
    text = (body or "").strip()
    if not text:
        return False, "Empty body"
    provider = getattr(settings, "SMS_PROVIDER", "console").lower()

    if provider == "console":
        logger.info("[SMS chat reply → %s] %s", phone, text[:500])
        return True, ""

    if provider == "twilio":
        return _twilio_send_sms(phone=phone, body=text)

    logger.error("Unknown SMS_PROVIDER=%r for chat reply SMS", provider)
    return False, f"SMS provider {provider!r} is not implemented."


def send_notification_sms(*, phone: str, title: str, body: str) -> tuple[bool, str]:
    """
    Send an admin notification via SMS to ``phone``.

    Returns ``(success, error_message)`` where ``error_message`` is empty on success.
    """
    text = f"{title}\n{body}".strip()
    provider = getattr(settings, "SMS_PROVIDER", "console").lower()

    if provider == "console":
        logger.info("[SMS notification → %s] %s", phone, text[:500])
        return True, ""

    if provider == "twilio":
        return _twilio_send_sms(phone=phone, body=text)

    logger.error("Unknown SMS_PROVIDER=%r for notification SMS", provider)
    return False, f"SMS provider {provider!r} is not implemented."


def _twilio_send_sms(*, phone: str, body: str) -> tuple[bool, str]:
    sid = getattr(settings, "TWILIO_ACCOUNT_SID", "") or ""
    token = getattr(settings, "TWILIO_AUTH_TOKEN", "") or ""
    from_num = getattr(settings, "TWILIO_FROM_NUMBER", "") or ""
    if not sid or not token or not from_num:
        return False, "Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)."

    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    data = urllib.parse.urlencode(
        {
            "To": phone if phone.startswith("+") else f"+{phone.lstrip('+')}",
            "From": from_num,
            "Body": body[:1600],
        }
    ).encode("utf-8")
    auth = base64.b64encode(f"{sid}:{token}".encode("utf-8")).decode("ascii")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode("utf-8"))
            msg = detail.get("message", str(e))
        except Exception:
            msg = str(e)
        logger.warning("Twilio HTTP %s: %s", e.code, msg)
        return False, msg[:500]
    except OSError as e:
        logger.exception("Twilio network error")
        return False, str(e)[:500]

    try:
        parsed = json.loads(raw)
        if parsed.get("status") in ("queued", "sent", "delivered") or parsed.get("sid"):
            return True, ""
        return False, raw[:500]
    except json.JSONDecodeError:
        return True, ""
