import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { timeAgo } from '@/lib/formatting';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Notification } from '@/types';

const iconMap: Record<string, string> = {
  order_placed: '📦',
  order_confirmed: '✅',
  out_for_delivery: '🛵',
  delivered: '🎉',
  cancelled: '❌',
  promo: '🎁',
};

export default function DeliveryNotifications() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['notifications', token],
    queryFn: () => getJson<Notification[]>('/api/notifications/', token),
    enabled: !!token,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const hasUnread = list.some(n => !n.read_at);

  useEffect(() => {
    if (!token || isLoading || !hasUnread) return;
    postJson<{ ok: boolean }, Record<string, never>>('/api/notifications/mark-read/', {}, token).then(
      () => {
        queryClient.invalidateQueries({ queryKey: ['notifications-unread', token] });
        queryClient.invalidateQueries({ queryKey: ['notifications', token] });
      },
    );
  }, [token, isLoading, hasUnread, queryClient]);

  if (!token) {
    return (
      <div className="p-8 text-center">
        <a href="/login" className="text-amber-600">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-lg">Notifications</h1>
      </div>

      <div className="px-4 py-4 space-y-2">
        {isLoading && <p className="text-center text-muted-foreground">Loading…</p>}
        {!isLoading &&
          list.map(n => (
            <div
              key={n.id}
              className="bg-card border border-border rounded-xl p-4 flex gap-3 items-start hover:border-amber-200 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-lg shrink-0">
                {iconMap[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          ))}
        {!isLoading && list.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No notifications yet.</p>
        )}
      </div>
    </div>
  );
}
