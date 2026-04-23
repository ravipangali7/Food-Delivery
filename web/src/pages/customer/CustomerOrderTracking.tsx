import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  formatCurrency,
  formatDateTime,
  num,
  orderPaymentStatusLabel,
  unitLabel,
} from '@/lib/formatting';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { ArrowLeft, Phone } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import OrderTrackingMap from '@/components/tracking/OrderTrackingMap';
import LiveTrackingStats from '@/components/tracking/LiveTrackingStats';
import { useLiveOrderTracking } from '@/hooks/useLiveOrderTracking';
import type { Order, OrderStatus } from '@/types';

const TRACK_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
];

function stepIndex(status: OrderStatus): number {
  if (status === 'cancelled' || status === 'failed') return -1;
  const i = TRACK_STEPS.indexOf(status);
  return i >= 0 ? i : 0;
}

export default function CustomerOrderTracking() {
  const { id } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const oid = id ? Number(id) : undefined;

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id, token],
    queryFn: () => getJson<Order>(`/api/orders/${id}/`, token),
    enabled: !!token && !!id,
  });

  const trackingEnabled =
    !!order && !['cancelled', 'failed'].includes(order.status);

  const { data: tracking, isLoading: trackingLoading } = useLiveOrderTracking({
    orderId: oid,
    token,
    enabled: trackingEnabled,
  });

  const [cancelReason, setCancelReason] = useState('');

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!token || !id) return;
      const reason = cancelReason.trim();
      if (reason.length < 3) throw new Error('Please enter a reason (at least 3 characters).');
      await postJson<Order, { reason: string }>(
        `/api/orders/${id}/cancellation-request/`,
        { reason },
        token,
      );
    },
    onSuccess: () => {
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
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

  if (isLoading || !order) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  const currentIndex = stepIndex(order.status);
  const cancelled = order.status === 'cancelled';

  return (
    <div className="pb-20 flex flex-col min-h-[100dvh]">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/orders" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold">Order {order.order_number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 py-4">
        {order.is_preorder && order.pre_order_date_time && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-violet-950">
            <span className="font-semibold">Pre-order</span>
            <span className="text-violet-900"> — requested for {formatDateTime(order.pre_order_date_time)}</span>
          </div>
        )}

        {trackingEnabled && (
          <>
            <Link
              to={`/customer/order/${id}/track`}
              className="block w-full text-center rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
            >
              Open full-screen live map →
            </Link>
            <LiveTrackingStats data={tracking} />
            <div className="relative w-full min-h-[280px] h-[min(45vh,420px)] md:h-[min(50vh,480px)] rounded-xl overflow-hidden border border-border shadow-sm isolate">
              {trackingLoading && !tracking ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-muted-foreground text-sm">
                  Loading live map…
                </div>
              ) : (
                <OrderTrackingMap
                  data={tracking}
                  className="absolute inset-0 min-h-0 h-full w-full rounded-none"
                />
              )}
            </div>
          </>
        )}

        {cancelled ? (
          <div className="bg-card rounded-xl border border-border p-4 text-center text-red-600">
            This order was cancelled.
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-5">
            {TRACK_STEPS.map((s, i) => (
              <div key={s} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < currentIndex
                        ? 'bg-green-500 text-white'
                        : i === currentIndex
                          ? 'bg-amber-500 text-white'
                          : 'bg-stone-200 text-stone-400'
                    }`}
                  >
                    {i < currentIndex ? '✓' : i + 1}
                  </div>
                  {i < TRACK_STEPS.length - 1 && (
                    <div
                      className={`w-0.5 h-8 ${i < currentIndex ? 'bg-green-400' : 'bg-stone-200'}`}
                    />
                  )}
                </div>
                <div className="pb-4">
                  <span
                    className={`text-sm font-medium capitalize ${
                      i <= currentIndex ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </span>
                  {i === currentIndex && (
                    <span className="text-xs text-amber-500 ml-2">Current</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {order.delivery_boy && order.status === 'out_for_delivery' && (
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-xl">
              🛵
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{order.delivery_boy.name}</p>
              <p className="text-xs text-muted-foreground">{order.delivery_boy.phone}</p>
            </div>
            <a
              href={`tel:${order.delivery_boy.phone}`}
              className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center"
            >
              <Phone size={18} />
            </a>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">Order Items</h3>
          {order.items?.map(item => {
            const thumb = item.product?.thumbnail_url || item.product?.images?.[0]?.image_url;
            return (
              <div key={item.id} className="flex items-center gap-3">
                {thumb ? (
                  <img src={thumb} alt="" className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-amber-50 flex items-center justify-center">🍬</div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {item.product?.name} {item.product ? unitLabel(item.product) : ''} × {item.quantity}
                  </p>
                </div>
                <span className="font-semibold text-sm">{formatCurrency(num(item.total_price))}</span>
              </div>
            );
          })}
          <div className="border-t border-border pt-2 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Payment method</span>
              <span className="font-medium text-foreground">Cash on delivery</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Payment status</span>
              <span
                className={`font-medium ${order.payment_status === 'paid' ? 'text-emerald-700' : 'text-foreground'}`}
              >
                {orderPaymentStatusLabel(order.payment_status)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(num(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span>{formatCurrency(num(order.delivery_fee))}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span className="text-amber-600">{formatCurrency(num(order.total_amount))}</span>
            </div>
          </div>
        </div>

        {order.pending_cancellation_request && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Cancellation request sent</p>
            <p className="text-amber-900/90 mt-1">
              Your order stays active until a super admin reviews your reason. You will see updates here once they
              decide.
            </p>
          </div>
        )}

        {order.status === 'pending' && !order.pending_cancellation_request && (
          <div className="rounded-xl border border-red-100 bg-card p-4 space-y-3">
            <label htmlFor="cancel-reason" className="block text-sm font-semibold text-foreground">
              Cancel this order
            </label>
            <p className="text-xs text-muted-foreground">
              Your order will not be cancelled until you submit a reason and a super admin approves the request.
            </p>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Why do you need to cancel? (required)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
            />
            <button
              type="button"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending || cancelReason.trim().length < 3}
              className="w-full py-3 border-2 border-red-200 text-red-600 font-semibold rounded-full text-sm hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              {cancelMut.isPending ? 'Submitting…' : 'Submit cancellation request'}
            </button>
            {cancelMut.isError && (
              <p className="text-xs text-red-600">
                {cancelMut.error instanceof Error ? cancelMut.error.message : 'Request failed'}
              </p>
            )}
          </div>
        )}

        {order.status === 'delivered' && (
          <div className="text-center py-6">
            <h2 className="font-display font-bold text-lg">Order Delivered</h2>
            <p className="text-sm text-muted-foreground">
              {order.delivered_at ? formatDateTime(order.delivered_at) : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
