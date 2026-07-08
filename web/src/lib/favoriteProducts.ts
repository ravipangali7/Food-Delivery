const STORAGE_KEY = 'ss_favorite_product_ids';
const LEGACY_STORAGE_KEY = 'fooddelivery:favorite-product-ids';

function readStorageKey(): string {
  if (typeof window === 'undefined') return STORAGE_KEY;
  if (localStorage.getItem(STORAGE_KEY) !== null) return STORAGE_KEY;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy !== null) {
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return STORAGE_KEY;
}

export function readFavoriteProductIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(readStorageKey());
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

/** toggle स्थायी गर्छ र अद्यावधिक id सूची फर्काउँछ। */
export function toggleFavoriteProductId(productId: number): number[] {
  const current = readFavoriteProductIds();
  const has = current.includes(productId);
  const next = has ? current.filter(id => id !== productId) : [...current, productId];
  localStorage.setItem(readStorageKey(), JSON.stringify(next));
  return next;
}
