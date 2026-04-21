import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDateTime, num, unitLabel } from '@/lib/formatting';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { validStatusTransitions } from '@/lib/colors';
import { useEffect, useState } from 'react';
import { ArrowLeft, Phone, MapPin, User } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import OrderChatPanel from '@/components/customer/OrderChatPanel';
import type { Order, OrderDeliveryType, OrderStatus, User as U } from '@/types';

const allStatuses: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
];

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState('');
  const [deliveryType, setDeliveryType] = useState<OrderDeliveryType>('bike');
  const [cancelReason, setCancelReason] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id, token],
    queryFn: () => getJson<Order>(`/api/orders/${id}/`, token),
    enabled: !!token && !!id,
  });

  useEffect(() => {
    if (order?.delivery_type) setDeliveryType(order.delivery_type);
  }, [order?.delivery_type]);

  const { data: deliveryBoys = [] } = useQuery({
    queryKey: ['admin-users', 'delivery-boys', token],
    queryFn: () => getJson<U[]>('/api/admin/users/?role=delivery-boys', token),
    enabled: !!token,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const assignMut = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const boyId = Number(selectedDeliveryBoy || order?.delivery_boy_id);
      if (!boyId) throw new Error('Select a delivery partner');
      await postJson(`/api/orders/${id}/assign-delivery/`, { delivery_boy_id: boyId, delivery_type: deliveryType }, token);
    },
    onSuccess: invalidate,
  });

  const transitionMut = useMutation({
    mutationFn: async (body: { status: OrderStatus; cancellation_reason?: string }) =>
      postJson(`/api/orders/${id}/transition/`, body, token),
    onSuccess: () => {
      setSelectedStatus('');
      invalidate();
    },
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff sign-in required.</div>;
  }

  if (isLoading || !order) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {isLoading ? 'Loading…' : 'Order not found'}
      </div>
    );
  }

  const nextStatuses = (validStatusTransitions[order.status] || []) as string[];
  const currentIndex = allStatuses.indexOf(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/orders" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Order {order.order_number}</h1>
          <p className="text-sm text-muted-foreground">Placed: {formatDateTime(order.created_at)}</p>
        </div>
        <div className="ml-auto">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-5">
        <h3 className="text-sm font-semibold mb-4">Order Timeline</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {allStatuses.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center min-w-[80px]">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < currentIndex
                      ? 'bg-green-500 text-white'
                      : i === currentIndex
                        ? 'bg-amber-500 text-white'
                        : 'bg-stone-200 text-stone-400'
                  }`}
                >
                  {i < currentIndex ? '✓' : i + 1}
                </div>
                <span className="text-[10px] mt-1 text-center capitalize text-muted-foreground">
                  {s.replace(/_/g, ' ')}
                </span>
              </div>
              {i < allStatuses.length - 1 && (
                <div className={`h-0.5 w-8 ${i < currentIndex ? 'bg-green-400' : 'bg-stone-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {!['cancelled', 'failed'].includes(order.status) && (
        <Link
          to={`/admin/orders/${id}/track`}
          className="block w-full text-center sm:text-left rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
        >
          Track order on live map →
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-lg shadow-sm border border-border">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold">Order Items</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground text-xs uppercase">
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">Unit</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map(item => {
                  const thumb = item.product?.thumbnail_url || item.product?.images?.[0]?.image_url;
                  return (
                    <tr key={item.id} className="border-b border-border">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-14 h-14 rounded-lg object-cover" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-amber-50 flex items-center justify-center text-xs">
                              🍬
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{item.product?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.product ? unitLabel(item.product) : ''}
                            </div>
                            {item.notes && (
                              <div className="text-xs text-amber-600 italic mt-1">Note: {item.notes}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(num(item.unit_price))}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(num(item.total_price))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-b border-border">
                  <td colSpan={3} className="px-4 py-2 text-right text-sm text-muted-foreground">
                    Subtotal:
                  </td>
                  <td className="px-4 py-2 text-right">{formatCurrency(num(order.subtotal))}</td>
                </tr>
                <tr className="border-b border-border">
                  <td colSpan={3} className="px-4 py-2 text-right text-sm text-muted-foreground">
                    Delivery Fee:
                  </td>
                  <td className="px-4 py-2 text-right">{formatCurrency(num(order.delivery_fee))}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                    TOTAL:
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-primary">
                    {formatCurrency(num(order.total_amount))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {order.special_instructions && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-amber-800">Special Instructions</h4>
              <p className="text-sm text-amber-700 mt-1">{order.special_instructions}</p>
            </div>
          )}

          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin size={16} /> Delivery Address
            </h3>
            <p className="mt-3 text-sm">{order.address}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User size={14} /> Customer
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700">
                {order.customer?.name?.[0]}
              </div>
              <div>
                <div className="font-medium">{order.customer?.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone size={10} /> {order.customer?.phone}
                </div>
              </div>
            </div>
            <Link to={`/admin/customers/${order.user_id}`} className="text-xs text-primary hover:underline mt-2 block">
              View customer →
            </Link>
          </div>

          {user && (
            <div className="bg-card rounded-lg shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold mb-2">Support chat</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Messages here are only visible to you and the customer — not delivery partners.
              </p>
              <OrderChatPanel
                orderId={order.id}
                token={token}
                currentUserId={user.id}
                partnerLabel={order.customer?.name ?? 'Customer'}
                chatThread="support"
                wsThread="all"
                wsIngestFilter={m => Boolean(m.support)}
                notifyPeerMessages={false}
                enabled
              />
            </div>
          )}

          {user && order.delivery_boy_id ? (
            <div className="bg-card rounded-lg shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold mb-2">Customer ↔ delivery partner</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Private thread between the customer and the assigned rider. Your team can still read and reply here.
              </p>
              <OrderChatPanel
                orderId={order.id}
                token={token}
                currentUserId={user.id}
                partnerLabel="customer ↔ rider"
                chatThread="customer_rider"
                wsThread="all"
                wsIngestFilter={m => Boolean(m.customer_rider)}
                notifyPeerMessages={false}
                enabled
              />
            </div>
          ) : null}

          {user && order.delivery_boy_id ? (
            <div className="bg-card rounded-lg shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold mb-2">Rider ↔ store</h3>
              <p className="text-xs text-muted-foreground mb-3">
                The customer does not see this thread — only the assigned partner and your team.
              </p>
              <OrderChatPanel
                orderId={order.id}
                token={token}
                currentUserId={user.id}
                partnerLabel={order.delivery_boy?.name ?? 'Delivery partner'}
                chatThread="rider_ops"
                wsThread="all"
                wsIngestFilter={m => Boolean(m.rider_staff)}
                notifyPeerMessages={false}
                enabled
              />
            </div>
          ) : null}

          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-1">Payment</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cash on delivery —{' '}
              <span className="font-semibold text-foreground">
                {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </p>
            <h3 className="text-sm font-semibold mb-3">Delivery partner</h3>
            <select
              value={selectedDeliveryBoy || order.delivery_boy_id?.toString() || ''}
              onChange={e => setSelectedDeliveryBoy(e.target.value)}
              className="w-full border border-border rounded-lg p-2.5 text-sm bg-card outline-none"
            >
              <option value="">Select</option>
              {deliveryBoys.map(db => (
                <option
                  key={db.id}
                  value={db.id}
                  disabled={db.is_online === false && db.id !== order.delivery_boy_id}
                >
                  {db.name}
                  {db.is_online === false ? ' (offline)' : ''}
                </option>
              ))}
            </select>
            {order.delivery_boy && (
              <p className="text-xs text-muted-foreground mt-2">Current: {order.delivery_boy.name}</p>
            )}
            <label className="block mt-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Delivery type
            </label>
            <select
              value={deliveryType}
              onChange={e => setDeliveryType(e.target.value as OrderDeliveryType)}
              className="mt-1 w-full border border-border rounded-lg p-2.5 text-sm bg-card outline-none"
            >
              <option value="bike">Bike</option>
              <option value="walking">Walking</option>
            </select>
            <button
              type="button"
              onClick={() => assignMut.mutate()}
              disabled={assignMut.isPending || !(selectedDeliveryBoy || order.delivery_boy_id)}
              className="mt-3 w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Save partner and delivery type
            </button>
          </div>

          <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold mb-3">Update status</h3>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full border border-border rounded-lg p-2.5 text-sm bg-card outline-none"
            >
              <option value="">Select next status</option>
              {nextStatuses.map(s => (
                <option key={s} value={s} className="capitalize">
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!selectedStatus) return;
                transitionMut.mutate({ status: selectedStatus as OrderStatus });
              }}
              disabled={!selectedStatus || transitionMut.isPending}
              className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Update status
            </button>

            <div className="border-t border-border mt-4 pt-4">
              <h4 className="text-sm font-semibold text-red-600 mb-2">Cancel order</h4>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason"
                className="w-full border border-border rounded-lg p-2.5 text-sm bg-card outline-none mb-2"
              />
              <button
                type="button"
                onClick={() =>
                  transitionMut.mutate({
                    status: 'cancelled',
                    cancellation_reason: cancelReason || undefined,
                  })
                }
                className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100"
              >
                Cancel order
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
