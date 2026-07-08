"""सफा API error response — उत्पादनमा framework internal विवरण छैन।"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# उत्पादनमा generic सन्देश — internal stack trace वा framework नाम नदेखाउने।
_GENERIC_SERVER_ERROR = "A server error occurred. Please try again later."
_GENERIC_NOT_FOUND = "The requested resource was not found."
_GENERIC_FORBIDDEN = "You do not have permission to perform this action."


def _sanitize_detail(detail) -> str | dict | list:
    if isinstance(detail, (list, dict)):
        return detail
    text = str(detail)
    if settings.DEBUG:
        return text
    lowered = text.lower()
    for needle in (
        "django",
        "rest framework",
        "traceback",
        "exception",
        "sql",
        "doesnotexist",
        "integrityerror",
        "validationerror",
    ):
        if needle in lowered:
            return _GENERIC_SERVER_ERROR
    return text


def api_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = APIException(detail=_GENERIC_NOT_FOUND)
        exc.status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, PermissionDenied):
        exc = APIException(detail=_GENERIC_FORBIDDEN)
        exc.status_code = status.HTTP_403_FORBIDDEN

    response = drf_exception_handler(exc, context)

    if response is None:
        if not settings.DEBUG:
            logger.exception("Unhandled API error", exc_info=exc)
            return Response(
                {"detail": _GENERIC_SERVER_ERROR},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return None

    if not settings.DEBUG and response.status_code >= 500:
        logger.exception("API server error", exc_info=exc)
        response.data = {"detail": _GENERIC_SERVER_ERROR}
        return response

    if isinstance(response.data, dict):
        if "detail" in response.data:
            response.data["detail"] = _sanitize_detail(response.data["detail"])
        else:
            response.data = {key: _sanitize_detail(value) for key, value in response.data.items()}

    return response
