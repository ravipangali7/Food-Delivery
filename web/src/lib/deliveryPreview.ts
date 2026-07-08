/**
 * `server/core/services.py` को दूरी + शुल्क (km × प्रति km शुल्क) mirror
 * checkout UI preview का लागि (place order मा सर्भर अधिकारी)।
 */

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dlat = r(lat2 - lat1);
  const dlon = r(lon2 - lon1);
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return EARTH_RADIUS_KM * c;
}

export function previewDeliveryFeeNpr(
  deliveryLat: number | null | undefined,
  deliveryLon: number | null | undefined,
  storeLat: number | null | undefined,
  storeLon: number | null | undefined,
  chargePerKm: number,
): { fee: number; distanceKm: number } {
  if (
    storeLat == null ||
    storeLon == null ||
    deliveryLat == null ||
    deliveryLon == null
  ) {
    return { fee: 0, distanceKm: 0 };
  }
  const km = Math.round(haversineKm(deliveryLat, deliveryLon, storeLat, storeLon) * 1000) / 1000;
  const per = chargePerKm || 0;
  const fee = Math.round(km * per * 100) / 100;
  return { fee, distanceKm: km };
}

/** कन्फिगर गरिएको छोटो radius छ र pin बाहिर छ भने true। */
export function isOutOfDeliveryRadius(distanceKm: number, underKmRadius: number): boolean {
  const under = underKmRadius || 0;
  return under > 0 && distanceKm > under;
}
