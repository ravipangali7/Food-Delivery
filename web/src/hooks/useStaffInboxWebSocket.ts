import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { staffInboxWebSocketUrl } from '@/lib/api';

/**
 * Super Admin / staff: Messenger-style toast when any order chat message arrives.
 * Connects once while the admin portal is open.
 * @param currentUserId When set, suppresses toast for messages sent by this user (own replies).
 */
export function useStaffInboxWebSocket(
  token: string | null,
  enabled: boolean,
  currentUserId?: number,
) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const retryRef = useRef(0);

  useEffect(() => {
    if (!token || !enabled) return;

    let stopped = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      const url = staffInboxWebSocketUrl(token);
      if (!url) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        retryRef.current = 0;
      };

      ws.onmessage = ev => {
        try {
          const parsed = JSON.parse(ev.data) as {
            type?: string;
            data?: {
              kind?: string;
              order_id?: number;
              preview?: string;
              support?: boolean;
              rider_staff?: boolean;
              customer_rider?: boolean;
              message?: {
                id?: number;
                sender?: number;
                sender_name?: string;
                body?: string;
                support?: boolean;
                rider_staff?: boolean;
                customer_rider?: boolean;
              };
            };
          };
          if (parsed.type !== 'inbox' || !parsed.data?.kind) return;
          const d = parsed.data;
          if (d.kind !== 'new_message') return;
          const orderId = d.order_id;
          const support = Boolean(d.message?.support ?? d.support);
          const riderStaff = Boolean(d.rider_staff ?? d.message?.rider_staff);
          const riderCustomer = Boolean(d.customer_rider ?? d.message?.customer_rider);
          const label = support
            ? 'Support'
            : riderStaff
              ? 'Rider ↔ store'
              : riderCustomer
                ? 'Customer ↔ rider'
                : 'Coordination';
          const who = d.message?.sender_name || 'Someone';
          const preview = (d.preview || d.message?.body || '').slice(0, 120);
          const onSupportPage = location.pathname.includes('/customer-support');
          const selected = sessionStorage.getItem('fd_support_selected_order');
          const muted =
            onSupportPage && selected && orderId != null && String(orderId) === selected;

          void queryClient.invalidateQueries({ queryKey: ['admin-support-inbox'] });

          const senderId = d.message?.sender;
          if (currentUserId != null && senderId != null && senderId === currentUserId) return;

          if (muted) return;
          toast(`New message · Order #${orderId}`, {
            description: `${label} · ${who}: ${preview || '…'}`,
            duration: 6000,
          });
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        const delay = Math.min(30000, 800 * Math.pow(2, retryRef.current));
        retryRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [token, enabled, location.pathname, queryClient, currentUserId]);
}
