"""
Infelo — Google Maps JavaScript API key via account Bearer (see infelo-api-map.md).

``GET /api/v1/google-goods/maps-js-api-key/`` returns ``maps_api_key`` for browser use.
"""

from __future__ import annotations

import json
import time
from typing import Any
from urllib.parse import urljoin

from django.conf import settings

from .infelo_sms import _resolved_api_base, _urllib_json_request

_CACHE: dict[str, Any] = {
    "key": None,  # str | None
    "expires": 0.0,
    "last_err": None,  # str | None
    "last_status": 503,  # int
}

# Seconds to cache a successful key (5–15 min; plan: ~10)
_INFELO_MAPS_CACHE_TTL = 600.0

# If Infelo returns 401/403/503, avoid hammering: short negative cache
_INFELO_MAPS_ERROR_TTL = 60.0


def get_infelo_google_maps_api_key() -> tuple[str | None, str | None, int | None]:
    """
    Return (google_maps_key, error_message, suggested_http_status).

    On success: (key, None, 200). On failure: (None, message, 401/403/503/502/500).
    Uses a short in-process cache.
    """
    now = time.monotonic()
    if _CACHE["key"] and now < _CACHE["expires"]:
        return str(_CACHE["key"]), None, 200
    if _CACHE["key"] is None and _CACHE["last_err"] and now < _CACHE["expires"]:
        return None, _CACHE["last_err"], _CACHE["last_status"]  # type: ignore[return-value]

    api_key = (getattr(settings, "INFELO_API_KEY", None) or getattr(settings, "INFELO_SMS_API_KEY", None) or "").strip()
    if not api_key:
        _set_error_cache("Set INFELO_API_KEY in settings.", 503, _INFELO_MAPS_ERROR_TTL, now)
        return None, "Set INFELO_API_KEY in settings.", 503

    base = _resolved_api_base()
    url = urljoin(base + "/", "v1/google-goods/maps-js-api-key/")
    st, raw = _urllib_json_request("GET", url, bearer=api_key)
    if 200 <= st < 300:
        try:
            data = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            _set_error_cache("Invalid response from Infelo for maps key.", 502, _INFELO_MAPS_ERROR_TTL, now)
            return None, "Invalid response from Infelo for maps key.", 502
        gk = data.get("maps_api_key")
        if isinstance(gk, str) and gk.strip():
            _CACHE["key"] = gk.strip()
            _CACHE["expires"] = now + _INFELO_MAPS_CACHE_TTL
            _CACHE["last_err"] = None
            _CACHE["last_status"] = 200
            return _CACHE["key"], None, 200
        _set_error_cache("Infelo did not return maps_api_key.", 502, _INFELO_MAPS_ERROR_TTL, now)
        return None, "Infelo did not return maps_api_key.", 502

    msg, status = _maps_error_map(st, raw)
    _set_error_cache(msg, status, _INFELO_MAPS_ERROR_TTL, now)
    return None, msg, status


def _set_error_cache(msg: str, status: int, ttl: float, now: float) -> None:
    _CACHE["key"] = None
    _CACHE["last_err"] = msg
    _CACHE["last_status"] = status
    _CACHE["expires"] = now + ttl


def _maps_error_map(status: int, raw: str) -> tuple[str, int]:
    if status == 401:
        return "Infelo maps: unauthorized; check INFELO_API_KEY.", 401
    if status == 403:
        return "Infelo maps: no active map subscription or account suspended (HTTP 403).", 403
    if status == 503:
        return "Infelo platform Maps key is not configured yet (HTTP 503). Contact support.", 503
    if status == 0:
        return f"Infelo maps request failed: {raw[:200]}", 502
    return f"Infelo maps HTTP {status}.", 502
