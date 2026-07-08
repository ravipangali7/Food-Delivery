from __future__ import annotations


def normalize_phone(value: str) -> str:
    """संग्रह र खोजका लागि अङ्क मात्र राख्नुहोस्।"""
    return "".join(c for c in (value or "") if c.isdigit())
