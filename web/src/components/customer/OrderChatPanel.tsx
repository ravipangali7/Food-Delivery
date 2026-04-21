import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getJson, postJson, type OrderChatWsThread } from '@/lib/api';
import { useOrderChat } from '@/hooks/useOrderChat';
import type { ChatParticipantPresence, OrderChatAggregateStatus, OrderChatMessage } from '@/types';

export type OrderChatThread = 'support' | 'delivery' | 'rider_ops' | 'customer_rider';

type ReplyChannel = 'support' | 'delivery' | 'rider_ops' | 'customer_rider';

type Props = {
  orderId: number;
  token: string | null;
  currentUserId: number;
  partnerLabel: string;
  /** `support`: customer ↔ staff. `delivery`: customer ↔ staff (coordination). `rider_ops`: rider ↔ staff only. `customer_rider`: customer ↔ assigned rider (+ staff). */
  chatThread?: OrderChatThread;
  /** WebSocket subscription; staff should use `all` with `wsIngestFilter` so every lane receives live updates. */
  wsThread?: OrderChatWsThread;
  /** When staff use `wsThread="all"`, only messages matching this predicate update this panel. */
  wsIngestFilter?: (msg: OrderChatMessage) => boolean;
  /** Fetch GET thread=all (staff merged timeline). Overrides chatThread for loading. */
  unified?: boolean;
  enabled?: boolean;
  /** Toast + header pulse when a peer message arrives while the tab is in the background. Staff hub should set false (global inbox handles it). */
  notifyPeerMessages?: boolean;
};

