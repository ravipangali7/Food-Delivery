import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import OrderTrackingMap from '@/components/tracking/OrderTrackingMap';
import LiveTrackingStats from '@/components/tracking/LiveTrackingStats';
import { useLiveOrderTracking } from '@/hooks/useLiveOrderTracking';
import type { Order } from '@/types';

/**
 * Full-viewport live map when the customer taps “Track order”.
 * Matches satellite / hybrid map + route overlay from the product reference.
 */
export default function CustomerOrderTrack() {
  const { id } = useParams();
  const { token } = useAuth();
  const oid = id ? Number(id) : undefined;

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['order', id, token],
    queryFn: () => getJson<Order>(`/api/orders/${id}/`, token),
    enabled: !!token && !!id,
  });

  const trackingEnabled = !!order && !['cancelled', 'failed'].includes(order.status);

  const { data: tracking, isLoading: trackingLoading } = useLiveOrderTracking({
    orderId: oid,
    token,
    enabled: trackingEnabled,
  });

  if (!token) {
    return (
      <div className="p-8 text-center">
        <Link to="/login" className="text-amber-600">
          Sign in
        </Link>
      </div>
    );
  }

  if (orderLoading || !order) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-muted-foreground text-sm">
        {orderLoading ? 'Loading…' : 'Order not found'}
      </div>
    );
  }

  if (!trackingEnabled) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
          <Link to="/customer/orders" className="p-1">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display font-bold text-sm">Order {order.order_number}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground text-sm">
          Live tracking is not available for this order.
          <Link to={`/customer/order/${id}`} className="block mt-4 text-amber-600 font-medium">
            View order details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] min-h-0 max-h-[calc(100dvh-5rem)] bg-stone-950">
      <header className="shrink-0 z-50 flex items-center gap-3 px-3 py-2.5 bg-black/55 backdrop-blur-md text-white border-b border-white/10">
        <Link to="/customer/orders" className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Back to orders">
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-white/70">Live tracking</p>
          <h1 className="font-display font-bold text-sm truncate">{order.order_number}</h1>
        </div>
        <Link
          to={`/customer/order/${id}`}
          className="text-xs font-semibold text-amber-300 hover:text-amber-200 shrink-0"
        >
          Details
        </Link>
      </header>

      <div className="flex-1 min-h-0 relative">
        {trackingLoading && !tracking ? (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-900 text-stone-300 text-sm">
            Loading map…
          </div>
        ) : (
          <OrderTrackingMap data={tracking} variant="live" className="absolute inset-0 min-h-0 h-full" />
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3 pt-8 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none">
          <div className="pointer-events-auto max-w-[430px] mx-auto space-y-2">
            <LiveTrackingStats data={tracking} />
            <p className="text-center text-[11px] text-white/75">
              Map updates in real time while your order is active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
