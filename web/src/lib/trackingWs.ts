import { wsUrl } from '@/lib/api';

/**
 * लाइभ अर्डर ट्र्याकिङका लागि WebSocket URL।
 * `VITE_API_BASE` जस्तै origin प्रयोग गर्छ (dev मा proxy)।
 */
export function getTrackingWebSocketUrl(orderId: number, token: string): string {
  return wsUrl(`/ws/tracking/${orderId}/?token=${encodeURIComponent(token)}`);
}
