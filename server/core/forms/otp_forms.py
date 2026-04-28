from __future__ import annotations

from django import forms

from ..models import User
from ..utils.phone import normalize_phone


class OtpSendForm(forms.Form):
    phone = forms.CharField(max_length=15, label="Phone number")
    purpose = forms.ChoiceField(
        choices=(("login", "Sign in"), ("register", "Create account")),
        label="I want to",
    )
    name = forms.CharField(
        max_length=100,
        required=False,
        label="Full name",
        help_text="Required when creating an account.",
    )

    def clean_phone(self) -> str:
        digits = normalize_phone(self.cleaned_data["phone"])
        if len(digits) < 7 or len(digits) > 15:
            raise forms.ValidationError("Enter a valid phone number.")
        return digits

    def clean(self):
        cleaned = super().clean()
        if not cleaned:
            return cleaned
        purpose = cleaned.get("purpose")
        phone = cleaned.get("phone")
        name = (cleaned.get("name") or "").strip()
        if purpose == "register":
            if len(name) < 2:
                self.add_error("name", "Enter your full name.")
            else:
                cleaned["name"] = name
            if phone and User.objects.filter(phone=phone, deleted_at__isnull=True).exists():
                self.add_error("phone", "An account with this phone already exists.")
        elif purpose == "login" and phone:
            u = User.objects.filter(phone=phone, deleted_at__isnull=True).first()
            if u is not None and not u.is_active:
                self.add_error("phone", "This account is disabled.")
        return cleaned


class OtpVerifyForm(forms.Form):
    otp = forms.CharField(
        max_length=6,
        min_length=6,
        label="Verification code",
        help_text="Enter the code we sent by SMS.",
    )

    def clean_otp(self) -> str:
        otp = str(self.cleaned_data["otp"]).strip()
        if not otp.isdigit():
            raise forms.ValidationError("Enter a valid 6-digit code.")
        return otp
