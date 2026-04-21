import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CollectionViewMode } from '@/types/collection-view';

const baseBtn =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

const activeCls = 'border-primary bg-primary text-primary-foreground shadow-sm';
const inactiveCls = 'border-border bg-card text-muted-foreground hover:bg-muted';

export type CollectionViewToggleProps = {
  value: CollectionViewMode;
  onChange: (mode: CollectionViewMode) => void;
  /** Accessible label for the control group */
  label?: string;
  gridTitle?: string;
  listTitle?: string;
  className?: string;
};

/**
 * Reusable grid / list switch for admin collection pages (categories, products, orders, …).
 */
export function CollectionViewToggle({
  value,
  onChange,
  label = 'View mode',
  gridTitle = 'Grid view',
  listTitle = 'List view',
  className,
}: CollectionViewToggleProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center gap-1 rounded-md', className)}
    >
      <button
        type="button"
        title={gridTitle}
        aria-label={gridTitle}
        aria-pressed={value === 'grid'}
        onClick={() => onChange('grid')}
        className={cn(baseBtn, value === 'grid' ? activeCls : inactiveCls)}
      >
        <LayoutGrid size={18} aria-hidden />
      </button>
      <button
        type="button"
        title={listTitle}
        aria-label={listTitle}
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
        className={cn(baseBtn, value === 'list' ? activeCls : inactiveCls)}
      >
        <List size={18} aria-hidden />
      </button>
    </div>
  );
}
