import type { Product } from '@/types';

const PREORDER_CATEGORY_TOKENS = ['sweet', 'cake'] as const;

function nameMatchesPreorderCategory(name: string | undefined | null): boolean {
  const lower = (name ?? '').trim().toLowerCase();
  if (!lower) return false;
  return PREORDER_CATEGORY_TOKENS.some(token => lower.includes(token));
}

/** Pre-order केवल Sweets र Cakes श्रेणीका उत्पादनहरूका लागि उपलब्ध। */
export function productAllowsPreorder(product: Pick<Product, 'is_sweet' | 'category' | 'category_name'>): boolean {
  if (product.is_sweet) return true;
  if (nameMatchesPreorderCategory(product.category?.name)) return true;
  if (nameMatchesPreorderCategory(product.category?.slug)) return true;
  if (nameMatchesPreorderCategory(product.category_name)) return true;
  return false;
}
