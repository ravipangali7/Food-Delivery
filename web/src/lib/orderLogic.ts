import { validStatusTransitions } from '@/lib/colors';
import type { OrderStatus } from '@/types';

/**
 * `next` ले `current` बाट अनुमतित संक्रमण हो कि होइन (backend `core.services.VALID_STATUS_TRANSITIONS` सँग मिल्छ)।
 */
export function canTransitionOrderStatus(current: OrderStatus, next: OrderStatus): boolean {
  const allowed = validStatusTransitions[current] ?? [];
  return allowed.includes(next);
}
