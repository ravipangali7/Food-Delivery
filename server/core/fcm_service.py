"""
Firebase Cloud Messaging (FCM) for admin broadcast and transactional pushes.

Uses the legacy HTTP API (Authorization: key=...) when ``FCM_SERVER_KEY`` is set.
When unset, logs and reports success without sending.

See: https://firebase.google.com/docs/cloud-messaging/http-server-ref
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

FCM_LEGACY_URL = "https://fcm.googleapis.com/fcm/send"


def _fcm_configured() -> bool:
    key = getattr(settings, "FCM_SERVER_KEY", "") or ""
    return bool(key.strip())


def send_push_to_token(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> tuple[bool, str | None]:
    """
    Send a data+notification payload to one device. Returns (ok, error_detail).
    """
    if not token or not token.strip():
        return False, "Missing FCM token"

    if not _fcm_configured() or getattr(settings, "FCM_DISABLE_SEND", False):
        logger.info(
            "[FCM dev] to=%s title=%r body=%r data=%s",
            token[:20] + "…",
            title,
            body[:80],
            data,
        )
        return True, None

    payload: dict[str, Any] = {
        "to": token.strip(),
        "priority": "high",
        "content_available": True,
        "notification": {
            "title": title,
            "body": body,
            "sound": "default",
        },
        "data": {k: str(v) for k, v in (data or {}).items()},
    }

    return _post_fcm_legacy(payload)


def send_push_multicast(
    *,
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> list[tuple[str, bool, str | None]]:
    """
    Send the same notification to many registration tokens (chunked).
    Returns a list of (token, success, error_message) aligned with ``tokens``.
    """
    cleaned = [t.strip() for t in tokens if t and t.strip()]
    if not cleaned:
        return []

    if not _fcm_configured() or getattr(settings, "FCM_DISABLE_SEND", False):
        logger.info(
            "[FCM dev] multicast %s devices title=%r body=%r",
            len(cleaned),
            title,
            (body or "")[:120],
        )
        return [(t, True, None) for t in cleaned]

    # Real API: batch with registration_ids (legacy supports up to 1000)
    chunk_size = 500
    results: list[tuple[str, bool, str | None]] = []
    flat_data = {k: str(v) for k, v in (data or {}).items()}

    for i in range(0, len(cleaned), chunk_size):
        chunk = cleaned[i : i + chunk_size]
        payload: dict[str, Any] = {
            "registration_ids": chunk,
            "priority": "high",
            "content_available": True,
            "notification": {
                "title": title,
                "body": body,
                "sound": "default",
            },
            "data": flat_data,
        }
        raw_ok, raw_err, per_results = _post_fcm_legacy_multicast(payload, len(chunk))
        if not raw_ok or per_results is None:
            for t in chunk:
                results.append((t, False, raw_err or "FCM request failed"))
            continue
        for j, t in enumerate(chunk):
            if j < len(per_results):
                r = per_results[j]
                err = r.get("error")
                if err:
                    results.append((t, False, err))
                else:
                    results.append((t, True, None))
            else:
                results.append((t, False, "Missing FCM result"))
    return results


def _post_fcm_legacy(payload: dict[str, Any]) -> tuple[bool, str | None]:
    key = (getattr(settings, "FCM_SERVER_KEY", "") or "").strip()
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        FCM_LEGACY_URL,
        data=body,
        headers={
            "Authorization": f"key={key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8")
        except Exception:
            detail = str(e)
        logger.warning("FCM HTTP error: %s %s", e.code, detail)
        return False, detail[:500]
    except OSError as e:
        logger.exception("FCM network error")
        return False, str(e)[:500]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return False, raw[:500]

    if parsed.get("failure") == 1 and isinstance(parsed.get("results"), list):
        err = parsed["results"][0].get("error", "Unknown error")
        return False, err
    if parsed.get("success") == 1 or parsed.get("message_id"):
        return True, None
    return False, raw[:500]


def _post_fcm_legacy_multicast(
    payload: dict[str, Any], expect: int
) -> tuple[bool, str | None, list[dict[str, Any]] | None]:
    key = (getattr(settings, "FCM_SERVER_KEY", "") or "").strip()
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        FCM_LEGACY_URL,
        data=body,
        headers={
            "Authorization": f"key={key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8")
        except Exception:
            detail = str(e)
        return False, detail[:500], None
    except OSError as e:
        return False, str(e)[:500], None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return False, raw[:500], None

    results = parsed.get("results")
    if isinstance(results, list):
        return True, None, results
    return False, raw[:500], None
