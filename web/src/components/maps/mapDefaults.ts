/** निर्देशाङ्क नसेट भएको बेला पूर्वनिर्धारित नक्शा केन्द्र (काठमाडौं क्षेत्र)। */
export const DEFAULT_MAP_CENTER: [number, number] = [27.7172, 85.3240];

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
