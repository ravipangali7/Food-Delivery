/** Nominatim: identify the app (required by https://operations.osmfoundation.org/policies/nominatim/ ). */
const NOMINATIM_HEADERS: HeadersInit = {
  'User-Agent': 'FoodDeliveryWeb/1.0',
  'Accept-Language': 'en',
  Accept: 'application/json',
};

export type NominatimResult = { lat: number; lng: number; label: string; placeId: string };

function parseNominatimList(json: unknown): NominatimResult[] {
  if (!Array.isArray(json)) return [];
  const out: NominatimResult[] = [];
  for (const row of json) {
    if (typeof row !== 'object' || !row) continue;
    const r = row as { lat?: string; lon?: string; display_name?: string; place_id?: number | string };
    const lat = Number.parseFloat(r.lat ?? '');
    const lon = Number.parseFloat(r.lon ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const placeId = String(r.place_id ?? r.display_name ?? `${lat},${lon}`);
    out.push({ lat, lng: lon, label: String(r.display_name ?? '').trim() || `${lat}, ${lon}`, placeId });
  }
  return out;
}

export async function nominatimSearch(
  q: string,
  opts?: { countryCodes?: string; viewbox?: { south: number; west: number; north: number; east: number } },
): Promise<NominatimResult[]> {
  const qTrim = q.trim();
  if (qTrim.length < 2) return [];
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('format', 'json');
  u.searchParams.set('q', qTrim);
  u.searchParams.set('limit', '8');
  if (opts?.countryCodes) u.searchParams.set('countrycodes', opts.countryCodes);
  if (opts?.viewbox) {
    const b = opts.viewbox;
    /* min lon, min lat, max lon, max lat (Nepal-ish bias when bounded) */
    u.searchParams.set('viewbox', `${b.west},${b.south},${b.east},${b.north}`);
    u.searchParams.set('bounded', '1');
  }
  const res = await fetch(u.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  const j = (await res.json()) as unknown;
  return parseNominatimList(j);
}

export async function nominatimReverse(lat: number, lng: number): Promise<string> {
  const u = new URL('https://nominatim.openstreetmap.org/reverse');
  u.searchParams.set('format', 'json');
  u.searchParams.set('lat', String(lat));
  u.searchParams.set('lon', String(lng));
  u.searchParams.set('addressdetails', '0');
  u.searchParams.set('zoom', '16');
  const res = await fetch(u.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) return 'Unknown address';
  const j = (await res.json()) as { display_name?: string; error?: string };
  if (j.error) return 'Unknown address';
  return j.display_name?.trim() || 'Unknown address';
}
