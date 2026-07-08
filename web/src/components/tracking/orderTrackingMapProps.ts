import type { OrderTrackingPayload } from '@/types';

export type OrderTrackingMapProps = {
  data: OrderTrackingPayload | null;
  className?: string;
  /** live track screen का लागि full-bleed स्टाइल (जस्तै zoom chrome, कुनाको radius) */
  variant?: 'default' | 'live';
};
