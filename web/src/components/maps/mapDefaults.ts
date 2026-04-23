/** Default map center when no coordinates are set (Kathmandu area). */
export const DEFAULT_MAP_CENTER: [number, number] = [27.7172, 85.3240];

export type LocationMiniMapProps = {
  latitude: string;
  longitude: string;
  onCoordinatesChange: (latitude: string, longitude: string) => void;
  /** Called when the user picks a place from search, with a human-readable label. */
  onSearchPlaceLabel?: (label: string) => void;
  className?: string;
  /** Tailwind height class, e.g. h-[220px] */
  mapHeightClassName?: string;
};
