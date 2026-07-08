/**
 * web app को map engine। `running_map` यो फाइलमा मात्र परिवर्तन गर्नुहोस्।
 * 1 = Google Maps (सर्भर / VITE बाट API key)
 * 2 = OpenStreetMap (Leaflet + OSM tiles; Nominatim मार्फत search/geocode)
 */
export const RUNNING_MAP_GOOGLE = 1;
export const RUNNING_MAP_OPENSTREET = 2;

export const running_map: typeof RUNNING_MAP_GOOGLE | typeof RUNNING_MAP_OPENSTREET = RUNNING_MAP_OPENSTREET;
