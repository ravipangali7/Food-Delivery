import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { orderChatWebSocketUrl, postJson, type OrderChatWsThread } from '@/lib/api';
import type { OrderChatMessage } from '@/types';

type WsIncoming =
  | { type: 'message'; data: OrderChatMessage }
  | { type: 'receipt'; data: OrderChatMessage }
  | {
      type: 'typing';
      data: {
        user_id: number;
        name?: string;
        support?: boolean;
        rider_staff?: boolean;
        customer_rider?: boolean;
        active?: boolean;
      };
    }
  | { type: 'pong' }
  | { type: 'error'; detail?: string };

function syntheticMessageFromTyping(data: {
  user_id: number;
  name?: string;
  support?: boolean;
  rider_staff?: boolean;
  customer_rider?: boolean;
}): OrderChatMessage {
  return {
    id: 0,
    sender: data.user_id,
    sender_name: data.name || '',
    body: '',
    support: Boolean(data.support),
    rider_staff: Boolean(data.rider_staff),
    customer_rider: Boolean(data.customer_rider),
    created_at: '',
  };
}

function mergeMessage(list: OrderChatMessage[], msg: OrderChatMessage): OrderChatMessage[] {
  const idx = list.findIndex(m => m.id === msg.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...msg };
    return next;
  }
  if (list.some(m => m.id === msg.id)) return list;
  return [...list, msg].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function useOrderChat({
  orderId,
  token,
  wsThread,
  queryKey,
  currentUserId,
  enabled,
  /** When true, POST delivered ack for incoming messages from others. */
  ackDelivered = true,
  /** Used with staff `wsThread="all"` so each panel only merges its lane. */
  wsIngestFilter,
  onPeerMessage,
}: {
  orderId: number;
  token: string | null;
  wsThread: OrderChatWsThread;
  queryKey: QueryKey;
  currentUserId: number;
  enabled: boolean;
  ackDelivered?: boolean;
  wsIngestFilter?: (msg: OrderChatMessage) => boolean;
  onPeerMessage?: (msg: OrderChatMessage) => void;
}) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [wsState, setWsState] = useState<'connecting' | 'open' | 'closed'>('closed');

  const sendDeliveredAck = useCallback(
    async (messageId: number) => {
      if (!token) return;
      try {
        await postJson<OrderChatMessage, { action: string; message_id: number }>(
          `/api/orders/${orderId}/chat/receipts/`,
          { action: 'delivered', message_id: messageId },
          token,
        );
      } catch {
        /* offline / transient */
      }
    },
    [orderId, token],
  );

  const sendReadAck = useCallback(
    async (messageIds: number[]) => {
      if (!token || messageIds.length === 0) return;
      try {
        await postJson<{ ok: boolean }, { action: string; message_ids: number[] }>(
          `/api/orders/${orderId}/chat/receipts/`,
          { action: 'read', message_ids: messageIds },
          token,
        );
      } catch {
        /* ignore */
      }
    },
    [orderId, token],
  );

  const applyIncoming = useCallback(
    (parsed: WsIncoming) => {
      if (parsed.type === 'message' && parsed.data?.id) {
        const msg = parsed.data;
        if (wsIngestFilter && !wsIngestFilter(msg)) {
          return;
        }
        queryClient.setQueryData<OrderChatMessage[]>(queryKey, old => {
          const list = old ?? [];
          return mergeMessage(list, msg);
        });
        if (msg.sender !== currentUserId) {
          onPeerMessage?.(msg);
        }
        if (ackDelivered && msg.sender !== currentUserId) {
          void sendDeliveredAck(msg.id);
        }
        return;
      }
      if (parsed.type === 'receipt' && parsed.data?.id) {
        const msg = parsed.data;
        if (wsIngestFilter && !wsIngestFilter(msg)) {
          return;
        }
        queryClient.setQueryData<OrderChatMessage[]>(queryKey, old => {
          const list = old ?? [];
          return mergeMessage(list, msg);
        });
        return;
      }
      if (parsed.type === 'typing' && parsed.data) {
        const { user_id, name, active } = parsed.data;
        if (user_id === currentUserId) return;
        if (wsIngestFilter && !wsIngestFilter(syntheticMessageFromTyping(parsed.data))) {
          return;
        }
        if (active === false) {
          setTypingName(null);
          return;
        }
        setTypingName(name || 'Someone');
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingName(null), 3500);
      }
    },
    [ackDelivered, currentUserId, onPeerMessage, queryClient, queryKey, sendDeliveredAck, wsIngestFilter],
  );

  useEffect(() => {
    if (!token || !enabled || orderId <= 0) return;

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPing = () => {
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
    };

    const connect = () => {
      if (stopped) return;
      const url = orderChatWebSocketUrl(orderId, token, wsThread);
      if (!url) return;
      setWsState('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stopped) return;
        setWsState('open');
        retryRef.current = 0;
        clearPing();
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
          }
        }, 25000);
      };

      ws.onmessage = ev => {
        try {
          const parsed = JSON.parse(ev.data) as WsIncoming;
          applyIncoming(parsed);
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        clearPing();
        if (stopped) return;
        setWsState('closed');
        const delay = Math.min(30000, 800 * Math.pow(2, retryRef.current));
        retryRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearPing();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [applyIncoming, enabled, orderId, token, wsThread]);

  const sendTyping = useCallback(
    (support: boolean, riderStaff: boolean, customerRider: boolean, active: boolean) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'typing',
          support,
          rider_staff: riderStaff,
          customer_rider: customerRider,
          active,
        }),
      );
    },
    [],
  );

  const flushReadForPeerMessages = useCallback(
    (messages: OrderChatMessage[] | undefined) => {
      if (!messages?.length) return;
      const ids = messages
        .filter(m => m.sender !== currentUserId && !m.my_read_at)
        .map(m => m.id);
      if (ids.length) void sendReadAck(ids);
    },
    [currentUserId, sendReadAck],
  );

  return {
    typingName,
    wsState,
    sendTyping,
    flushReadForPeerMessages,
    sendReadAck,
  };
}
