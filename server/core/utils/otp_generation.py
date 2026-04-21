"""Cryptographically strong OTP generation (4–6 digits)."""

from __future__ import annotations

import secrets


def generate_otp_code() -> str:
    """Return a numeric OTP string of random length between 4 and 6 inclusive."""
    length = secrets.randbelow(3) + 4
    return "".join(str(secrets.randbelow(10)) for _ in range(length))
