import type { ReactNode } from 'react';
import type { Order, OrderDeliveryType } from '@/types';
import { calendarDaysBetween, calendarDaysFromToday, formatDateTime } from '@/lib/formatting';

function deliveryTypeLabel(t: OrderDeliveryType): string {
  return t === 'walking' ? 'Walking delivery' : 'Bike delivery';
}

type PreorderFields = Pick<
  Order,
  'is_preorder' | 'pre_order_date_time' | 'created_at' | 'estimated_delivery_at' | 'delivery_type'
>;

export function PreorderScheduleSummary({
  order,
  variant = 'full',
}: {
  order: PreorderFields;
  variant?: 'compact' | 'full';
}) {
  if (!order.is_preorder) return null;

  if (!order.pre_order_date_time) {
    const fallback = (
      <span>
        <span className="font-semibold">Pre-order</span> — date and time are not on file for this order.
      </span>
    );
    if (variant === 'compact') {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-[11px] text-amber-950 max-w-[220px]">
          {fallback}
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">{fallback}</div>
    );
  }

  const leadDays = calendarDaysBetween(order.created_at, order.pre_order_date_time);
  const fromToday = calendarDaysFromToday(order.pre_order_date_time);

  const lines: { key: string; node: ReactNode }[] = [
    {
      key: 'when',
      node: (
        <span>
          <span className="font-semibold">Date &amp; time:</span> {formatDateTime(order.pre_order_date_time)}
        </span>
      ),
    },
    {
      key: 'lead',
      node: (
        <span>
          <span className="font-semibold">Scheduled for:</span>{' '}
          {leadDays === 0
            ? 'same calendar day as the order'
            : `${leadDays} calendar day${leadDays === 1 ? '' : 's'} after the order was placed`}
        </span>
      ),
    },
  ];

  if (fromToday > 0) {
    lines.push({
      key: 'until',
      node: (
        <span>
          <span className="font-semibold">From today:</span> in {fromToday} calendar day
          {fromToday === 1 ? '' : 's'}
        </span>
      ),
    });
  } else if (fromToday === 0) {
    lines.push({
      key: 'until',
      node: (
        <span>
          <span className="font-semibold">From today:</span> scheduled for today
        </span>
      ),
    });
  } else {
    lines.push({
      key: 'until',
      node: (
        <span>
          <span className="font-semibold">From today:</span> {Math.abs(fromToday)} calendar day
          {Math.abs(fromToday) === 1 ? '' : 's'} ago (past slot)
        </span>
      ),
    });
  }

  lines.push({
    key: 'mode',
    node: (
      <span>
        <span className="font-semibold">Delivery mode:</span> {deliveryTypeLabel(order.delivery_type)}
      </span>
    ),
  });

  if (order.estimated_delivery_at) {
    lines.push({
      key: 'eta',
      node: (
        <span>
          <span className="font-semibold">Estimated delivery:</span> {formatDateTime(order.estimated_delivery_at)}
        </span>
      ),
    });
  }

  if (variant === 'compact') {
    return (
      <div className="rounded-md border border-violet-200 bg-violet-50/90 px-2 py-1.5 text-[11px] leading-snug text-violet-950 space-y-0.5 max-w-[220px]">
        <div className="font-semibold text-violet-900">Pre-order</div>
        {lines.map(({ key, node }) => (
          <div key={key}>{node}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-violet-950 space-y-1.5">
      <div className="font-semibold text-violet-900">Pre-order schedule</div>
      {lines.map(({ key, node }) => (
        <div key={key}>{node}</div>
      ))}
    </div>
  );
}