function StatusTicks({
  mine,
  status,
}: {
  mine: boolean;
  status?: OrderChatAggregateStatus;
}) {
  if (!mine) return null;
  const s = status || 'sent';
  if (s === 'seen') {
    return (
      <span className="inline-flex items-center gap-0.5 text-sky-200" title="Seen">
        <CheckCheck size={12} strokeWidth={2.5} />
      </span>
    );
  }
  if (s === 'delivered') {
    return (
      <span className="inline-flex items-center gap-0.5 text-white/80" title="Delivered">
        <CheckCheck size={12} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-white/70" title="Sent">
      <Check size={12} strokeWidth={2.5} />
    </span>
  );
}

function threadLabel(m: OrderChatMessage) {
  if (m.support) return 'Support';
  if (m.rider_staff) return 'Rider ↔ store';
  if (m.customer_rider) return 'Customer ↔ rider';
  return 'Coordination';
}

export default function OrderChatPanel({
  orderId,
  token,
  currentUserId,
  partnerLabel,
  chatThread = 'delivery',
  wsThread,
  wsIngestFilter,
  unified = false,
  enabled = true,
  notifyPeerMessages = true,
}: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyChannel, setReplyChannel] = useState<ReplyChannel>('support');
  const [liveUnread, setLiveUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const threadParam = unified
    ? 'all'
    : chatThread === 'support'
      ? 'support'
      : chatThread === 'rider_ops'
        ? 'rider_ops'
        : chatThread === 'customer_rider'
          ? 'customer_rider'
          : 'delivery';
  const effectiveWsThread: OrderChatWsThread =
    wsThread ??
    (unified
      ? 'all'
      : chatThread === 'support'
        ? 'support'
        : chatThread === 'rider_ops'
          ? 'rider_ops'
          : chatThread === 'customer_rider'
            ? 'customer_rider'
            : 'delivery');

  const qk = useMemo(
    () => ['orderChat', orderId, threadParam] as const,
    [orderId, threadParam],
  );

  const channelFlags = useMemo(() => {
    if (unified) {
      return {
        support: replyChannel === 'support',
        rider_staff: replyChannel === 'rider_ops',
        customer_rider: replyChannel === 'customer_rider',
      };
    }
    return {
      support: chatThread === 'support',
      rider_staff: chatThread === 'rider_ops',
      customer_rider: chatThread === 'customer_rider',
    };
  }, [unified, replyChannel, chatThread]);

  const { data: messages, error } = useQuery({
    queryKey: qk,
    queryFn: () =>
      getJson<OrderChatMessage[]>(
        `/api/orders/${orderId}/chat/messages/?thread=${threadParam}`,
        token,
      ),
    enabled: !!token && enabled && orderId > 0,
    retry: false,
  });

  const { data: presence = [] } = useQuery({
    queryKey: ['orderChatPresence', orderId, token],
    queryFn: () => getJson<ChatParticipantPresence[]>(`/api/orders/${orderId}/chat/presence/`, token),
    enabled: !!token && enabled && orderId > 0,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const onPeerMessage = useCallback(
    (msg: OrderChatMessage) => {
      if (!notifyPeerMessages) return;
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible' && document.hasFocus()) return;
      setLiveUnread(true);
      const line = `${msg.sender_name || 'Someone'}: ${(msg.body || '').slice(0, 100)}`;
      toast.info('New message', { description: line, duration: 6000 });
    },
    [notifyPeerMessages],
  );

  const { typingName, wsState, sendTyping, flushReadForPeerMessages } = useOrderChat({
    orderId,
    token,
    wsThread: effectiveWsThread,
    queryKey: qk,
    currentUserId,
    enabled: !!token && enabled && orderId > 0,
    wsIngestFilter,
    onPeerMessage,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length, typingName]);

  useEffect(() => {
    if (!messages?.length) return;
    const run = () => {
      if (document.visibilityState === 'visible') {
        flushReadForPeerMessages(messages);
        setLiveUnread(false);
      }
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [messages, flushReadForPeerMessages]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const support = channelFlags.support;
      const rider_staff = channelFlags.rider_staff;
      const customer_rider = channelFlags.customer_rider;
      return postJson<
        OrderChatMessage,
        { body: string; support: boolean; rider_staff?: boolean; customer_rider?: boolean }
      >(`/api/orders/${orderId}/chat/messages/`, { body, support, rider_staff, customer_rider }, token);
    },
    onSuccess: msg => {
      queryClient.setQueryData<OrderChatMessage[]>(qk, old => {
        const list = old ?? [];
        return list.some(m => m.id === msg.id) ? list : [...list, msg];
      });
      setDraft('');
    },
  });

  const onDraftChange = (v: string) => {
    setDraft(v);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    sendTyping(channelFlags.support, channelFlags.rider_staff, channelFlags.customer_rider, true);
    typingDebounceRef.current = setTimeout(
      () => sendTyping(channelFlags.support, channelFlags.rider_staff, channelFlags.customer_rider, false),
      1200,
    );
  };

  const errText = error instanceof Error ? error.message : '';
  const forbidden = errText.includes('403') || errText.toLowerCase().includes('forbidden');

  const onlineHint = useMemo(() => {
    const names = presence.filter(p => p.is_online).map(p => p.name);
    if (!names.length) return 'Participants offline or away';
    return `Online: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
  }, [presence]);

  if (!enabled) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {chatThread === 'support'
          ? 'Support chat is available when you have an active order in progress.'
          : chatThread === 'rider_ops'
            ? 'Rider chat opens when you are assigned to this order.'
            : chatThread === 'customer_rider'
              ? 'Private chat with your delivery partner opens once someone is assigned to this order.'
              : 'This chat becomes available once a delivery partner is assigned to your order.'}
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {chatThread === 'support'
          ? 'Support chat is not available for this order. Use the store phone above if you need help.'
          : chatThread === 'rider_ops'
            ? 'Rider chat is not available for this order.'
            : chatThread === 'customer_rider'
              ? 'Private chat with your delivery partner is not available yet. Use support for store help.'
              : 'Chat opens when a delivery partner is assigned to this order. For other help, use the store phone in About Us.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col max-h-[min(520px,85vh)] shadow-sm animate-in fade-in duration-300">
      <div className="px-3 py-2 border-b border-border bg-muted/40 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chat</p>
            <p className="text-sm font-medium">With {partnerLabel}</p>
          </div>
          <div
            className="text-[10px] text-muted-foreground flex items-center gap-1.5"
            title={wsState === 'open' ? 'Live connection' : 'Reconnecting…'}
          >
            {liveUnread ? (
              <span
                className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"
                title="New message while you were away"
              />
            ) : null}
            <span
              className={`h-2 w-2 rounded-full ${wsState === 'open' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}
            />
            {wsState === 'open' ? 'Live' : '…'}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">{onlineHint}</p>
        {unified ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setReplyChannel('support')}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                replyChannel === 'support'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Customer support
            </button>
            <button
              type="button"
              onClick={() => setReplyChannel('delivery')}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                replyChannel === 'delivery'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Customer coordination
            </button>
            <button
              type="button"
              onClick={() => setReplyChannel('customer_rider')}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                replyChannel === 'customer_rider'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Customer ↔ rider
            </button>
            <button
              type="button"
              onClick={() => setReplyChannel('rider_ops')}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                replyChannel === 'rider_ops'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Rider ↔ store
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[340px] scroll-smooth">
        {!messages?.length && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {chatThread === 'support'
              ? 'No messages yet. The store team will see your messages here.'
              : chatThread === 'rider_ops'
                ? 'No messages yet. Coordinate with the restaurant or admin here.'
                : chatThread === 'customer_rider'
                  ? 'No messages yet. Say hello to your delivery partner — only they and the store see this thread.'
                  : 'No messages yet. Message the store team about this delivery.'}
          </p>
        )}
        {messages?.map(m => {
          const mine = m.sender === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm transition-all ${
                  mine ? 'bg-amber-500 text-white rounded-br-md' : 'bg-muted rounded-bl-md'
                }`}
              >
                {unified && (
                  <p className="text-[9px] font-bold uppercase tracking-wide opacity-80 mb-0.5">{threadLabel(m)}</p>
                )}
                {!mine && (
                  <p className="text-[10px] font-semibold opacity-80 mb-0.5">{m.sender_name}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div
                  className={`text-[10px] mt-1 flex items-center justify-end gap-1.5 ${
                    mine ? 'text-white/80' : 'text-muted-foreground'
                  }`}
                >
                  <span>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <StatusTicks mine={mine} status={m.aggregate_status} />
                </div>
              </div>
            </div>
          );
        })}
        {typingName ? (
          <p className="text-[11px] text-muted-foreground italic px-1 animate-pulse">{typingName} is typing…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>
      <form
        className="p-2 border-t border-border flex gap-2 bg-background/80 backdrop-blur-sm"
        onSubmit={e => {
          e.preventDefault();
          const t = draft.trim();
          if (!t || send.isPending) return;
          send.mutate(t);
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 min-w-0 rounded-full border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-shadow"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          className="shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center disabled:opacity-50 hover:bg-amber-600 transition-colors"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
