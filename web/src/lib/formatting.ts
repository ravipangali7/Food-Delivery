import type { OrderPaymentStatus, Product, ProductPurchaseOption } from '@/types';

/** अर्डर भुक्तानी सङ्कलन स्थितिको प्रदर्शन लेबल (COD)। */
export function orderPaymentStatusLabel(status: OrderPaymentStatus): string {
  return status === 'paid' ? 'Paid' : 'Pending';
}

export function num(v: number | string | undefined | null): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

/** उत्पादन एकाइको प्रदर्शन लेबल (API बाट nested object)। */
export function unitLabel(product: Pick<Product, 'unit'>): string {
  const u = product.unit;
  return u?.name ?? '';
}

export function unitLabelFromUnit(unit: Product['unit'] | undefined): string {
  return unit?.name ?? '';
}

/** खरिद विकल्प वा variant पङ्क्तिको प्रभावकारी मूल्य। */
export function getOptionEffectivePrice(
  option: Pick<ProductPurchaseOption, 'effective_price' | 'price'>,
): number {
  if (option.effective_price != null && option.effective_price !== '') {
    return num(option.effective_price);
  }
  return num(option.price);
}

/** API `effective_price` parse (string हुन सक्छ) र NPR मा प्रदर्शन मूल्य गणना। */
export function getEffectivePrice(product: Product): number {
  if (product.effective_price != null && product.effective_price !== '') {
    const n = num(product.effective_price);
    if (n > 0 || product.effective_price === '0' || product.effective_price === 0) return n;
  }
  const price = num(product.price);
  const disc = num(product.discount_value);
  if (disc <= 0) return price;
  const dtype = product.discount_type ?? 'flat';
  if (dtype === 'percentage') {
    const pct = Math.min(disc, 100);
    return Math.max(0, price - (price * pct) / 100);
  }
  return Math.max(0, price - disc);
}

/** admin उत्पादन फर्मको live preview (सर्भर नियमसँग मिल्छ)। */
export function computeEffectivePreview(
  price: number,
  discountType: 'flat' | 'percentage',
  discountValue: number,
): number {
  const p = Math.max(0, price);
  if (!discountValue || discountValue <= 0) return p;
  if (discountType === 'percentage') {
    const pct = Math.min(discountValue, 100);
    return Math.max(0, p - (p * pct) / 100);
  }
  return Math.max(0, p - discountValue);
}

export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** `isoA` र `isoB` को UTC मितिबीच पूरा क्यालेन्डर दिन (ऋणात्मक हुन सक्छ)। */
export function calendarDaysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA);
  const b = new Date(isoB);
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((end - start) / 86400000);
}

/** आजको UTC मितिदेखि `iso` को UTC मितिसम्म पूरा क्यालेन्डर दिन (`iso` विगतमा भए ऋणात्मक)। */
export function calendarDaysFromToday(iso: string): number {
  const b = new Date(iso);
  const t = new Date();
  const start = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((end - start) / 86400000);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  const days = Math.floor(hrs / 24);
  return `${days} days ago`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}
