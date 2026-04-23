import { running_map, RUNNING_MAP_OPENSTREET } from '@/lib/runningMap';
import OrderTrackingMapGoogle from '@/components/tracking/OrderTrackingMapGoogle';
import OrderTrackingMapOsm from '@/components/tracking/OrderTrackingMapOsm';
import { type OrderTrackingMapProps } from '@/components/tracking/orderTrackingMapProps';

export type { OrderTrackingMapProps } from '@/components/tracking/orderTrackingMapProps';

export default function OrderTrackingMap(props: OrderTrackingMapProps) {
  if (running_map === RUNNING_MAP_OPENSTREET) {
    return <OrderTrackingMapOsm {...props} />;
  }
  return <OrderTrackingMapGoogle {...props} />;
}
