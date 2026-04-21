/** Decodes a Google-encoded polyline string to lat/lng points (no Maps JS API required). */
export function decodeGooglePolyline(encoded: string): { lat: number; lng: number }[] {
  const path: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const str = encoded.trim();
  const len = str.length;
  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}
