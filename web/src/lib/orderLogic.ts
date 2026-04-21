import { validStatusTransitions } from '@/lib/colors';
import type { OrderStatus } from '@/types';

/**
 * Whether `next` is an allowed transition from `current` (aligned with backend `core.services.VALID_STATUS_TRANSITIONS`).
 */
export function canTransitionOrderStatus(current: OrderStatus, next: OrderStatus): boolean {
  const allowed = validStatusTransitions[current] ?? [];
  return allowed.includes(next);
}
