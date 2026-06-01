import { num } from '@/lib/formatting';
import type { Cart, CartItem, Product, ProductVariant } from '@/types';

const STORAGE_KEY = 'fd_guest_cart';

export const GUEST_CART_EVENT = 'fd_guest_cart_change';

function notifyGuestCartChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GUEST_CART_EVENT));
  }
}

export type GuestCartLine = {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  notes?: string;
  is_preorder?: boolean;
  unit_price: number;
  product?: Pick<
    Product,
    'id' | 'name' | 'slug' | 'thumbnail_url' | 'images' | 'unit' | 'effective_price' | 'is_sweet'
  >;
  variant?: ProductVariant;
};

export function readGuestCart(): GuestCartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is GuestCartLine =>
        typeof row === 'object' &&
        row !== null &&
        typeof (row as GuestCartLine).product_id === 'number' &&
        typeof (row as GuestCartLine).quantity === 'number',
    );
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: GuestCartLine[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  notifyGuestCartChange();
}

export function clearGuestCart(): void {
  localStorage.removeItem(STORAGE_KEY);
  notifyGuestCartChange();
}

export function guestCartToCart(lines: GuestCartLine[]): Cart {
  const items: CartItem[] = lines.map((line, index) => {
    const unit = num(line.unit_price);
    const qty = line.quantity;
    return {
      id: -(index + 1),
      cart_id: 0,
      product_id: line.product_id,
      variant_id: line.variant_id ?? null,
      quantity: qty,
      unit_price: unit,
      total_price: unit * qty,
      notes: line.notes,
      is_preorder: line.is_preorder,
      created_at: '',
      updated_at: '',
      product: line.product as Product | undefined,
      variant: line.variant as ProductVariant | undefined,
    };
  });
  const subtotal = items.reduce((sum, i) => sum + num(i.total_price), 0);
  return {
    id: 0,
    user_id: 0,
    subtotal,
    total: subtotal,
    created_at: '',
    updated_at: '',
    items,
  };
}

export function upsertGuestLine(
  lines: GuestCartLine[],
  product: Product,
  quantity: number,
  opts?: { notes?: string; is_preorder?: boolean; variant_id?: number | null; unit_price?: number; variant?: ProductVariant | null },
): GuestCartLine[] {
  const variantId = opts?.variant_id ?? null;
  const unit = opts?.unit_price ?? num(product.effective_price ?? product.price);
  const idx = lines.findIndex(
    l =>
      l.product_id === product.id &&
      (l.variant_id ?? null) === variantId &&
      Boolean(l.is_preorder) === Boolean(opts?.is_preorder),
  );
  const next: GuestCartLine = {
    product_id: product.id,
    variant_id: variantId,
    quantity,
    notes: opts?.notes,
    is_preorder: opts?.is_preorder,
    unit_price: unit,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      thumbnail_url: product.thumbnail_url,
      images: product.images,
      unit: opts?.variant?.unit ?? product.unit,
      effective_price: product.effective_price,
      is_sweet: product.is_sweet,
    },
    variant: opts?.variant ?? undefined,
  };
  if (idx >= 0) {
    const copy = [...lines];
    copy[idx] = { ...copy[idx], ...next };
    return copy;
  }
  return [...lines, next];
}

export function guestLinesForCheckout(lines: GuestCartLine[]) {
  return lines.map(l => ({
    product_id: l.product_id,
    variant_id: l.variant_id ?? null,
    quantity: l.quantity,
    notes: l.notes,
    is_preorder: l.is_preorder,
  }));
}
