import { orderStatusLabels } from '@/lib/colors';
import { OrderStatus } from '@/types';

const statusColorClasses: Record<string, string> = {
  pending: 'bg-stone-100 text-stone-600',
  confirmed: 'bg-blue-50 text-blue-600',
  preparing: 'bg-purple-50 text-purple-600',
  ready_for_delivery: 'bg-amber-50 text-amber-600',
  out_for_delivery: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-50 text-green-600',
  cancelled: 'bg-red-50 text-red-600',
  failed: 'bg-red-100 text-red-800',
};

const statusDotClasses: Record<string, string> = {
  pending: 'bg-stone-400',
  confirmed: 'bg-blue-500',
  preparing: 'bg-purple-500',
  ready_for_delivery: 'bg-amber-500',
  out_for_delivery: 'bg-amber-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
  failed: 'bg-red-800',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColorClasses[status] || 'bg-stone-100 text-stone-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDotClasses[status] || 'bg-stone-400'}`} />
      {orderStatusLabels[status] || status}
    </span>
  );
}
