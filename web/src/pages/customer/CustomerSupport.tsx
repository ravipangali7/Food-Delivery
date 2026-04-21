import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import OrderChatPanel from '@/components/customer/OrderChatPanel';
import type { Order, SuperSetting } from '@/types';

const CHAT_ELIGIBLE: Order['status'][] = [
  'confirmed',
  'preparing',
  'ready_for_delivery',
  'out_for_delivery',
];

type Recipient = 'admin' | 'rider';

export default function CustomerSupport() {
  const { token, user } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [recipient, setRecipient] = useState<Recipient>('admin');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const { data: orders } = useQuery({
    queryKey: ['orders', token],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token,
  });

  const chatOrders = useMemo(() => {
    if (!orders?.length) return [];
    return orders.filter(o => CHAT_ELIGIBLE.includes(o.status));
  }, [orders]);

  const selected = chatOrders.find(o => o.id === selectedId) ?? chatOrders[0];

  useEffect(() => {
    if (recipient === 'rider' && selected && !selected.delivery_boy_id) {
      setRecipient('admin');
    }
  }, [recipient, selected]);

  if (!token || !user) {
    return (
      <div className="p-8 text-center">
        <Link to="/login" className="text-amber-600">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/profile" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Messages</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="rounded-xl border border-border bg-emerald-50/80 p-4 text-sm text-emerald-900">
          <p className="font-semibold mb-1">Store phone</p>
          {settings?.phone?.trim() ? (
            <a href={`tel:${settings.phone}`} className="text-amber-800 font-medium">
              {settings.phone}
            </a>
          ) : (
            <p className="text-muted-foreground">Not configured in store settings.</p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Choose who you are messaging. <strong className="font-medium text-foreground">Platform admin</strong> goes to
          the store team only — your delivery partner does not see it. <strong className="font-medium text-foreground">
            Delivery partner
          </strong>{' '}
          is a private thread between you and the assigned rider (the store can still moderate if needed). Messages sync
          live when you keep this screen open.
        </p>

        {chatOrders.length > 1 && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</label>
            <select
              className="mt-1 w-full border border-border rounded-xl p-3 text-sm bg-card"
              value={selected?.id ?? ''}
              onChange={e => setSelectedId(Number(e.target.value))}
            >
              {chatOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {selected ? (
          <>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Message recipient
              </label>
              <select
                className="mt-1 w-full border border-border rounded-xl p-3 text-sm bg-card"
                value={recipient}
                onChange={e => setRecipient(e.target.value as Recipient)}
              >
                <option value="admin">Platform admin / store team (private from rider)</option>
                <option value="rider" disabled={!selected.delivery_boy_id}>
                  {selected.delivery_boy_id
                    ? `Delivery partner — ID ${selected.delivery_boy_id}${
                        selected.delivery_boy?.name ? ` (${selected.delivery_boy.name})` : ''
                      }`
                    : 'Delivery partner (assigns when a rider is booked)'}
                </option>
              </select>
            </div>
            <OrderChatPanel
              key={`${selected.id}-${recipient}`}
              orderId={selected.id}
              token={token}
              currentUserId={user.id}
              partnerLabel={
                recipient === 'admin'
                  ? 'Platform admin / store team'
                  : `Delivery partner${selected.delivery_boy?.name ? ` (${selected.delivery_boy.name})` : ''}`
              }
              chatThread={recipient === 'admin' ? 'support' : 'customer_rider'}
              enabled
              notifyPeerMessages
            />
          </>
        ) : (
          <OrderChatPanel
            orderId={0}
            token={token}
            currentUserId={user.id}
            partnerLabel="Platform admin / store team"
            chatThread="support"
            enabled={false}
          />
        )}
      </div>
    </div>
  );
}
