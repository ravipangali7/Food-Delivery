import { Receipt } from 'lucide-react';
import type { Order } from '@/types';

export function OrderBillIconButton({
  order,
  disabled,
  onDownload,
  className,
}: {
  order: Order;
  disabled?: boolean;
  onDownload: (order: Order) => void | Promise<void>;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={`Download invoice for ${order.order_number}`}
      disabled={disabled}
      className={
        className ??
        'inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-amber-700 disabled:opacity-40'
      }
      onClick={() => void onDownload(order)}
    >
      <Receipt size={16} />
    </button>
  );
}
