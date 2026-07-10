import {
  DEFAULT_MAP_LABEL,
  DEFAULT_MAP_LAT,
  DEFAULT_MAP_LNG,
} from '@/components/maps/mapDefaults';

export function isUnsetCoordinates(latitude: string, longitude: string): boolean {
  const lat = latitude.trim();
  const lng = longitude.trim();
  if (!lat || !lng) return true;
  const latN = Number.parseFloat(lat);
  const lngN = Number.parseFloat(lng);
  return !Number.isFinite(latN) || !Number.isFinite(lngN);
}

export function getDefaultDeliveryCoordinates(): {
  latitude: string;
  longitude: string;
  label: string;
} {
  return {
    latitude: DEFAULT_MAP_LAT,
    longitude: DEFAULT_MAP_LNG,
    label: DEFAULT_MAP_LABEL,
  };
}
