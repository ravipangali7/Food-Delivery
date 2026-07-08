"""क्रिप्टोग्राफिक रूपमा बलियो OTP generation (६ अङ्क)।"""

from __future__ import annotations

import secrets


def generate_otp_code() -> str:
    """ठ्याक्कै ६ अङ्कको शून्य-padded संख्यात्मक OTP string फर्काउनुहोस्।"""
    return f"{secrets.randbelow(1_000_000):06d}"
