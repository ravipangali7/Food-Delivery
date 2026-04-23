import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_MAP_CENTER, type LocationMiniMapProps } from '@/components/maps/mapDefaults';
import '@/lib/leafletDefaultIcons';
import { nominatimReverse, nominatimSearch, type NominatimResult } from '@/lib/nominatim';
import 'leaflet/dist/leaflet.css';

function formatCoord(value: number): string {
  const rounded = Math.round(value * 1e8) / 1e8;
  return String(rounded);
}

function parsePair(latStr: string, lngStr: string): { lat: number; lng: number } | null {
  const lat = Number.parseFloat(latStr.trim());
  const lng = Number.parseFloat(lngStr.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;
const REVERSE_GEOCODE_DEBOUNCE_MS = 450;

/** min lon, min lat, max lon, max lat — prefer Nepal for suggestions */
const NEPAL_VIEWBOX = { west: 80, south: 26.2, east: 88.4, north: 30.5 };

type MapClickHandlerProps = { onMapClick: (lat: number, lng: number) => void };
function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    const c = map.getContainer();
    const p = c.parentElement ?? c;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(p);
    map.invalidateSize();
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function OsmTypeahead({ onPlaceSelected }: { onPlaceSelected: (lat: number, lng: number, description: string) => void }) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<NominatimResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const q = query.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (q.length < MIN_QUERY_LEN) {
      setPredictions([]);
      setSearchBusy(false);
      setSearchError(null);
      return;
    }
    setSearchBusy(true);
    setSearchError(null);
    debounceRef.current = setTimeout(() => {
      const my = ++requestIdRef.current;
      void nominatimSearch(q, { countryCodes: 'np', viewbox: NEPAL_VIEWBOX }).then(
        r => {
          if (my !== requestIdRef.current) return;
          setSearchBusy(false);
          setPredictions(r);
          if (r.length) setListOpen(true);
        },
        () => {
          if (my !== requestIdRef.current) return;
          setSearchBusy(false);
          setSearchError('Could not load suggestions. Try again.');
          setPredictions([]);
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query]);

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
          placeholder="Search street, area, ward, or state in Nepal…"
          className="w-full rounded-[10px] border border-border bg-background py-2.5 pl-3 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          aria-label="Search location"
          aria-autocomplete="list"
          autoComplete="off"
        />
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
          aria-hidden
        >
          {searchBusy ? '…' : ''}
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
              <li key={p.placeId}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted/80"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onPlaceSelected(p.lat, p.lng, p.label);
                    setQuery(p.label.slice(0, 200));
                    setPredictions([]);
                    setListOpen(false);
                  }}
                >
                  <span className="text-foreground line-clamp-2">{p.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-border bg-muted/20 px-2 py-1.5 text-[10px] text-muted-foreground">
            Search: OpenStreetMap Nominatim. Results biased to Nepal; tap a row or the map to place the pin.
          </p>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Choose a suggestion to drop the pin, or tap the map (the address line updates from the pin).
      </p>
    </div>
  );
}

export default function LocationMiniMapOsm({
  latitude,
  longitude,
  onCoordinatesChange,
  onSearchPlaceLabel,
  className,
  mapHeightClassName = 'h-[220px] min-h-[180px]',
}: LocationMiniMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseRequestIdRef = useRef(0);

  const parsed = useMemo(
    () => parsePair(latitude, longitude),
    [latitude, longitude],
  );

  const center: { lat: number; lng: number } = useMemo(
    () => (parsed ? { lat: parsed.lat, lng: parsed.lng } : { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] }),
    [parsed],
  );

  const applyCoords = useCallback(
    (lat: number, lng: number, opts?: { fromResolvedSearch?: boolean }) => {
      onCoordinatesChange(formatCoord(lat), formatCoord(lng));
      if (opts?.fromResolvedSearch) {
        reverseRequestIdRef.current += 1;
        if (reverseDebounceRef.current) {
          clearTimeout(reverseDebounceRef.current);
          reverseDebounceRef.current = null;
        }
        return;
      }
      if (reverseDebounceRef.current) {
        clearTimeout(reverseDebounceRef.current);
        reverseDebounceRef.current = null;
      }
      const myReq = ++reverseRequestIdRef.current;
      reverseDebounceRef.current = setTimeout(() => {
        reverseDebounceRef.current = null;
        if (myReq !== reverseRequestIdRef.current) return;
        void nominatimReverse(lat, lng).then(
          addr => {
            if (myReq !== reverseRequestIdRef.current) return;
            onSearchPlaceLabel?.(addr);
          },
          () => {
            if (myReq !== reverseRequestIdRef.current) return;
            onSearchPlaceLabel?.('Unknown address');
          },
        );
      }, REVERSE_GEOCODE_DEBOUNCE_MS);
    },
    [onCoordinatesChange, onSearchPlaceLabel],
  );

  useEffect(
    () => () => {
      if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
    },
    [],
  );

  const onPlaceFromSearch = useCallback(
    (lat: number, lng: number, description: string) => {
      applyCoords(lat, lng, { fromResolvedSearch: true });
      const label = description.trim();
      if (label) onSearchPlaceLabel?.(label);
    },
    [applyCoords, onSearchPlaceLabel],
  );

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      applyCoords(lat, lng);
    },
    [applyCoords],
  );

  const runAddressTextSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchError('Enter a place name, street, or area.');
      return;
    }
    setSearchError(null);
    setSearchBusy(true);
    void nominatimSearch(q, { countryCodes: 'np', viewbox: NEPAL_VIEWBOX })
      .then(r => {
        setSearchBusy(false);
        const first = r[0];
        if (first) {
          onPlaceFromSearch(first.lat, first.lng, first.label);
          setSearchQuery(first.label.slice(0, 120));
        } else {
          setSearchError('No results. Try a nearby road or use the map to tap your location.');
        }
      })
      .catch(() => {
        setSearchBusy(false);
        setSearchError('No results. Try a nearby road or use the map to tap your location.');
      });
  }, [searchQuery, onPlaceFromSearch]);

  return (
    <div className={cn('space-y-3', className)}>
      <OsmTypeahead onPlaceSelected={onPlaceFromSearch} />
      {parsed ? null : (
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
                void runAddressTextSearch();
              }
            }}
            placeholder="Or type an address and press Search (Nepal)…"
            className="flex-1 rounded-[10px] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            aria-label="Address search"
          />
          <button
            type="button"
            onClick={() => void runAddressTextSearch()}
            disabled={searchBusy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
          >
            <Search size={18} strokeWidth={2.25} />
            {searchBusy ? '…' : 'Search'}
          </button>
        </div>
      )}
      {searchError && !parsed ? <p className="text-xs text-destructive">{searchError}</p> : null}

      <div
        className={cn(
          'relative z-0 w-full overflow-hidden rounded-[10px] border border-border bg-muted/20 shadow-inner',
          mapHeightClassName,
        )}
      >
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={parsed ? 15 : 12}
          className="h-full w-full min-h-[160px] z-0"
          scrollWheelZoom
        >
          <MapResizeObserver />
          <MapClickHandler onMapClick={onMapClick} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={19}
          />
          {parsed ? (
            <Marker
              position={[parsed.lat, parsed.lng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const p = m.getLatLng();
                  applyCoords(p.lat, p.lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      {parsed ? (
        <p className="text-xs font-mono text-foreground/90 rounded-[10px] border border-border bg-muted/30 px-3 py-2">
          <span className="font-semibold text-muted-foreground mr-2">Pin:</span>
          {formatCoord(parsed.lat)}, {formatCoord(parsed.lng)}
        </p>
      ) : (
        <p className="text-xs text-amber-800/90 bg-amber-50 border border-amber-200/80 rounded-[10px] px-3 py-2">
          Tap the map or use search to place a pin — latitude and longitude are saved when you confirm.
        </p>
      )}
    </div>
  );
}
