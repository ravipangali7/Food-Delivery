import type { Category, ParentCategory } from '@/types';

/**
 * Resolve product category ids for a storefront browse id:
 * - If `rootId` is a parent category, returns all active subcategory ids under it.
 * - If `rootId` is a subcategory, returns that id only.
 */
export function collectDescendantCategoryIds(
  parents: ParentCategory[],
  rootId: number,
): Set<number> {
  for (const p of parents) {
    if (p.id === rootId) {
      const ids = new Set<number>();
      for (const ch of p.children ?? []) {
        ids.add(ch.id);
      }
      return ids;
    }
    for (const ch of p.children ?? []) {
      if (ch.id === rootId) {
        return new Set([rootId]);
      }
    }
  }
  return new Set([rootId]);
}

/** Flatten all subcategories from the parent tree (for lookups). */
export function flattenSubcategories(parents: ParentCategory[]): Category[] {
  const out: Category[] = [];
  for (const p of parents) {
    for (const ch of p.children ?? []) {
      out.push(ch);
    }
  }
  return out;
}
