import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import { orderTrackingApiPath } from '@/lib/guestOrderAccess';
import { getTrackingWebSocketUrl } from '@/lib/trackingWs';
import type { OrderTrackingPayload } from '@/types';

type Options = {
  orderId: number | undefined;
  token: string | null;
  guestToken?: string | null;
  /** true भए poll; WebSocket उपलब्ध भए state पनि अद्यावधिक गर्छ। */
  enabled?: boolean;
};

export function useLiveOrderTracking({ orderId, token, guestToken, enabled = true }: Options) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<OrderTrackingPayload | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const canFetch = !!orderId && (!!token || !!guestToken);

  const query = useQuery({
    queryKey: ['order-tracking', orderId, token, guestToken],
    queryFn: () =>
      getJson<OrderTrackingPayload>(
        orderTrackingApiPath(orderId!, guestToken),
        token,
      ),
    enabled: !!enabled && canFetch,
    refetchInterval: q => {
      const d = q.state.data;
      return d?.tracking_phase === 'on_the_way' ? 2000 : false;
    },
  });

  useEffect(() => {
    if (query.data) {
      setLive(query.data);
    }
  }, [query.data]);

  const mergePayload = useCallback((payload: OrderTrackingPayload) => {
    setLive(payload);
    queryClient.setQueryData(['order-tracking', orderId, token], payload);
  }, [orderId, token, guestToken, queryClient]);

  useEffect(() => {
    if (!enabled || !orderId || !token) return; // live WS लाई auth token चाहिन्छ

    const url = getTrackingWebSocketUrl(orderId, token);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    wsRef.current = ws;

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data) as { type?: string; data?: OrderTrackingPayload };
        if (msg.type === 'snapshot' && msg.data) {
          mergePayload(msg.data);
        } else if (msg.type === 'location' && msg.data) {
          mergePayload(msg.data);
        }
      } catch {
        /* बेवास्ता */
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enabled, orderId, token, mergePayload]);

  const data = live ?? query.data ?? null;

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
