const STORAGE_KEY = 'fooddelivery:favorite-product-ids';

export function readFavoriteProductIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  } catch {
    return [];
  }
}

export function isProductFavorited(productId: number): boolean {
  return readFavoriteProductIds().includes(productId);
}

/** Persists toggle and returns the updated id list. */
export function toggleFavoriteProductId(productId: number): number[] {
  const current = readFavoriteProductIds();
  const has = current.includes(productId);
  const next = has ? current.filter(id => id !== productId) : [...current, productId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
