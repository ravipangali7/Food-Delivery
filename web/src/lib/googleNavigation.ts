import type { Order } from '@/types';

type CoordValue = number | string | null | undefined;

function asFiniteNumber(value: CoordValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDestination(order: Pick<Order, 'delivery_latitude' | 'delivery_longitude'>): string | null {
  const lat = asFiniteNumber(order.delivery_latitude as CoordValue);
  const lng = asFiniteNumber(order.delivery_longitude as CoordValue);
  if (lat === null || lng === null) return null;
  return `${lat},${lng}`;
}

export function buildGoogleMapsNavigationUrl(order: Pick<Order, 'delivery_latitude' | 'delivery_longitude'>): string | null {
  const destination = getDestination(order);
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&dir_action=navigate&travelmode=driving&destination=${encodeURIComponent(destination)}`;
}

function buildGoogleNavigationSchemeUrl(order: Pick<Order, 'delivery_latitude' | 'delivery_longitude'>): string | null {
  const destination = getDestination(order);
  if (!destination) return null;
  return `google.navigation:q=${encodeURIComponent(destination)}&mode=d`;
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

export async function openGoogleMapsNavigation(order: Pick<Order, 'delivery_latitude' | 'delivery_longitude'>) {
  const destination = getDestination(order);
  if (!destination) return;

  const inFlutterWebView =
    typeof window !== 'undefined' &&
    typeof (window as Window & { flutter_inappwebview?: unknown }).flutter_inappwebview !== 'undefined';

  let url = buildGoogleMapsNavigationUrl(order) ?? '';
  if (inFlutterWebView) {
    // Flutter WebView मा तुरुन्त turn-by-turn का लागि direct app intent प्राथमिकता।
    url = buildGoogleNavigationSchemeUrl(order) ?? url;
  }
  if (navigator.geolocation) {
    try {
      const pos = await getCurrentPosition();
      const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        url += `&origin=${encodeURIComponent(origin)}`;
      }
    } catch (_) {
      // location अनुमति अस्वीकार/अनुपलब्ध भए गन्तव्य-मात्र नेभिगेसन राख्छ।
    }
  }
  if (!url) return;
  window.location.assign(url);
}
