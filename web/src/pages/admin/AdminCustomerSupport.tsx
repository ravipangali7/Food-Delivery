import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Headphones, User } from 'lucide-react';
import { getJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import OrderChatPanel from '@/components/customer/OrderChatPanel';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import type { SupportInboxRow } from '@/types';

const SELECTED_ORDER_KEY = 'fd_support_selected_order';

function ChatAvatar({
  name,
  photoUrl,
  label,
  size = 'md',
}: {
  name: string;
  photoUrl?: string | null;
  label: string;
  size?: 'sm' | 'md';
}) {
  const trimmed = (photoUrl || '').trim();
  const initials = name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const dim = size === 'sm' ? 'h-9 w-9 min-w-[2.25rem]' : 'h-11 w-11 min-w-[2.75rem]';
  const initialClass = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={`shrink-0 rounded-full overflow-hidden bg-muted ${dim} flex items-center justify-center ring-2 ring-card shadow-sm`}
        title={`${label}: ${name || '—'}`}
      >
        {trimmed ? (
          <img src={trimmed} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={`font-semibold text-muted-foreground ${initialClass}`}>{initials || '?'}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
          {label}
        </p>
        <p className={`font-medium text-foreground truncate ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {name?.trim() || initials || '—'}
        </p>
      </div>
    </div>
  );
}

export default function AdminCustomerSupport() {
  const { token, user } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-support-inbox', token],
    queryFn: () => getJson<SupportInboxRow[]>('/api/admin/support/inbox/', token),
    enabled: !!token,
  });

  useEffect(() => {
    if (!rows.length) {
      setSelectedId(null);
      try {
        sessionStorage.removeItem(SELECTED_ORDER_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    setSelectedId(prev => {
      if (prev != null && rows.some(r => r.id === prev)) return prev;
      return rows[0].id;
    });
  }, [rows]);

  useEffect(() => {
    if (selectedId != null) {
      try {
        sessionStorage.setItem(SELECTED_ORDER_KEY, String(selectedId));
      } catch {
        /* ignore */
      }
    }
  }, [selectedId]);

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId]);

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff sign-in required.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Headphones className="h-7 w-7 text-amber-600" />
          Customer support
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each order shows a single live thread: private customer ↔ delivery partner chat when a partner is assigned,
          otherwise store support with the customer. Open the thread in a new tab if you need a dedicated window. Toast
          alerts still fire while you work elsewhere in the admin.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[560px]">
        <div className="w-full lg:w-[320px] shrink-0 border border-border rounded-xl bg-card overflow-hidden flex flex-col max-h-[70vh] lg:max-h-none shadow-sm">
          <div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Conversations
          </div>
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No orders in the support inbox yet. When customers message the store, or riders and staff coordinate on
                active orders, threads appear here.
              </p>
            ) : (
              rows.map(row => {
                const active = row.id === selectedId;
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'border-b border-border transition-all',
                      active
                        ? 'bg-amber-500/12 border-l-4 border-l-amber-500 pl-2 ring-1 ring-amber-500/35 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.15)]'
                        : 'border-l-4 border-l-transparent',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="font-semibold text-sm text-foreground">{row.order_number}</div>
                      <div className="mt-2 space-y-2">
                        <ChatAvatar
                          name={row.customer_name}
                          photoUrl={row.customer_profile_photo}
                          label="Customer"
                          size="sm"
                        />
                        {row.delivery_boy_id != null && row.delivery_boy_name ? (
                          <ChatAvatar
                            name={row.delivery_boy_name}
                            photoUrl={row.delivery_boy_profile_photo}
                            label="Delivery partner"
                            size="sm"
                          />
                        ) : (
                          <div className="flex items-center gap-2 min-w-0 opacity-80">
                            <div className="shrink-0 h-9 w-9 min-w-[2.25rem] rounded-full bg-muted flex items-center justify-center ring-2 ring-card">
                              <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
                                Delivery partner
                              </p>
                              <p className="text-xs text-muted-foreground truncate">Unassigned</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                    {row.last_message_at ? (
                      <div className="text-[10px] text-muted-foreground px-3 pb-2 pt-0 border-t border-border/60">
                        Last activity {new Date(row.last_message_at).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 border border-border rounded-xl bg-card p-4 space-y-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an order to view chats.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold">{selected.order_number}</h2>
                    <OrderStatusBadge status={selected.status} />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
                    <ChatAvatar
                      name={selected.customer_name}
                      photoUrl={selected.customer_profile_photo}
                      label="Customer"
                    />
                    {selected.delivery_boy_name ? (
                      <ChatAvatar
                        name={selected.delivery_boy_name}
                        photoUrl={selected.delivery_boy_profile_photo}
                        label="Delivery partner"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center ring-2 ring-card">
                          <User className="h-5 w-5 opacity-50" strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Delivery partner
                          </p>
                          <p>Not assigned</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selected.customer_phone ? (
                      <span className="text-foreground">{selected.customer_phone}</span>
                    ) : (
                      'No phone on file'
                    )}
                  </p>
                  {selected.customer_user_id != null ? (
                    <p className="text-xs font-mono text-muted-foreground mt-1">Customer user #{selected.customer_user_id}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/admin/orders/${selected.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline"
                  >
                    Order details <ExternalLink size={14} />
                  </Link>
                  {user && selected.delivery_boy_id != null ? (
                    <Link
                      to={`/admin/customer-support/chat/${selected.id}/customer-rider`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                    >
                      Open chat in new tab <ExternalLink size={12} />
                    </Link>
                  ) : null}
                </div>
              </div>

              {user ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {selected.delivery_boy_id != null
                        ? 'Customer ↔ delivery partner'
                        : 'Store support (customer)'}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selected.delivery_boy_id != null
                      ? 'Private thread between the customer and the assigned delivery partner. Store staff can follow and reply here.'
                      : 'No delivery partner is assigned yet — this is the support thread with the customer. Assign a partner on the order page to switch to private customer ↔ rider chat.'}
                  </p>
                  {selected.delivery_boy_id != null ? (
                    <OrderChatPanel
                      orderId={selected.id}
                      token={token}
                      currentUserId={user.id}
                      partnerLabel="customer ↔ delivery partner (private)"
                      chatThread="customer_rider"
                      wsThread="all"
                      wsIngestFilter={m => Boolean(m.customer_rider)}
                      notifyPeerMessages={false}
                      enabled
                    />
                  ) : (
                    <OrderChatPanel
                      orderId={selected.id}
                      token={token}
                      currentUserId={user.id}
                      partnerLabel="customer (support)"
                      chatThread="support"
                      wsThread="all"
                      wsIngestFilter={m => Boolean(m.support)}
                      notifyPeerMessages={false}
                      enabled
                    />
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
