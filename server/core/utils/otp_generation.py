"""Cryptographically strong OTP generation (6 digits)."""

from __future__ import annotations

import secrets


def generate_otp_code() -> str:
    """Return a zero-padded numeric OTP string of exactly 6 digits."""
    return f"{secrets.randbelow(1_000_000):06d}"
