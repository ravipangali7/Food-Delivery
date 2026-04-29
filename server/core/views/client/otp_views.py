"""OTP send/verify API (phone login and registration)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ... import otp_service
from ...models import User
from ...sms_service import send_otp_sms_checked
from ...serializers import (
    FlutterPhoneAutoLoginSerializer,
    OtpSendSerializer,
    OtpVerifySerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([AllowAny])
def send_otp(request):
    ser = OtpSendSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    phone = ser.validated_data["phone"]
    purpose = ser.validated_data["purpose"]

    user_for_row: User | None = None
    if purpose == "login":
        user_for_row = User.objects.filter(phone=phone, deleted_at__isnull=True).first()
        if user_for_row is not None and not user_for_row.is_active:
            return Response(
                {"detail": "This account is disabled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif User.objects.filter(phone=phone, deleted_at__isnull=True).exists():
        return Response(
            {"detail": "An account with this phone already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = otp_service.create_and_store_otp(
        phone_raw=phone,
        purpose=purpose,
        user=user_for_row,
    )
    sms_ok, sms_err, sms_meta = send_otp_sms_checked(phone=phone, code=result.otp_code, purpose=purpose)
    if not sms_ok:
        logger.warning("OTP SMS delivery failed for %s: %s", phone, sms_err)

    body: dict = {
        "detail": "Verification code sent." if sms_ok else (
            "We could not send the verification SMS right now. Try resend or enter the code when it arrives."
        ),
        "sms_delivered": sms_ok,
    }
    if not sms_ok:
        body["sms_error"] = sms_err or "SMS send failed"
        body["sms_provider"] = sms_meta.get("provider")
        if settings.DEBUG:
            body["infelo_response"] = sms_meta
    if purpose == "login" and user_for_row is not None:
        saved = (user_for_row.name or "").strip()
        if saved:
            body["existing_user_name"] = saved
    if settings.DEBUG:
        body["otp_code"] = result.otp_code
        body["expires_in_seconds"] = otp_service.OTP_VALID_MINUTES * 60
        if sms_ok:
            body["infelo_response"] = sms_meta
    return Response(body, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp(request):
    ser = OtpVerifySerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    phone = ser.validated_data["phone"]
    purpose = ser.validated_data["purpose"]
    code = ser.validated_data["otp"]

    try:
        otp_obj = otp_service.verify_otp_code(phone_raw=phone, purpose=purpose, code=code)
        user = otp_service.complete_auth_after_otp_verified(
            otp_obj=otp_obj,
            purpose=purpose,
            register_name=ser.validated_data.get("name"),
        )
    except otp_service.VerifyOtpError as e:
        msg = str(e)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    except IntegrityError:
        return Response(
            {"detail": "Could not create account. Try again."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data})


@api_view(["POST"])
@permission_classes([AllowAny])
def flutter_phone_login(request):
    """
    Flutter WebView bootstrap login:
    accepts only phone and returns a DRF token for that active user.
    """
    try:
        ser = FlutterPhoneAutoLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        phone = ser.validated_data["phone"]
        user = User.objects.filter(phone=phone, deleted_at__isnull=True).first()
        if user is None:
            logger.info("flutter_phone_login failed: account not found phone=%s", phone)
            return Response(
                {
                    "detail": "Account not found for this phone.",
                    "code": "account_not_found",
                    "retryable": False,
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        if not user.is_active:
            logger.info("flutter_phone_login failed: inactive account user_id=%s phone=%s", user.id, phone)
            return Response(
                {
                    "detail": "This account is disabled.",
                    "code": "account_disabled",
                    "retryable": False,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        token, _ = Token.objects.get_or_create(user=user)
        logger.info("flutter_phone_login success user_id=%s phone=%s", user.id, phone)
        return Response({"token": token.key, "user": UserSerializer(user).data})
    except Exception as exc:
        if isinstance(exc, APIException):
            raise
        logger.exception("flutter_phone_login unexpected error")
        return Response(
            {
                "detail": "Unable to restore session right now.",
                "code": "restore_temporarily_unavailable",
                "retryable": True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
