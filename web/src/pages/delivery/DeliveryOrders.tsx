import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, num, timeAgo } from '@/lib/formatting';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order } from '@/types';

const tabs = ['All', 'Active', 'Completed'] as const;

export default function DeliveryOrders() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('All');
  const { token, user } = useAuth();
  const online = user?.is_online !== false;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', token, online],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token && online,
    refetchInterval: online ? 8000 : false,
  });

  const filtered = useMemo(() => {
    if (activeTab === 'Active')
      return orders.filter(o => !['delivered', 'cancelled', 'failed'].includes(o.status));
    if (activeTab === 'Completed') return orders.filter(o => o.status === 'delivered');
    return orders;
  }, [orders, activeTab]);

  if (!token) {
    return (
      <div className="p-8 text-center">
        <a href="/login" className="text-amber-600">
          Sign in
        </a>
      </div>
    );
  }

  if (!online) {
    return (
      <div>
        <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
          <h1 className="font-display font-bold text-lg mb-3">My Orders</h1>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          You&apos;re offline. Go online from the home tab to see orders.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <h1 className="font-display font-bold text-lg mb-3">My Orders</h1>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading && <div className="text-center text-muted-foreground">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-muted/50 rounded-xl p-8 text-center text-muted-foreground text-sm">
            No orders found
          </div>
        )}
        {!isLoading &&
          filtered.map(order => (
            <Link
              key={order.id}
              to={`/delivery/order/${order.id}`}
              className="block bg-card border border-border rounded-xl p-4 hover:border-amber-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-primary">{order.order_number}</span>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{order.address}</p>
              <p className="text-xs text-muted-foreground">{order.customer?.name}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">{order.items?.length} items</span>
                <span className="font-semibold text-sm">{formatCurrency(num(order.total_amount))}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(order.created_at)}</p>
            </Link>
          ))}
      </div>
    </div>
  );
}
