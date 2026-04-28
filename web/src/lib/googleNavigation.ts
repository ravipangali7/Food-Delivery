import type { Order } from '@/types';

export function buildGoogleMapsNavigationUrl(order: Pick<Order, 'delivery_latitude' | 'delivery_longitude' | 'address'>): string {
  const hasCoords = Number.isFinite(order.delivery_latitude) && Number.isFinite(order.delivery_longitude);
  const destination = hasCoords
    ? `${order.delivery_latitude},${order.delivery_longitude}`
    : order.address;

  return `https://www.google.com/maps/dir/?api=1&dir_action=navigate&travelmode=driving&destination=${encodeURIComponent(destination)}`;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });
  });
}

export async function openGoogleMapsNavigation(order: Pick<Order, 'delivery_latitude' | 'delivery_longitude' | 'address'>) {
  let url = buildGoogleMapsNavigationUrl(order);
  if (navigator.geolocation) {
    try {
      const pos = await getCurrentPosition();
      const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
      url += `&origin=${encodeURIComponent(origin)}`;
    } catch (_) {
      // Keep destination-only navigation if location permission is denied/unavailable.
    }
  }
  window.location.assign(url);
}
