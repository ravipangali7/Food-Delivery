import { getEffectivePrice, getOptionEffectivePrice, unitLabelFromUnit } from '@/lib/formatting';
import type { Product, ProductPurchaseOption, ProductVariant } from '@/types';

/** API फिल्डबाट छान्न सकिने खरिद विकल्प बनाउनुहोस् (सूची + विवरण)। */
export function getProductPurchaseOptions(product: Product): ProductPurchaseOption[] {
  const fromVariants = (): ProductPurchaseOption[] => {
    const variants = product.variants?.filter(v => v.is_available !== false) ?? [];
    if (variants.length <= 1) return [];
    return variants.map(v => ({
      variant_id: v.id,
      label: v.display_label || v.label || unitLabelFromUnit(v.unit),
      unit: v.unit,
      price: v.price,
      effective_price: v.effective_price ?? v.price,
      stock_quantity: v.stock_quantity,
    }));
  };

  const apiOptions = product.purchase_options ?? [];
  if (apiOptions.length > 1) return apiOptions;
  return fromVariants();
}

/** variant पङ्क्ति वा उत्पादन एकाइ fallback का लागि मानव-पठनीय लेबल। */
export function variantDisplayLabel(
  variant: ProductVariant | null | undefined,
  product?: Pick<Product, 'unit'>,
): string {
  if (variant) {
    const custom = (variant.display_label || variant.label || '').trim();
    if (custom) return custom;
    return unitLabelFromUnit(variant.unit);
  }
  return product ? unitLabelFromUnit(product.unit) : '';
}

export function getSoleVariant(product: Product): ProductVariant | null {
  const rows = product.variants?.filter(v => v.is_available !== false) ?? [];
  return rows.length === 1 ? rows[0] : null;
}

export function productHasVariantChoices(product: Product): boolean {
  return getProductPurchaseOptions(product).length > 1;
}

export function resolveCartVariantId(
  product: Product,
  selectedVariantId: number | null,
  selectedOption: ProductPurchaseOption | null,
): number | null {
  if (selectedOption?.variant_id != null) return selectedOption.variant_id;
  if (selectedVariantId != null) return selectedVariantId;
  return getSoleVariant(product)?.id ?? null;
}

export function resolveSelectedVariant(
  product: Product,
  selectedOption: ProductPurchaseOption | null,
  selectedVariantId: number | null,
): ProductVariant | null {
  if (selectedOption?.variant_id != null) {
    return product.variants?.find(v => v.id === selectedOption.variant_id) ?? null;
  }
  if (selectedVariantId != null) {
    return product.variants?.find(v => v.id === selectedVariantId) ?? null;
  }
  return getSoleVariant(product);
}

export function getProductCardPrice(
  product: Product,
  selectedOption: ProductPurchaseOption | null,
  soleVariant: ProductVariant | null,
): number {
  if (selectedOption) return getOptionEffectivePrice(selectedOption);
  if (soleVariant) {
    return getOptionEffectivePrice({
      effective_price: soleVariant.effective_price,
      price: soleVariant.price,
    });
  }
  return getEffectivePrice(product);
}
