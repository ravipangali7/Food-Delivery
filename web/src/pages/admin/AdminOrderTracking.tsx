import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import OrderTrackingMap from '@/components/tracking/OrderTrackingMap';
import LiveTrackingStats from '@/components/tracking/LiveTrackingStats';
import { useLiveOrderTracking } from '@/hooks/useLiveOrderTracking';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order } from '@/types';

export default function AdminOrderTracking() {
  const { id } = useParams();
  const { token } = useAuth();
  const oid = id ? Number(id) : undefined;

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['order', id, token],
    queryFn: () => getJson<Order>(`/api/orders/${id}/`, token),
    enabled: !!token && !!id,
  });

  const trackingEnabled = !!order && !['cancelled', 'failed'].includes(order.status);
  const { data: tracking, isLoading: trackLoading } = useLiveOrderTracking({
    orderId: oid,
    token,
    enabled: trackingEnabled,
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff sign-in required.</div>;
  }

  if (orderLoading || !order) {
    return (
      <div className="p-8 text-center text-muted-foreground">{orderLoading ? 'Loading…' : 'Order not found'}</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3">
        <Link to={`/admin/orders/${id}`} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-display font-bold">Live tracking · {order.order_number}</h1>
          <p className="text-sm text-muted-foreground">Restaurant → customer · driver position updates in real time</p>
        </div>
      </div>

      <LiveTrackingStats data={tracking} />

      <div className="flex-1 min-h-[320px] md:min-h-[480px] rounded-xl overflow-hidden border border-border shadow-sm">
        {trackLoading && !tracking ? (
          <div className="h-full flex items-center justify-center bg-muted/40 text-muted-foreground text-sm">
            Loading tracking…
          </div>
        ) : (
          <OrderTrackingMap data={tracking} className="h-full w-full rounded-none" />
        )}
      </div>
    </div>
  );
}
