import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Power, Package, CheckCircle, TrendingUp, ChevronRight } from 'lucide-react';
import NotificationBellLink from '@/components/NotificationBellLink';
import { formatCurrency, num, timeAgo } from '@/lib/formatting';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { getJson, patchJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order, User } from '@/types';

export default function DeliveryHome() {
  const { token, user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const isOnline = user?.is_online !== false;

  const toggleOnline = useMutation({
    mutationFn: async () => {
      await patchJson<User, { is_online: boolean }>(
        '/api/auth/me/',
        { is_online: !isOnline },
        token,
      );
      await refreshUser();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', token, isOnline],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token && isOnline,
    refetchInterval: isOnline ? 8000 : false,
  });

  const activeOrders = useMemo(
    () =>
      orders.filter(o =>
        ['out_for_delivery', 'ready_for_delivery', 'preparing', 'confirmed'].includes(o.status),
      ),
    [orders],
  );

  const deliveredRecent = useMemo(
    () => orders.filter(o => o.status === 'delivered').slice(0, 5),
    [orders],
  );

  const { data: earnings } = useQuery({
    queryKey: ['delivery-earnings', token],
    queryFn: () =>
      getJson<{ total_amount: string; total_deliveries: number }>('/api/delivery/earnings/?days=7', token),
    enabled: !!token,
  });

  const stats = [
    { label: 'Active', value: String(activeOrders.length), icon: Package, color: 'text-amber-600 bg-amber-50' },
    {
      label: 'All assigned',
      value: String(orders.length),
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Week total',
      value: formatCurrency(num(earnings?.total_amount)),
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-50',
    },
  ];

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg">🛵</div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">{user?.name ?? 'Partner'}</h2>
              <p className="text-[10px] text-muted-foreground">Delivery Partner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBellLink to="/delivery/notifications" />
            <button
              type="button"
              onClick={() => toggleOnline.mutate()}
              disabled={toggleOnline.isPending || !token}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              } disabled:opacity-60`}
            >
              <Power size={14} />
              {toggleOnline.isPending ? '…' : isOnline ? 'Online' : 'Offline'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {!isOnline && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center text-sm text-red-700">
            You&apos;re offline. Turn online to receive and view assigned orders. List refreshes every few seconds
            while online.
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <div className={`w-9 h-9 rounded-full ${s.color} flex items-center justify-center mx-auto mb-2`}>
                  <Icon size={18} />
                </div>
                <p className="text-lg font-bold text-foreground truncate">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            );
          })}
        </div>

        {isOnline && activeOrders.length > 0 && (
          <div>
            <h3 className="font-display font-semibold mb-3">Active Deliveries</h3>
            <div className="space-y-3">
              {activeOrders.map(order => (
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {order.items?.length} items · {formatCurrency(num(order.total_amount))}
                    </span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-display font-semibold mb-3">Recent Delivered</h3>
          {!isOnline ? (
            <div className="bg-muted/50 rounded-xl p-6 text-center text-sm text-muted-foreground">
              Go online to load your order history here.
            </div>
          ) : deliveredRecent.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-sm">No completed deliveries yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deliveredRecent.map(order => (
                <Link
                  key={order.id}
                  to={`/delivery/order/${order.id}`}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
                >
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.order_number}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{order.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(num(order.total_amount))}</p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(order.updated_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
