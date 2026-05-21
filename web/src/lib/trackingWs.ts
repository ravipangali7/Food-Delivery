import { wsUrl } from '@/lib/api';

/**
 * WebSocket URL for live order tracking (Django Channels).
 * Uses the same origin as `VITE_API_BASE` (or Vite proxy in dev).
 */
export function getTrackingWebSocketUrl(orderId: number, token: string): string {
  return wsUrl(`/ws/tracking/${orderId}/?token=${encodeURIComponent(token)}`);
}
