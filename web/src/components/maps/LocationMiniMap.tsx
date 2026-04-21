import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { Search } from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';
import { cn } from '@/lib/utils';
import { DEFAULT_MAP_CENTER } from '@/components/maps/mapDefaults';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import 'leaflet/dist/leaflet.css';

/** Same id + libraries as `OrderTrackingMapInner` so one Maps script is shared app-wide. */
const GOOGLE_MAP_LOADER_ID = 'google-map-tracking';
const GOOGLE_MAP_LIBRARIES: ('geometry' | 'places')[] = ['geometry', 'places'];

function formatCoord(value: number): string {
  const rounded = Math.round(value * 1e8) / 1e8;
  return String(rounded);
}

function parsePair(latStr: string, lngStr: string): [number, number] | null {
  const lat = Number.parseFloat(latStr.trim());
  const lng = Number.parseFloat(lngStr.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/** Keeps map view in sync when latitude/longitude change from inputs (or search). */
function MapViewSync({ position }: { position: [number, number] }) {
  const map = useMap();
  const lat = position[0];
  const lng = position[1];
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [map, lat, lng]);
  return null;
}

function MapClickSelect({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

let leafletIconFixed = false;
function ensureLeafletDefaultIcon(): void {
  if (leafletIconFixed) return;
  leafletIconFixed = true;
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });
}

export type LocationMiniMapProps = {
  latitude: string;
  longitude: string;
  onCoordinatesChange: (latitude: string, longitude: string) => void;
  className?: string;
  /** Tailwind height class, e.g. h-[220px] */
  mapHeightClassName?: string;
};

const SEARCH_DEBOUNCE_MS = 280;
const MIN_GOOGLE_QUERY_LEN = 2;
const BIAS_RADIUS_M = 85_000;

function GooglePlacesSearch({
  apiKey,
  biasCenter,
  onPlaceSelected,
}: {
  apiKey: string;
  biasCenter: [number, number];
  onPlaceSelected: (lat: number, lng: number, description: string) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAP_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const ensureSessionToken = useCallback(() => {
    if (typeof google === 'undefined' || !google.maps?.places) return null;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setListOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  useEffect(() => {
    if (!isLoaded || loadError) return;
    if (typeof google === 'undefined' || !google.maps?.places) return;

    const q = query.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (q.length < MIN_GOOGLE_QUERY_LEN) {
      setPredictions([]);
      setSearchBusy(false);
      setSearchError(null);
      return;
    }

    setSearchBusy(true);
    setSearchError(null);

    debounceRef.current = setTimeout(() => {
      const myRequest = ++requestIdRef.current;
      const sessionToken = ensureSessionToken();
      const service = new google.maps.places.AutocompleteService();
      const circle = new google.maps.Circle({
        center: { lat: biasCenter[0], lng: biasCenter[1] },
        radius: BIAS_RADIUS_M,
      });

      service.getPlacePredictions(
        {
          input: q,
          sessionToken: sessionToken ?? undefined,
          locationBias: circle,
        },
        (results, status) => {
          if (myRequest !== requestIdRef.current) return;
          setSearchBusy(false);
          if (
            status !== google.maps.places.PlacesServiceStatus.OK &&
            status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS
          ) {
            if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              setSearchError('Location search was denied. Check that the Places API is enabled for your API key.');
            } else {
              setSearchError('Could not load suggestions. Try again.');
            }
            setPredictions([]);
            return;
          }
          setPredictions(results ?? []);
          setListOpen(true);
        },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, isLoaded, loadError, biasCenter, ensureSessionToken]);

  const pickPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      if (typeof google === 'undefined' || !google.maps?.places) return;
      const sessionToken = ensureSessionToken();
      const svc = new google.maps.places.PlacesService(document.createElement('div'));
      setSearchBusy(true);
      setSearchError(null);
      svc.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['geometry', 'formatted_address', 'name'],
          sessionToken: sessionToken ?? undefined,
        },
        (place, status) => {
          setSearchBusy(false);
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
            setSearchError('Could not resolve that place. Pick another suggestion or tap the map.');
            return;
          }
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const label =
            place.formatted_address?.trim() ||
            place.name?.trim() ||
            prediction.description;
          onPlaceSelected(lat, lng, label);
          setQuery(label);
          setPredictions([]);
          setListOpen(false);
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        },
      );
    },
    [ensureSessionToken, onPlaceSelected],
  );

  if (loadError) {
    return (
      <p className="text-xs text-destructive" role="status">
        Google Maps failed to load. Check your API key and network, or set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code>.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative z-20 space-y-1">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setSearchError(null);
          }}
          onFocus={() => {
            if (predictions.length > 0) setListOpen(true);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setListOpen(false);
            }
          }}
          placeholder={isLoaded ? 'Search address, street, or place…' : 'Loading location search…'}
          disabled={!isLoaded}
          className="w-full rounded-[10px] border border-border bg-background py-2.5 pl-3 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60"
          aria-label="Search location"
          aria-autocomplete="list"
          aria-expanded={listOpen && predictions.length > 0}
          autoComplete="off"
        />
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground tabular-nums"
          aria-hidden
        >
          {!isLoaded ? '…' : searchBusy ? '…' : ''}
        </span>
      </div>
      {searchError ? (
        <p className="text-xs text-destructive" role="status">
          {searchError}
        </p>
      ) : null}

      {listOpen && predictions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-[10px] border border-border bg-popover text-popover-foreground shadow-md">
          <ul className="py-1" role="listbox">
            {predictions.map(p => (
              <li key={p.place_id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted/80"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pickPrediction(p)}
                >
                  <span className="font-medium text-foreground">{p.structured_formatting?.main_text ?? p.description}</span>
                  {p.structured_formatting?.secondary_text ? (
                    <span className="text-xs text-muted-foreground">{p.structured_formatting.secondary_text}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{p.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-border bg-muted/20 px-2 py-1.5">
            <img
              src="https://maps.gstatic.com/mapfiles/api/powered-by-google-on-white3_hdpi.png"
              width="120"
              height="14"
              alt="Powered by Google"
              className="h-3.5 w-auto opacity-90"
            />
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Type to see Google suggestions, then choose one to drop the pin. You can still tap or drag on the map.
      </p>
    </div>
  );
}

function NominatimSearch({
  searchQuery,
  setSearchQuery,
  searchBusy,
  searchError,
  setSearchError,
  runSearch,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchBusy: boolean;
  searchError: string | null;
  setSearchError: (v: string | null) => void;
  runSearch: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          type="search"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            setSearchError(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Search place or address (OpenStreetMap)"
          className="flex-1 rounded-[10px] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          aria-label="Search location"
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={searchBusy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
        >
          <Search size={18} strokeWidth={2.25} />
          {searchBusy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {searchError ? (
        <p className="text-xs text-destructive" role="status">
          {searchError}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Click the map or drag the pin to set latitude and longitude. Search uses OpenStreetMap Nominatim (add a Google Maps
        API key for richer address suggestions).
      </p>
    </>
  );
}

/**
 * Compact Leaflet map: click or drag to set coordinates; stays in sync with controlled lat/lng strings.
 * With `VITE_GOOGLE_MAPS_API_KEY`, search uses Google Places Autocomplete (suggestions + any address).
 * Without it, search uses OpenStreetMap Nominatim.
 */
export default function LocationMiniMap({
  latitude,
  longitude,
  onCoordinatesChange,
  className,
  mapHeightClassName = 'h-[220px] min-h-[180px]',
}: LocationMiniMapProps) {
  const googleApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    ensureLeafletDefaultIcon();
  }, []);

  const parsed = useMemo(
    () => parsePair(latitude, longitude),
    [latitude, longitude],
  );

  const center: [number, number] = parsed ?? DEFAULT_MAP_CENTER;

  const applyCoords = useCallback(
    (lat: number, lng: number) => {
      onCoordinatesChange(formatCoord(lat), formatCoord(lng));
    },
    [onCoordinatesChange],
  );

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      applyCoords(lat, lng);
    },
    [applyCoords],
  );

  const runNominatimSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchError('Enter a place name or address.');
      return;
    }
    setSearchError(null);
    setSearchBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      });
      if (!res.ok) throw new Error('Search failed.');
      const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
      const first = data[0];
      if (!first?.lat || !first?.lon) {
        setSearchError('No results found.');
        return;
      }
      const lat = Number.parseFloat(first.lat);
      const lng = Number.parseFloat(first.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSearchError('Invalid result.');
        return;
      }
      applyCoords(lat, lng);
    } catch {
      setSearchError('Could not search. Try again.');
    } finally {
      setSearchBusy(false);
    }
  }, [applyCoords, searchQuery]);

  const onGooglePlaceSelected = useCallback(
    (lat: number, lng: number, _description: string) => {
      applyCoords(lat, lng);
    },
    [applyCoords],
  );

  return (
    <div className={cn('space-y-3', className)}>
      {googleApiKey ? (
        <GooglePlacesSearch apiKey={googleApiKey} biasCenter={center} onPlaceSelected={onGooglePlaceSelected} />
      ) : (
        <NominatimSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchBusy={searchBusy}
          searchError={searchError}
          setSearchError={setSearchError}
          runSearch={runNominatimSearch}
        />
      )}

      <div
        className={cn(
          'relative z-0 w-full overflow-hidden rounded-[10px] border border-border bg-muted/20 shadow-inner',
          mapHeightClassName,
        )}
      >
        <MapContainer
          center={center}
          zoom={parsed ? 15 : 12}
          className={cn('h-full w-full [&_.leaflet-container]:z-0 [&_.leaflet-container]:h-full')}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewSync position={center} />
          <MapClickSelect onPick={onMapClick} />
          {parsed ? (
            <Marker
              position={parsed}
              draggable
              eventHandlers={{
                dragend: e => {
                  const ll = e.target.getLatLng();
                  applyCoords(ll.lat, ll.lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      {parsed ? (
        <p className="text-xs font-mono text-foreground/90 rounded-[10px] border border-border bg-muted/30 px-3 py-2">
          <span className="font-semibold text-muted-foreground mr-2">Pin:</span>
          {formatCoord(parsed[0])}, {formatCoord(parsed[1])}
        </p>
      ) : (
        <p className="text-xs text-amber-800/90 bg-amber-50 border border-amber-200/80 rounded-[10px] px-3 py-2">
          Tap the map or search to place a pin — latitude and longitude are saved when you confirm.
        </p>
      )}
    </div>
  );
}
