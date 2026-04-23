"""
Infelo Group (https://api.infelogroup.com) — account Bearer key.

- ``POST …/v1/sms/send/`` — single SMS ([infelo-api-sms](infelo-api-sms.md) reference)
- ``GET …/v1/embed/summary/`` — public embed summary (primary; General API)
- ``GET …/v1/sms/embed/summary/`` — legacy alias for the same
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urljoin

from django.conf import settings

from .utils.phone import normalize_phone

_MAX_SMS_LEN = 160
# Appended to every outbound SMS (after truncation so the signature is never cut off).
_SMS_SIGNATURE = " Used by Shyam Sweets"


def _apply_sms_signature(message: str) -> str:
    text = (message or "").strip()
    if not text:
        return ""
    sig = _SMS_SIGNATURE.strip()
    body = text[: -len(sig)].rstrip() if text.endswith(sig) else text
    if not body:
        return sig[:_MAX_SMS_LEN]
    combined = f"{body} {sig}"
    if len(combined) <= _MAX_SMS_LEN:
        return combined
    room = _MAX_SMS_LEN - len(f" {sig}")
    if room < 1:
        return combined[:_MAX_SMS_LEN]
    base = body[:room].rstrip()
    return f"{base} {sig}"


def format_infelo_destination(phone_raw: str) -> str:
    """
    Build ``to`` for Infelo (E.164). Store/user phones are digit-only (see ``normalize_phone``).
    """
    digits = normalize_phone(phone_raw)
    if not digits:
        return ""
    if digits.startswith("977") and len(digits) >= 11:
        return f"+{digits}"
    if len(digits) == 10 and digits[0] == "9":
        return f"+977{digits}"
    return f"+{digits}"


def _resolved_api_base() -> str:
    base = (getattr(settings, "INFELO_SMS_API_BASE", None) or "").strip().rstrip("/")
    if base:
        if not base.startswith("http"):
            base = f"https://{base}"
        return base
    host = (getattr(settings, "INFELO_SMS_API_HOST", None) or "api.infelogroup.com").strip().lower()
    if host.startswith("https://"):
        host = host[8:]
    if host.endswith("/"):
        host = host.rstrip("/")
    return f"https://{host}/api"


def _urllib_json_request(
    method: str,
    url: str,
    *,
    bearer: str | None = None,
    body_dict: dict[str, Any] | None = None,
) -> tuple[int, str]:
    data = None
    if body_dict is not None:
        data = json.dumps(body_dict, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("User-Agent", "FoodDelivery/1.0")
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if bearer:
        req.add_header("Authorization", f"Bearer {bearer}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return e.code, raw
    except OSError as e:
        return 0, str(e)


def _infelo_account_key() -> str:
    return (
        (getattr(settings, "INFELO_API_KEY", None) or getattr(settings, "INFELO_SMS_API_KEY", None) or "")
        or ""
    ).strip()


def infelo_admin_ui_config() -> dict[str, Any]:
    """Staff-only: API base, portal origin for embed script, and account API key."""
    key = _infelo_account_key()
    portal = (getattr(settings, "INFELO_PORTAL_ORIGIN", None) or "").strip().rstrip("/")
    return {
        "api_base": _resolved_api_base(),
        "portal_origin": portal,
        "infelo_api_key": key,
        "sms_api_key": key,
    }


def fetch_infelo_embed_summary() -> tuple[bool, str, dict[str, Any]]:
    """
    ``GET /api/v1/embed/summary/`` with Bearer account key (``GET /api/v1/sms/embed/summary/`` as fallback).
    """
    api_key = _infelo_account_key()
    if not api_key:
        return False, "Set INFELO_API_KEY in settings.", {}

    base = _resolved_api_base()
    url_primary = urljoin(base + "/", "v1/embed/summary/")
    st, raw = _urllib_json_request("GET", url_primary, bearer=api_key)
    ok, err = _interpret_response(st, raw, expect_json=True)
    if not ok:
        url_legacy = urljoin(base + "/", "v1/sms/embed/summary/")
        st, raw = _urllib_json_request("GET", url_legacy, bearer=api_key)
        ok, err = _interpret_response(st, raw, expect_json=True)
        if not ok:
            return False, err, {"status": st, "raw": raw[:500]}

    try:
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        return False, raw[:500], {"status": st}

    if not isinstance(data, dict):
        return False, "Unexpected summary response shape.", {}
    return True, "", data


def send_infelo_sms(*, phone: str, message: str) -> tuple[bool, str]:
    ok, err, _meta = send_infelo_sms_detailed(phone=phone, message=message)
    return ok, err


def send_infelo_sms_detailed(*, phone: str, message: str) -> tuple[bool, str, dict]:
    """
    Send one SMS via Infelo ``POST /api/v1/sms/send/`` with Bearer account key in settings.
    """
    api_key = _infelo_account_key()
    if not api_key:
        msg = "Set INFELO_API_KEY in settings."
        return False, msg, {"provider": "infelo", "error": msg}

    to = format_infelo_destination(phone)
    if not to:
        return False, "Invalid phone number for SMS.", {"provider": "infelo", "to": phone}

    text = _apply_sms_signature(message)
    if not text:
        return False, "Empty SMS body.", {"provider": "infelo", "to": to}

    base = _resolved_api_base()
    send_url = urljoin(base + "/", "v1/sms/send/")
    st, raw = _urllib_json_request(
        "POST",
        send_url,
        bearer=api_key,
        body_dict={"to": to, "message": text},
    )
    ok, err = _interpret_response(st, raw, expect_json=True)
    meta = _success_meta(st, raw, endpoint="/api/v1/sms/send/")
    if ok:
        return True, "", {"provider": "infelo", **meta}
    return False, err, {"provider": "infelo", "endpoint": "/api/v1/sms/send/", "status": st, "error": err, **meta}


def _success_meta(status: int, raw: str, *, endpoint: str) -> dict[str, Any]:
    out: dict[str, Any] = {"endpoint": endpoint, "status": status}
    raw = (raw or "").strip()
    if not raw:
        return out
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            for k in ("id", "status", "to_number", "credits_used", "sent_at"):
                if k in data:
                    out[k] = data[k]
    except json.JSONDecodeError:
        pass
    return out


def _interpret_response(status: int, raw: str, *, expect_json: bool) -> tuple[bool, str]:
    if status == 429:
        return False, "Infelo SMS rate limit (HTTP 429); retry later."
    if status == 401:
        return False, "Infelo SMS unauthorized (HTTP 401); check INFELO_API_KEY in settings."
    if status == 403:
        return False, "Infelo account suspended or forbidden (HTTP 403)."
    if status == 503:
        return False, "Infelo gateway not configured (HTTP 503)."
    if status == 502:
        return False, "Infelo gateway error (HTTP 502)."
    if status == 400:
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and data.get("detail"):
                return False, str(data["detail"])[:500]
        except json.JSONDecodeError:
            pass
        return False, (raw or "Bad request (HTTP 400).")[:500]
    if 200 <= status < 300:
        raw = raw.strip()
        if not raw:
            return True, ""
        if expect_json:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                return False, raw[:500]
            if isinstance(data, dict) and data.get("detail"):
                return False, str(data["detail"])[:500]
            return True, ""
        return True, ""
    if raw.lstrip().startswith("<!DOCTYPE") or raw.lstrip().startswith("<html"):
        return False, f"Infelo SMS HTTP {status} (unexpected HTML response)."
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "detail" in data:
            return False, str(data["detail"])[:500]
    except json.JSONDecodeError:
        pass
    return False, (raw or f"HTTP {status}")[:500]
