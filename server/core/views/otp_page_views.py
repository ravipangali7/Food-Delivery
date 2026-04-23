"""Server-rendered OTP send / verify flow (CSRF-safe same-origin forms)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.db import IntegrityError
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods

from .. import otp_service
from ..forms.otp_forms import OtpSendForm, OtpVerifyForm
from ..models import User
from ..sms_service import send_otp_sms_checked

SESSION_PREFIX = "otp_web"
SESSION_SENT = f"{SESSION_PREFIX}_sent"
SESSION_PHONE = f"{SESSION_PREFIX}_phone"
SESSION_PURPOSE = f"{SESSION_PREFIX}_purpose"
SESSION_NAME = f"{SESSION_PREFIX}_name"

logger = logging.getLogger(__name__)


def _session_clear(request) -> None:
    for k in (SESSION_SENT, SESSION_PHONE, SESSION_PURPOSE, SESSION_NAME):
        request.session.pop(k, None)


@require_http_methods(["GET", "POST"])
def otp_verification_page(request):
    """
    Step 1: enter phone and purpose → SMS OTP.
    Step 2: enter code → session login (and optional API token on success page).
    """
    sent = request.session.get(SESSION_SENT)
    context: dict = {"step": "verify" if sent else "send", "debug": settings.DEBUG}

    if request.method == "POST":
        action = request.POST.get("action") or ""

        if action == "restart":
            _session_clear(request)
            messages.info(request, "Start again with your phone number.")
            return redirect("otp_verification")

        if action == "resend":
            if not request.session.get(SESSION_PHONE):
                messages.error(request, "Session expired. Enter your phone again.")
                return redirect("otp_verification")
            return _handle_resend(request)

        if action == "verify" or (not action and sent):
            return _handle_verify(request, context)

        # default: send
        return _handle_send(request, context)

    # GET
    if sent:
        context["verify_form"] = OtpVerifyForm()
        context["masked_phone"] = _mask_phone(request.session.get(SESSION_PHONE, ""))
        context["purpose"] = request.session.get(SESSION_PURPOSE)
        return render(request, "core/otp/verification.html", context)

    context["send_form"] = OtpSendForm()
    return render(request, "core/otp/verification.html", context)


def _mask_phone(phone: str) -> str:
    if len(phone) <= 4:
        return "••••"
    return phone[:3] + "•" * max(0, len(phone) - 6) + phone[-3:]


def _handle_send(request, context) -> redirect | render:
    form = OtpSendForm(request.POST)
    if not form.is_valid():
        context["step"] = "send"
        context["send_form"] = form
        return render(request, "core/otp/verification.html", context)

    phone = form.cleaned_data["phone"]
    purpose = form.cleaned_data["purpose"]
    user_for_row: User | None = None
    if purpose == "login":
        user_for_row = User.objects.filter(phone=phone, deleted_at__isnull=True).first()
        if user_for_row is not None and not user_for_row.is_active:
            messages.error(request, "This account is disabled.")
            context["step"] = "send"
            context["send_form"] = form
            return render(request, "core/otp/verification.html", context)
    name = form.cleaned_data.get("name") or ""

    result = otp_service.create_and_store_otp(
        phone_raw=phone,
        purpose=purpose,
        user=user_for_row,
    )
    sms_ok, sms_err, _sms_meta = send_otp_sms_checked(phone=phone, code=result.otp_code, purpose=purpose)
    if not sms_ok:
        logger.warning("OTP web SMS send failed for %s: %s", phone, sms_err)

    request.session[SESSION_SENT] = True
    request.session[SESSION_PHONE] = phone
    request.session[SESSION_PURPOSE] = purpose
    request.session[SESSION_NAME] = name if purpose == "register" else (name.strip() if name else "")
    if sms_ok:
        messages.success(request, "We sent a verification code to your phone via SMS.")
    else:
        messages.warning(
            request,
            "SMS could not be sent right now. If you receive a code (or use a test environment), "
            f"enter it on the next step. ({sms_err or 'unknown error'})",
        )
    return redirect("otp_verification")


def _handle_resend(request) -> redirect:
    phone = request.session.get(SESSION_PHONE)
    purpose = request.session.get(SESSION_PURPOSE)
    if not phone or not purpose:
        messages.error(request, "Session expired.")
        _session_clear(request)
        return redirect("otp_verification")

    user_for_row: User | None = None
    if purpose == "login":
        user_for_row = User.objects.filter(phone=phone, deleted_at__isnull=True).first()
        if user_for_row is not None and not user_for_row.is_active:
            messages.error(request, "This account is disabled.")
            _session_clear(request)
            return redirect("otp_verification")
    elif User.objects.filter(phone=phone, deleted_at__isnull=True).exists():
        messages.error(request, "This phone is already registered.")
        _session_clear(request)
        return redirect("otp_verification")

    result = otp_service.create_and_store_otp(
        phone_raw=phone,
        purpose=purpose,
        user=user_for_row,
    )
    sms_ok, sms_err, _sms_meta = send_otp_sms_checked(phone=phone, code=result.otp_code, purpose=purpose)
    if not sms_ok:
        logger.warning("OTP web SMS resend failed for %s: %s", phone, sms_err)
        messages.warning(
            request,
            f"SMS resend failed: {sms_err or 'unknown error'}. You can try again later; your previous code may still work until it expires.",
        )
        return redirect("otp_verification")
    messages.success(request, "A new code was sent.")
    return redirect("otp_verification")


def _handle_verify(request, context) -> redirect | render:
    if not request.session.get(SESSION_SENT):
        messages.error(request, "Request a code first.")
        return redirect("otp_verification")

    form = OtpVerifyForm(request.POST)
    phone = request.session.get(SESSION_PHONE)
    purpose = request.session.get(SESSION_PURPOSE)
    name = request.session.get(SESSION_NAME) or ""

    if not form.is_valid():
        context["step"] = "verify"
        context["verify_form"] = form
        context["masked_phone"] = _mask_phone(phone or "")
        context["purpose"] = purpose
        return render(request, "core/otp/verification.html", context)

    code = form.cleaned_data["otp"]
    try:
        otp_obj = otp_service.verify_otp_code(phone_raw=phone, purpose=purpose, code=code)
        user = otp_service.complete_auth_after_otp_verified(
            otp_obj=otp_obj,
            purpose=purpose,
            register_name=name if purpose == "register" else (name.strip() if name else None),
        )
    except otp_service.VerifyOtpError as e:
        messages.error(request, str(e))
        context["step"] = "verify"
        context["verify_form"] = OtpVerifyForm()
        context["masked_phone"] = _mask_phone(phone or "")
        context["purpose"] = purpose
        return render(request, "core/otp/verification.html", context)
    except IntegrityError:
        messages.error(request, "Could not create account. Try again.")
        context["step"] = "verify"
        context["verify_form"] = OtpVerifyForm()
        context["masked_phone"] = _mask_phone(phone or "")
        context["purpose"] = purpose
        return render(request, "core/otp/verification.html", context)

    _session_clear(request)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")

    from rest_framework.authtoken.models import Token

    token, _ = Token.objects.get_or_create(user=user)
    return render(
        request,
        "core/otp/success.html",
        {
            "user": user,
            "api_token": token.key,
            "debug": settings.DEBUG,
        },
    )


def otp_help(request):
    """Short explanation of CSRF + SPA vs this page."""
    return render(request, "core/otp/csrf_help.html")
