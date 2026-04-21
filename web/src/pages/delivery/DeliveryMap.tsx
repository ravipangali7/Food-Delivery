import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveOrderTracking } from '@/hooks/useLiveOrderTracking';
import OrderTrackingMap from '@/components/tracking/OrderTrackingMap';
import type { Order } from '@/types';

export default function DeliveryMap() {
  const { token, user } = useAuth();
  const online = user?.is_online !== false;
  const lastPostRef = useRef(0);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', token, online],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token && online,
    refetchInterval: online ? 8000 : false,
  });

  const activeOrders = useMemo(
    () => orders.filter(o => o.status === 'out_for_delivery'),
    [orders],
  );

  /** List is scoped to the rider; first active order drives the overview map. */
  const mapOrder = activeOrders[0];
  const mapTrackingEnabled =
    !!mapOrder && !!token && online && mapOrder.delivery_boy_id === user?.id;

  const { data: mapTracking, isLoading: mapTrackingLoading } = useLiveOrderTracking({
    orderId: mapOrder?.id,
    token,
    enabled: mapTrackingEnabled,
  });

  useEffect(() => {
    if (!mapOrder || !token || !user?.id || !mapTrackingEnabled) return;
    if (mapOrder.status !== 'out_for_delivery' || mapOrder.delivery_boy_id !== user.id) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const now = Date.now();
        if (now - lastPostRef.current < 4000) return;
        lastPostRef.current = now;
        postJson(
          `/api/orders/${mapOrder.id}/tracking/location/`,
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          token,
        ).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mapOrder, token, user?.id, mapTrackingEnabled]);

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
          <h1 className="font-display font-bold text-lg">Delivery Map</h1>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Go online from the home tab to use the map and active routes.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <h1 className="font-display font-bold text-lg">Delivery Map</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Open an active delivery for full-screen live navigation (restaurant → customer).
        </p>
      </div>

      <div className="px-4 pt-2 pb-3">
        <div className="relative min-h-[40vh] rounded-xl border border-border overflow-hidden bg-muted/30">
          {mapOrder && mapTrackingEnabled ? (
            <>
              {mapTrackingLoading && !mapTracking && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
                  Loading map…
                </div>
              )}
              <OrderTrackingMap
                data={mapTracking}
                variant="default"
                className="min-h-[40vh] h-[min(50vh,420px)] w-full"
              />
              <div className="absolute bottom-0 left-0 right-0 z-[500] p-2 bg-gradient-to-t from-background/95 to-transparent pointer-events-none">
                <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm max-w-lg mx-auto">
                  <p className="text-xs font-semibold text-foreground truncate">{mapOrder.order_number}</p>
                  <Link
                    to={`/delivery/order/${mapOrder.id}/navigate`}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
                  >
                    <Navigation size={14} />
                    Full screen
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="min-h-[40vh] bg-gradient-to-br from-sky-50 to-emerald-50 flex items-center justify-center px-4">
              <div className="text-center max-w-sm">
                <Navigation size={40} className="text-sky-600 mx-auto mb-3" />
                <p className="text-sm text-stone-700 font-medium">Route overview</p>
                <p className="text-xs text-stone-500 mt-1">
                  When you have an order <strong>Out for delivery</strong>, the live route appears here. Use{' '}
                  <strong>Open live navigation</strong> below for full-screen tracking.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <h3 className="font-display font-semibold">Active deliveries</h3>
        {activeOrders.length === 0 ? (
          <div className="bg-muted/50 rounded-xl p-6 text-center text-sm text-muted-foreground">
            No orders out for delivery right now
          </div>
        ) : (
          activeOrders.map(order => (
            <div
              key={order.id}
              className="bg-card border border-border rounded-xl p-4 space-y-3"
            >
              <Link
                to={`/delivery/order/${order.id}`}
                className="block hover:opacity-90"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-primary">{order.order_number}</span>
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">On the Way</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  {order.address}
                </p>
              </Link>
              <Link
                to={`/delivery/order/${order.id}/navigate`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sky-600 text-white text-sm font-semibold"
              >
                <Navigation size={16} />
                Open live navigation
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
