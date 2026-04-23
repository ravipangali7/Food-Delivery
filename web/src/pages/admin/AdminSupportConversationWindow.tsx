import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import OrderChatPanel from '@/components/customer/OrderChatPanel';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import type { Order } from '@/types';

type Lane = 'customer' | 'rider' | 'customer-rider';

function isLane(s: string | undefined): s is Lane {
  return s === 'customer' || s === 'rider' || s === 'customer-rider';
}

export default function AdminSupportConversationWindow() {
  const { orderId, lane } = useParams<{ orderId: string; lane: string }>();
  const { token, user } = useAuth();
  const id = Number(orderId || 0);
  const resolvedLane: Lane | null = isLane(lane) ? lane : null;

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId, token],
    queryFn: () => getJson<Order>(`/api/orders/${orderId}/`, token),
    enabled: !!token && !!orderId && id > 0,
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff sign-in required.</div>;
  }

  if (!resolvedLane) {
    return (
      <div className="p-8 text-muted-foreground">
        Invalid conversation link. Open a chat from{' '}
        <Link to="/admin/customer-support" className="text-amber-700 underline">
          Customer support
        </Link>
        .
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {isLoading ? 'Loading…' : 'Order not found'}
      </div>
    );
  }

  const riderAssigned = order.delivery_boy_id != null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/customer-support"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Inbox
        </Link>
        <Link
          to={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline"
        >
          Order details <ExternalLink size={14} />
        </Link>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-display font-bold text-foreground">{order.order_number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {resolvedLane === 'customer'
            ? riderAssigned
              ? 'Private customer ↔ delivery partner thread (same as customer ↔ rider).'
              : 'Store support thread with the customer until a delivery partner is assigned.'
            : resolvedLane === 'customer-rider'
              ? 'Private customer ↔ delivery partner thread.'
              : 'Rider ↔ store operations chat for this order.'}
        </p>
        {order.user_id ? (
          <p className="text-xs font-mono text-muted-foreground mt-1">Customer user id: {order.user_id}</p>
        ) : null}
      </div>

      {user && resolvedLane === 'customer' ? (
        riderAssigned ? (
          <OrderChatPanel
            orderId={order.id}
            token={token}
            currentUserId={user.id}
            partnerLabel="customer ↔ delivery partner"
            chatThread="customer_rider"
            wsThread="all"
            wsIngestFilter={m => Boolean(m.customer_rider)}
            notifyPeerMessages={false}
            enabled
          />
        ) : (
          <OrderChatPanel
            orderId={order.id}
            token={token}
            currentUserId={user.id}
            partnerLabel="customer (support)"
            chatThread="support"
            wsThread="all"
            wsIngestFilter={m => Boolean(m.support)}
            notifyPeerMessages={false}
            enabled
          />
        )
      ) : null}

      {user && resolvedLane === 'customer-rider' ? (
        <OrderChatPanel
          orderId={order.id}
          token={token}
          currentUserId={user.id}
          partnerLabel="customer ↔ delivery partner"
          chatThread="customer_rider"
          wsThread="all"
          wsIngestFilter={m => Boolean(m.customer_rider)}
          notifyPeerMessages={false}
          enabled={riderAssigned}
        />
      ) : null}

      {user && resolvedLane === 'rider' ? (
        <OrderChatPanel
          orderId={order.id}
          token={token}
          currentUserId={user.id}
          partnerLabel="assigned delivery partner"
          chatThread="rider_ops"
          wsThread="all"
          wsIngestFilter={m => Boolean(m.rider_staff)}
          notifyPeerMessages={false}
          enabled={riderAssigned}
        />
      ) : null}

      {resolvedLane === 'customer-rider' && !riderAssigned ? (
        <p className="text-sm text-muted-foreground">
          No delivery partner is assigned to this order yet. Assign one from order details, then refresh this window.
        </p>
      ) : null}

      {resolvedLane === 'rider' && !riderAssigned ? (
        <p className="text-sm text-muted-foreground">
          No delivery partner is assigned to this order yet. Assign one from order details, then refresh this window.
        </p>
      ) : null}
    </div>
  );
}
