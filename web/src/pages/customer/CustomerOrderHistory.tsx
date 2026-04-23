import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, formatDate, num, orderPaymentStatusLabel } from '@/lib/formatting';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order } from '@/types';

export default function CustomerOrderHistory() {
  const { token } = useAuth();
  const [filter, setFilter] = useState('all');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', token],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token,
  });

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filter === 'active') return !['delivered', 'cancelled'].includes(o.status);
      if (filter === 'delivered') return o.status === 'delivered';
      if (filter === 'cancelled') return o.status === 'cancelled';
      return true;
    });
  }, [orders, filter]);

  if (!token) {
    return (
      <div className="p-8 text-center">
        <Link to="/login" className="text-amber-600">
          Sign in
        </Link>{' '}
        to see orders.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="pb-20">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <h1 className="font-display font-bold text-lg">My Orders</h1>
        <div className="flex gap-2 mt-2 flex-wrap">
          {['all', 'active', 'delivered', 'cancelled'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full capitalize ${
                filter === f ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">
        {filtered.map(order => (
          <div
            key={order.id}
            className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow"
          >
            <Link to={`/customer/order/${order.id}`} className="block p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="font-bold text-sm">{order.order_number}</span>
                  {order.is_preorder ? (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">
                      Pre-order
                    </span>
                  ) : null}
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(order.created_at)} · {order.items?.length ?? 0} items ·{' '}
                {formatCurrency(num(order.total_amount))} · {orderPaymentStatusLabel(order.payment_status)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {order.items?.slice(0, 3).map(item => {
                  const thumb = item.product?.thumbnail_url || item.product?.images?.[0]?.image_url;
                  return thumb ? (
                    <img key={item.id} src={thumb} alt="" className="w-10 h-10 rounded-md object-cover" />
                  ) : (
                    <div key={item.id} className="w-10 h-10 rounded-md bg-amber-50 text-xs flex items-center justify-center">
                      🍬
                    </div>
                  );
                })}
                {(order.items?.length || 0) > 3 && (
                  <span className="text-xs text-muted-foreground">+{(order.items?.length || 0) - 3} more</span>
                )}
              </div>
            </Link>
            <Link
              to={`/customer/order/${order.id}/track`}
              className="block py-3 text-center text-sm font-semibold text-amber-600 bg-amber-50/60 hover:bg-amber-100/80 border-t border-border"
            >
              Track order — live map
            </Link>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No orders found</div>
        )}
      </div>
    </div>
  );
}
