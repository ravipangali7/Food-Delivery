/**
 * Map engine for the web app. Change `running_map` in this file only.
 * 1 = Google Maps (API key from server / VITE)
 * 2 = OpenStreetMap (Leaflet + OSM tiles; search/geocode via Nominatim)
 */
export const RUNNING_MAP_GOOGLE = 1;
export const RUNNING_MAP_OPENSTREET = 2;

export const running_map: typeof RUNNING_MAP_GOOGLE | typeof RUNNING_MAP_OPENSTREET = RUNNING_MAP_OPENSTREET;
