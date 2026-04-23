"""
SMS delivery via Infelo Group (Bearer account key: ``INFELO_API_KEY`` / ``INFELO_SMS_API_KEY`` in settings).

Uses public ``POST /api/v1/sms/send/`` per Infelo SMS API documentation.

When the Infelo key is unset and ``DEBUG`` is true, OTP text is logged only so local
development can proceed without sending real SMS.
"""

from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def infelo_sms_configured() -> bool:
    k = (getattr(settings, "INFELO_API_KEY", None) or getattr(settings, "INFELO_SMS_API_KEY", None) or "").strip()
    return bool(k)


def send_otp_sms(phone: str, code: str, purpose: str) -> None:
    """Send OTP to ``phone`` via Infelo, or log only in DEBUG when no API key is set."""
    ok, err, _meta = send_otp_sms_checked(phone=phone, code=code, purpose=purpose)
    if not ok:
        logger.error("OTP SMS failed for %s: %s", phone, err)


def send_otp_sms_checked(*, phone: str, code: str, purpose: str) -> tuple[bool, str, dict]:
    """Send OTP and return (ok, error_message, provider_meta)."""
    message = _build_message(code, purpose)

    if not infelo_sms_configured():
        if settings.DEBUG:
            logger.info("[SMS DEBUG — set INFELO_API_KEY in settings to send] → %s: %s", phone, message)
            return True, "", {"provider": "infelo", "mode": "debug_logged_only", "note": "no INFELO_API_KEY"}
        return False, "INFELO_API_KEY is not set in settings.", {"provider": "infelo", "error": "missing_api_key"}

    ok, err, meta = _infelo_send_sms_with_meta(phone=phone, body=message)
    return ok, err, meta


def _build_message(code: str, purpose: str) -> str:
    action = "sign in" if purpose == "login" else "complete registration"
    return f"Your verification code is {code}. Use it to {action}. Valid for 5 minutes."


def send_chat_reply_sms(*, phone: str, body: str) -> tuple[bool, str]:
    """
    Send a plain chat reply SMS.
    Returns ``(success, error_message)``.
    """
    text = (body or "").strip()
    if not text:
        return False, "Empty body"

    if not infelo_sms_configured():
        if settings.DEBUG:
            logger.info("[SMS DEBUG — set INFELO_API_KEY in settings to send] chat reply → %s: %s", phone, text[:500])
            return True, ""
        return False, "INFELO_API_KEY is not set in settings."

    return _infelo_send_sms(phone=phone, body=text)


def send_notification_sms(*, phone: str, title: str, body: str) -> tuple[bool, str]:
    """
    Send an admin notification via SMS to ``phone``.

    Returns ``(success, error_message)`` where ``error_message`` is empty on success.
    """
    text = f"{title}\n{body}".strip()

    if not infelo_sms_configured():
        if settings.DEBUG:
            logger.info("[SMS DEBUG — set INFELO_API_KEY in settings to send] notification → %s: %s", phone, text[:500])
            return True, ""
        return False, "INFELO_API_KEY is not set in settings."

    return _infelo_send_sms(phone=phone, body=text)


def _infelo_send_sms(*, phone: str, body: str) -> tuple[bool, str]:
    from .infelo_sms import send_infelo_sms

    return send_infelo_sms(phone=phone, message=body)


def _infelo_send_sms_with_meta(*, phone: str, body: str) -> tuple[bool, str, dict]:
    from .infelo_sms import send_infelo_sms_detailed

    return send_infelo_sms_detailed(phone=phone, message=body)
