import { getOptionEffectivePrice } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import type { ProductPurchaseOption } from '@/types';

function formatVariantName(label: string): string {
  return label.trim().toLowerCase();
}

/** उत्पादन कार्डमा संक्षिप्त मूल्य (reference UI सँग मिल्छ)। */
export function formatCardPrice(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return `₹${rounded.toLocaleString('en-IN')}`;
}

type ProductVariantPickerProps = {
  options: ProductPurchaseOption[];
  selectedVariantId: number | null;
  onSelect: (variantId: number | null) => void;
  className?: string;
};

/** थपिएका variant पङ्क्ति: बायाँ नाम, दायाँ मूल्य; छानिएको पङ्क्तिमा रातो border + tint। */
export default function ProductVariantPicker({
  options,
  selectedVariantId,
  onSelect,
  className,
}: ProductVariantPickerProps) {
  if (options.length < 2) return null;

  const activeId = selectedVariantId ?? options[0]?.variant_id ?? null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)} role="group" aria-label="Choose variant">
      {options.map(option => {
        const optionId = option.variant_id ?? null;
        const active = optionId === activeId;
        const price = getOptionEffectivePrice(option);
        return (
          <button
            key={optionId ?? 'default'}
            type="button"
            onClick={() => onSelect(optionId)}
            aria-pressed={active}
            className={cn(
              'w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
              active
                ? 'border border-red-500 bg-red-50'
                : 'border border-transparent bg-neutral-100 hover:bg-neutral-200/80',
            )}
          >
            <span
              className={cn(
                'text-xs truncate capitalize',
                active ? 'text-neutral-600' : 'text-neutral-500',
              )}
            >
              {formatVariantName(option.label)}
            </span>
            <span className="text-xs font-bold text-red-600 shrink-0">{formatCardPrice(price)}</span>
          </button>
        );
      })}
    </div>
  );
}
