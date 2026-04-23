import { running_map, RUNNING_MAP_OPENSTREET } from '@/lib/runningMap';
import type { LocationMiniMapProps } from '@/components/maps/mapDefaults';
import LocationMiniMapGoogle from '@/components/maps/LocationMiniMapGoogle';
import LocationMiniMapOsm from '@/components/maps/LocationMiniMapOsm';

export type { LocationMiniMapProps } from '@/components/maps/mapDefaults';

export default function LocationMiniMap(props: LocationMiniMapProps) {
  if (running_map === RUNNING_MAP_OPENSTREET) {
    return <LocationMiniMapOsm {...props} />;
  }
  return <LocationMiniMapGoogle {...props} />;
}
