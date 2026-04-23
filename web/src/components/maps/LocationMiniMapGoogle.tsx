import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_MAP_CENTER, type LocationMiniMapProps } from '@/components/maps/mapDefaults';
import { useGoogleMapsJavaScriptKey } from '@/hooks/useGoogleMapsJavaScriptKey';

const GOOGLE_MAP_LOADER_ID = 'google-map-tracking';
const GOOGLE_MAP_LIBRARIES: ('geometry' | 'places')[] = ['geometry', 'places'];

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

const SEARCH_DEBOUNCE_MS = 280;
const MIN_GOOGLE_QUERY_LEN = 2;
const BIAS_RADIUS_M = 85_000;
const REVERSE_GEOCODE_DEBOUNCE_MS = 450;

type MapCenter = { lat: number; lng: number };

function GooglePlacesSearch({
  isScriptLoaded,
  loadError: scriptLoadError,
  biasCenter,
  onPlaceSelected,
}: {
  isScriptLoaded: boolean;
  loadError: Error | undefined;
  biasCenter: MapCenter;
  onPlaceSelected: (lat: number, lng: number, description: string) => void;
}) {
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
    if (!isScriptLoaded || scriptLoadError) return;
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
        center: biasCenter,
        radius: BIAS_RADIUS_M,
      });

      service.getPlacePredictions(
        {
          input: q,
          sessionToken: sessionToken ?? undefined,
          locationBias: circle,
          componentRestrictions: { country: ['np'] },
        },
        (results, status) => {
          if (myRequest !== requestIdRef.current) return;
          setSearchBusy(false);
          if (
            status !== google.maps.places.PlacesServiceStatus.OK &&
            status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS
          ) {
            if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              setSearchError('Location search was denied. Check that the Places API is enabled for the Maps key.');
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
  }, [query, isScriptLoaded, scriptLoadError, biasCenter, ensureSessionToken]);

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

  if (scriptLoadError) {
    return (
      <p className="text-xs text-destructive" role="status">
        Google Maps failed to load. {scriptLoadError.message}
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
          placeholder={isScriptLoaded ? 'Search street, area, ward, or state in Nepal…' : 'Loading location search…'}
          disabled={!isScriptLoaded}
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
          {!isScriptLoaded ? '…' : searchBusy ? '…' : ''}
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
        Suggestions are limited to Nepal. Choose one to drop the pin, or tap the map (the address line updates from the
        pin).
      </p>
    </div>
  );
}

const mapStyle = { width: '100%', height: '100%' };

export default function LocationMiniMapGoogle(props: LocationMiniMapProps) {
  const { apiKey, isLoadingKey, keyError, keyErrorStatus } = useGoogleMapsJavaScriptKey();

  if (isLoadingKey) {
    return <p className="text-sm text-muted-foreground">Loading map…</p>;
  }

  if (!apiKey) {
    return (
      <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200/80 rounded-[10px] px-3 py-2" role="status">
        {keyError
          ? keyError
          : 'Google Maps is unavailable. Check the Infelo map subscription on the server.'}
        {keyErrorStatus != null ? ` (HTTP ${keyErrorStatus})` : ''}
      </p>
    );
  }

  return <LocationMiniMapWithKey apiKey={apiKey} {...props} />;
}

function LocationMiniMapWithKey({
  apiKey,
  latitude,
  longitude,
  onCoordinatesChange,
  onSearchPlaceLabel,
  className,
  mapHeightClassName = 'h-[220px] min-h-[180px]',
}: LocationMiniMapProps & { apiKey: string }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAP_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseRequestIdRef = useRef(0);
  const mapRef = useRef<google.maps.Map | null>(null);

  const parsed = useMemo(
    () => parsePair(latitude, longitude),
    [latitude, longitude],
  );

  const center: MapCenter = useMemo(
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
        if (typeof google === 'undefined' || !google.maps?.Geocoder) {
          if (onSearchPlaceLabel) {
            onSearchPlaceLabel('Unknown address');
          }
          return;
        }
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (myReq !== reverseRequestIdRef.current) return;
          if (status !== google.maps.GeocoderStatus.OK || !results?.length) {
            onSearchPlaceLabel?.('Unknown address');
            return;
          }
          onSearchPlaceLabel?.(results[0].formatted_address?.trim() || 'Unknown address');
        });
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

  const onGooglePlaceSelected = useCallback(
    (lat: number, lng: number, description: string) => {
      applyCoords(lat, lng, { fromResolvedSearch: true });
      const label = description.trim();
      if (label) onSearchPlaceLabel?.(label);
    },
    [applyCoords, onSearchPlaceLabel],
  );

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng == null) return;
      applyCoords(e.latLng.lat(), e.latLng.lng());
    },
    [applyCoords],
  );

  const onMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng == null) return;
      applyCoords(e.latLng.lat(), e.latLng.lng());
    },
    [applyCoords],
  );

  const runAddressTextSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchError('Enter a place name, street, or area.');
      return;
    }
    if (!isLoaded || typeof google === 'undefined' || !google.maps?.Geocoder) return;
    setSearchError(null);
    setSearchBusy(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: q, region: 'np' }, (results, status) => {
      setSearchBusy(false);
      if (status === google.maps.GeocoderStatus.OK && results?.[0]?.geometry?.location) {
        const l = results[0].geometry.location;
        onGooglePlaceSelected(l.lat(), l.lng(), results[0].formatted_address || q);
        setSearchQuery((results[0].formatted_address || q).slice(0, 120));
        return;
      }
      setSearchError('No results. Try a nearby road or use the map to tap your location.');
    });
  }, [isLoaded, searchQuery, onGooglePlaceSelected]);

  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="status">
        Google Maps could not be loaded. {String(loadError)}
      </p>
    );
  }

  if (!isLoaded) {
    return <p className="text-sm text-muted-foreground">Loading map…</p>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <GooglePlacesSearch
        isScriptLoaded={isLoaded}
        loadError={loadError}
        biasCenter={center}
        onPlaceSelected={onGooglePlaceSelected}
      />
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
        <GoogleMap
          mapContainerStyle={mapStyle}
          center={center}
          zoom={parsed ? 15 : 12}
          onClick={onMapClick}
          onLoad={m => {
            mapRef.current = m;
            google.maps.event.trigger(m, 'resize');
          }}
          onUnmount={() => {
            mapRef.current = null;
          }}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
        >
          {parsed ? (
            <Marker
              position={parsed}
              draggable
              onDragEnd={onMarkerDragEnd}
            />
          ) : null}
        </GoogleMap>
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
