"""
Infelo — account Bearer बाट Google Maps JavaScript API key (infelo-api-map.md हेर्नुहोस्)।

``GET /api/v1/google-goods/maps-js-api-key/`` ब्राउजर प्रयोगका लागि ``maps_api_key`` फर्काउँछ।
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

# सफल key cache गर्ने सेकेन्ड (५–१५ मिनेट; योजना: ~१०)
_INFELO_MAPS_CACHE_TTL = 600.0

# Infelo ले 401/403/503 फर्काएमा बारम्बार नहान्ने: छोटो negative cache
_INFELO_MAPS_ERROR_TTL = 60.0


def get_infelo_google_maps_api_key() -> tuple[str | None, str | None, int | None]:
    """
    (google_maps_key, error_message, suggested_http_status) फर्काउँछ।

    सफल: (key, None, 200)। असफल: (None, message, 401/403/503/502/500)।
    छोटो in-process cache प्रयोग गर्छ।
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
