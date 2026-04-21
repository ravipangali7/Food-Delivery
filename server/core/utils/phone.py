from __future__ import annotations


def normalize_phone(value: str) -> str:
    """Keep digits only for consistent storage and lookup."""
    return "".join(c for c in (value or "") if c.isdigit())
