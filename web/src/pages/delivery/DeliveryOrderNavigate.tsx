import { Link, useParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import OrderTrackingMap from '@/components/tracking/OrderTrackingMap';
import LiveTrackingStats from '@/components/tracking/LiveTrackingStats';
import { useLiveOrderTracking } from '@/hooks/useLiveOrderTracking';
import type { Order } from '@/types';

/**
 * Read-only live route: restaurant → customer. Rider location updates via GPS; map shows moving marker.
 */
export default function DeliveryOrderNavigate() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const oid = id ? Number(id) : undefined;
  const lastPostRef = useRef(0);

  const orderQuery = useQuery({
    queryKey: ['order', id, token],
    queryFn: () => getJson<Order>(`/api/orders/${id}/`, token),
    enabled: !!token && !!id,
    retry: false,
  });

  const order = orderQuery.data;
  const isAssigned = !!user && order?.delivery_boy_id === user.id;
  const trackingEnabled =
    !!order && isAssigned && order.status === 'out_for_delivery' && user?.is_online !== false;

  const { data: tracking, isLoading: trackingLoading } = useLiveOrderTracking({
    orderId: oid,
    token,
    enabled: trackingEnabled,
  });

  useEffect(() => {
    if (
      !id ||
      !token ||
      !user?.id ||
      !order ||
      order.status !== 'out_for_delivery' ||
      order.delivery_boy_id !== user.id ||
      user.is_online === false
    ) {
      return;
    }
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const now = Date.now();
        if (now - lastPostRef.current < 4000) return;
        lastPostRef.current = now;
        postJson(
          `/api/orders/${id}/tracking/location/`,
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          token,
        ).catch(() => {
          /* offline / permission */
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [id, token, user?.id, user?.is_online, order?.status, order?.delivery_boy_id]);

  if (!token) {
    return (
      <div className="p-8 text-center">
        <a href="/login" className="text-amber-600">
          Sign in
        </a>
      </div>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-muted-foreground text-sm pb-20">
        Loading…
      </div>
    );
  }

  const errMsg = orderQuery.error instanceof Error ? orderQuery.error.message : '';
  if (errMsg.toLowerCase().includes('offline') || user?.is_online === false) {
    return (
      <div className="min-h-[100dvh] flex flex-col pb-24">
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
          <Link to="/delivery" className="p-1">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display font-bold text-sm">Navigation</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground text-sm">
          You are offline. Go online on the home screen to use live navigation.
          <Link to="/delivery" className="block mt-4 text-amber-600 font-medium">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-2 pb-24 text-muted-foreground text-sm">
        Order not found
        <Link to="/delivery/orders" className="text-amber-600 font-medium">
          My orders
        </Link>
      </div>
    );
  }

  if (!isAssigned) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-2 pb-24 p-6 text-center text-muted-foreground text-sm">
        This order is not assigned to you.
        <Link to={`/delivery/order/${order.id}`} className="text-amber-600 font-medium">
          Order details
        </Link>
      </div>
    );
  }

  if (order.status !== 'out_for_delivery') {
    return (
      <div className="min-h-[100dvh] flex flex-col pb-24">
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
          <Link to={`/delivery/order/${order.id}`} className="p-1">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display font-bold text-sm truncate">{order.order_number}</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-sm">
          Live turn-by-turn opens when the order is <strong className="text-foreground">Out for delivery</strong>.
          <Link to={`/delivery/order/${order.id}`} className="mt-4 text-amber-600 font-medium">
            Update status
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] min-h-0 max-h-[calc(100dvh-5rem)] bg-stone-950">
      <header className="shrink-0 z-50 flex items-center gap-3 px-3 py-2.5 bg-black/55 backdrop-blur-md text-white border-b border-white/10">
        <Link to={`/delivery/order/${id}`} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-white/70">Live route</p>
          <h1 className="font-display font-bold text-sm truncate">{order.order_number}</h1>
        </div>
        <span className="text-[10px] text-white/60 shrink-0 max-w-[100px] text-right leading-tight">
          Route is fixed (restaurant → customer)
        </span>
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
              Your position updates automatically. Destination cannot be changed here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
