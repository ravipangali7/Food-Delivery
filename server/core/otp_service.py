"""
OTP issuance and verification backed by :class:`~core.models.OTPVerification`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

from django.db import transaction
from django.utils import timezone

from .models import OTPVerification, User
from .utils.otp_generation import generate_otp_code
from .utils.phone import normalize_phone

Purpose = Literal["login", "register"]

OTP_VALID_MINUTES = 5


@dataclass(frozen=True)
class SendOtpResult:
    otp_record: OTPVerification
    otp_code: str  # for mock delivery / logging only


def _invalidate_pending_for_phone_purpose(phone: str, purpose: str) -> None:
    now = timezone.now()
    OTPVerification.objects.filter(
        phone_number=phone,
        purpose=purpose,
        is_verified=False,
        expires_at__gt=now,
    ).update(expires_at=now)


@transaction.atomic
def create_and_store_otp(
    *,
    phone_raw: str,
    purpose: Purpose,
    user: User | None = None,
) -> SendOtpResult:
    phone = normalize_phone(phone_raw)
    _invalidate_pending_for_phone_purpose(phone, purpose)
    code = generate_otp_code()
    now = timezone.now()
    expires = now + timedelta(minutes=OTP_VALID_MINUTES)
    rec = OTPVerification.objects.create(
        user=user,
        phone_number=phone,
        otp_code=code,
        purpose=purpose,
        is_verified=False,
        expires_at=expires,
    )
    return SendOtpResult(otp_record=rec, otp_code=code)


@dataclass(frozen=True)
class VerifySuccess:
    otp: OTPVerification
    user: User


class VerifyOtpError(Exception):
    """Invalid, expired, reused, or business-rule failure."""


def verify_otp_code(
    *,
    phone_raw: str,
    purpose: Purpose,
    code: str,
) -> OTPVerification:
    phone = normalize_phone(phone_raw)
    trimmed = str(code).strip()
    now = timezone.now()
    with transaction.atomic():
        qs = (
            OTPVerification.objects.select_for_update()
            .filter(
                phone_number=phone,
                purpose=purpose,
                is_verified=False,
                expires_at__gt=now,
            )
            .order_by("-created_at")
        )
        otp_obj = qs.first()
        if otp_obj is None:
            raise VerifyOtpError("Invalid or expired code.")
        if not _constant_time_code_match(otp_obj.otp_code, trimmed):
            raise VerifyOtpError("Invalid or expired code.")
        otp_obj.is_verified = True
        otp_obj.save(update_fields=["is_verified"])
        return otp_obj


def _constant_time_code_match(expected: str, provided: str) -> bool:
    import secrets

    if len(expected) != len(provided):
        return False
    return secrets.compare_digest(expected.encode(), provided.encode())


@transaction.atomic
def complete_auth_after_otp_verified(
    *,
    otp_obj: OTPVerification,
    purpose: Purpose,
    register_name: str | None = None,
) -> User:
    """
    After OTP is verified, perform login (existing user) or registration (new user).
    """
    phone = otp_obj.phone_number
    if purpose == "login":
        user = None
        try:
            user = User.objects.select_for_update().get(phone=phone, deleted_at__isnull=True)
        except User.DoesNotExist:
            # Phone may have been updated in admin after OTP was sent; OTP still ties to the account.
            if otp_obj.user_id is not None:
                try:
                    user = User.objects.select_for_update().get(
                        pk=otp_obj.user_id, deleted_at__isnull=True
                    )
                except User.DoesNotExist:
                    user = None
            if user is None:
                name = (register_name or "").strip()
                if len(name) >= 2:
                    if User.objects.filter(phone=phone, deleted_at__isnull=True).exists():
                        raise VerifyOtpError("An account with this phone already exists.")
                    user = User(phone=phone, name=name)
                    user.set_unusable_password()
                    user.save()
                    otp_obj.user = user
                    otp_obj.save(update_fields=["user"])
                    return user
                raise VerifyOtpError(
                    "No account for this phone yet. Add your full name and verify again, "
                    "or use Sign up to create an account."
                )
        if not user.is_active:
            raise VerifyOtpError("This account is disabled.")
        if otp_obj.user_id is None:
            otp_obj.user = user
            otp_obj.save(update_fields=["user"])
        return user

    if User.objects.filter(phone=phone, deleted_at__isnull=True).exists():
        raise VerifyOtpError("An account with this phone already exists.")
    name = (register_name or "").strip()
    if len(name) < 2:
        raise VerifyOtpError("Enter your full name.")
    user = User(phone=phone, name=name)
    user.set_unusable_password()
    user.save()
    otp_obj.user = user
    otp_obj.save(update_fields=["user"])
    return user
