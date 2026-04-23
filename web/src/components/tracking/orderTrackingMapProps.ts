import type { OrderTrackingPayload } from '@/types';

export type OrderTrackingMapProps = {
  data: OrderTrackingPayload | null;
  className?: string;
  /** Full-bleed styling for live track screen (e.g. zoom chrome, corner radius) */
  variant?: 'default' | 'live';
};
