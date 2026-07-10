"""Pre-order eligibility — sweets and cakes categories only."""
from __future__ import annotations

from .models import Product

PREORDER_CATEGORY_TOKENS = ("sweet", "cake")


def _name_matches_preorder_category(name: str | None) -> bool:
    lower = (name or "").strip().lower()
    if not lower:
        return False
    return any(token in lower for token in PREORDER_CATEGORY_TOKENS)


def product_allows_preorder(product: Product) -> bool:
    """Return True when the product may be added as a pre-order line."""
    if product.is_sweet:
        return True
    cat = getattr(product, "category", None)
    if cat is None:
        return False
    if _name_matches_preorder_category(cat.name) or _name_matches_preorder_category(cat.slug):
        return True
    parent = getattr(cat, "parent", None)
    if parent is None:
        return False
    return _name_matches_preorder_category(parent.name) or _name_matches_preorder_category(parent.slug)
