/**
 * WebSocket URL for live order tracking (Django Channels).
 * Uses the same API origin as `VITE_API_BASE` with ws/wss scheme.
 */
export function getTrackingWebSocketUrl(orderId: number, token: string): string {
  const base =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || 'http://127.0.0.1:8000';
  const trimmed = base.replace(/\/$/, '');
  const u = new URL(trimmed);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${u.origin}/ws/tracking/${orderId}/?token=${encodeURIComponent(token)}`;
}
