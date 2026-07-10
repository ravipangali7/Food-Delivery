/** Kohalpur, Banke — पूर्वनिर्धारित डेलिभरी क्षेत्र जब GPS वा सेभ गरिएको स्थान उपलब्ध छैन। */
export const DEFAULT_MAP_CENTER: [number, number] = [28.2053, 81.6944];

export const DEFAULT_MAP_LABEL = 'Kohalpur';

function formatCoord(value: number): string {
  const rounded = Math.round(value * 1e8) / 1e8;
  return String(rounded);
}

export const DEFAULT_MAP_LAT = formatCoord(DEFAULT_MAP_CENTER[0]);
export const DEFAULT_MAP_LNG = formatCoord(DEFAULT_MAP_CENTER[1]);

export type LocationMiniMapProps = {
  latitude: string;
  longitude: string;
  onCoordinatesChange: (latitude: string, longitude: string) => void;
  /** प्रयोगकर्ताले search बाट स्थान छान्दा, मानव-पठनीय लेबलसहित बोलाइन्छ। */
  onSearchPlaceLabel?: (label: string) => void;
  className?: string;
  /** Tailwind height class, जस्तै h-[220px] */
  mapHeightClassName?: string;
};
