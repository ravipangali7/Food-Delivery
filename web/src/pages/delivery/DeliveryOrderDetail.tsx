import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDateTime, num, orderPaymentStatusLabel } from '@/lib/formatting';
import { deliveryPartnerValidStatusTransitions, orderStatusLabels } from '@/lib/colors';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { ArrowLeft, Phone, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getJson, postJson } from '@/lib/api';
import { openGoogleMapsNavigation } from '@/lib/googleNavigation';
import { useAuth } from '@/contexts/AuthContext';
import OrderChatPanel from '@/components/customer/OrderChatPanel';
import type { Order, OrderStatus, SuperSetting } from '@/types';

export default function DeliveryOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const {
    data: order,
    isLoading,
    error: orderError,
  } = useQuery({
    queryKey: ['order', id, token],
    queryFn: () => getJson<Order>(`/api/orders/${id}/`, token),
    enabled: !!token && !!id,
    retry: false,
  });

  const lastPostRef = useRef(0);

  useEffect(() => {
    if (
      !id ||
      !token ||
      !user?.id ||
      user.is_online === false ||
      !order ||
      order.status !== 'out_for_delivery' ||
      order.delivery_boy_id !== user.id
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

  const transition = useMutation({
    mutationFn: (newStatus: OrderStatus) =>
      postJson<Order, { status: string }>(
        `/api/orders/${id}/transition/`,
        { status: newStatus },
        token,
      ),
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (newStatus === 'out_for_delivery' && id) {
        navigate(`/delivery/order/${id}/navigate`);
      }
    },
  });

  const isMyOrder = Boolean(user && order && order.delivery_boy_id === user.id);
  const nextStatuses = useMemo((): OrderStatus[] => {
    if (!user || !order || order.delivery_boy_id !== user.id) return [];
    return (deliveryPartnerValidStatusTransitions[order.status] || []) as OrderStatus[];
  }, [order, user]);

  const callTarget = useMemo(() => {
    const customer = String(order?.customer?.phone ?? '').replace(/\s/g, '');
    const store = String(settings?.phone ?? '').replace(/\s/g, '');
    const toCustomer = order?.status === 'out_for_delivery';
    const num = toCustomer ? customer : store || customer;
    const label = toCustomer ? 'Call customer' : 'Call restaurant';
    return { href: num ? `tel:${num}` : undefined, label };
  }, [order?.customer?.phone, order?.status, settings?.phone]);

  if (!token) {
    return (
      <div className="p-8 text-center">
        <a href="/login" className="text-amber-600">
          Sign in
        </a>
      </div>
    );
  }

  const offlineMsg =
    orderError instanceof Error && orderError.message.toLowerCase().includes('offline')
      ? orderError.message
      : '';

  if (offlineMsg || user?.is_online === false) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground text-sm">
          {offlineMsg || 'You are offline. Go online on the home screen to view orders.'}
        </p>
        <Link to="/delivery" className="text-amber-600 font-medium text-sm inline-block">
          Back to home
        </Link>
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">{isLoading ? 'Loading…' : 'Order not found'}</p>
        <Link to="/delivery/orders" className="text-primary text-sm mt-2 inline-block">
          ← Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-lg">{order.order_number}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Status</span>
            <OrderStatusBadge status={order.status} />
          </div>
          {isMyOrder && nextStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map(ns => (
                <Button
                  key={ns}
                  type="button"
                  size="sm"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate(ns)}
                  className="flex-1 min-w-[120px] bg-primary hover:bg-amber-600 text-xs"
                >
                  Mark {orderStatusLabels[ns] ?? ns}
                </Button>
              ))}
            </div>
          )}
          {order.status === 'out_for_delivery' && isMyOrder && (
            <button
              type="button"
              onClick={() => {
                void openGoogleMapsNavigation(order);
              }}
              className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700"
            >
              <Navigation size={16} /> Open live map navigation
            </button>
          )}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Delivery type</span>
            <span className="font-semibold">
              {order.delivery_type === 'walking' ? '🚶 Walking' : '🚴 Bike'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Payment method</span>
            <span className="font-semibold">Cash on delivery</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Payment status</span>
            <span
              className={`font-semibold ${order.payment_status === 'paid' ? 'text-emerald-700' : 'text-amber-800'}`}
            >
              {orderPaymentStatusLabel(order.payment_status)}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Customer Details</h3>
          <p className="text-sm font-medium">{order.customer?.name}</p>
          <p className="text-xs text-muted-foreground mt-1">{order.customer?.phone}</p>
          {order.user_id ? (
            <a
              href="#fd-customer-chat"
              className="mt-2 inline-block text-xs font-mono text-amber-700 font-medium hover:underline"
            >
              Customer user #{order.user_id} — open private chat ↓
            </a>
          ) : null}
          <div className="flex gap-2 mt-3">
            <a
              href={callTarget.href ?? undefined}
              aria-disabled={!callTarget.href}
              className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-1 ${
                callTarget.href
                  ? 'bg-green-50 text-green-700'
                  : 'bg-muted/50 text-muted-foreground pointer-events-none'
              }`}
            >
              <Phone size={14} /> {callTarget.label}
            </a>
            {order.status === 'out_for_delivery' && isMyOrder ? (
              <button
                type="button"
                onClick={() => {
                  void openGoogleMapsNavigation(order);
                }}
                className="flex-1 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg flex items-center justify-center gap-1"
              >
                <Navigation size={14} /> Live map
              </button>
            ) : (
              <span className="flex-1 py-2 bg-muted/50 text-muted-foreground text-xs font-medium rounded-lg flex items-center justify-center text-center px-1">
                Live map unlocks when out for delivery
              </span>
            )}
          </div>
        </div>

        {user && isMyOrder && (
          <div id="fd-customer-chat" className="scroll-mt-28 space-y-4">
            <OrderChatPanel
              orderId={order.id}
              token={token}
              currentUserId={user.id}
              partnerLabel="Restaurant & admin"
              chatThread="rider_ops"
              notifyPeerMessages={false}
              enabled
            />
            <OrderChatPanel
              orderId={order.id}
              token={token}
              currentUserId={user.id}
              partnerLabel={order.customer?.name ? `Customer (${order.customer.name})` : 'Customer'}
              chatThread="customer_rider"
              enabled
              notifyPeerMessages
            />
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-2">Delivery Address</h3>
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{order.address}</p>
          </div>
          {order.special_instructions && (
            <div className="mt-2 bg-amber-50 rounded-lg p-2">
              <p className="text-xs text-amber-700">{order.special_instructions}</p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Order Items</h3>
          <div className="space-y-2">
            {order.items?.map(item => {
              const thumb = item.product?.thumbnail_url || item.product?.images?.[0]?.image_url;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  {thumb ? (
                    <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-xs">🍬</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product?.name}</p>
                    <p className="text-[10px] text-muted-foreground">x{item.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(num(item.total_price))}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(num(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Delivery Fee</span>
              <span>{formatCurrency(num(order.delivery_fee))}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatCurrency(num(order.total_amount))}</span>
            </div>
          </div>
        </div>

        {order.delivered_at && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              Delivered {formatDateTime(order.delivered_at)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
