import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import type { OrderDeliveryType, OrderTrackingPayload } from '@/types';
import { useGoogleMapsJavaScriptKey } from '@/hooks/useGoogleMapsJavaScriptKey';
import { type OrderTrackingMapProps } from '@/components/tracking/orderTrackingMapProps';

const mapContainerStyle = { width: '100%', height: '100%' };

const defaultCenter = { lat: 27.7172, lng: 85.324 };

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

type LatLng = { lat: number; lng: number };

function useSmoothedPosition(target: LatLng | null): LatLng | null {
  const [display, setDisplay] = useState<LatLng | null>(target);
  const fromRef = useRef<LatLng | null>(null);
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!target) {
      setDisplay(null);
      fromRef.current = null;
      startedRef.current = false;
      return;
    }
    if (!startedRef.current) {
      setDisplay(target);
      fromRef.current = target;
      startedRef.current = true;
      return;
    }
    const from = fromRef.current ?? target;
    fromRef.current = target;
    const start = performance.now();
    const duration = 580;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      setDisplay({
        lat: from.lat + (target.lat - from.lat) * e,
        lng: from.lng + (target.lng - from.lng) * e,
      });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target?.lat, target?.lng]);

  return display;
}

function svgDataUri(deliveryType: OrderDeliveryType | undefined): string {
  const bike = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#0284c7" stroke="#fff" stroke-width="2"/><path fill="#fff" d="M15.5 5.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm-6 1c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm1.2 2.1L9 11h2.2l.45-1.35L13 8.5h2l-1.1 2.2c.35.15.65.4.9.7l1.35-2.4h1.35L16.5 13c-.4.25-.85.4-1.35.4-1.1 0-2-.9-2-2 0-.35.1-.65.25-.95L12 10h-1.1l-.7 2.1c.65.35 1.1 1 1.1 1.8 0 1.1-.9 2-2 2s-2-.9-2-2c0-.75.4-1.4 1-1.75l.9-2.75z"/></svg>`;
  const walk = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#0284c7" stroke="#fff" stroke-width="2"/><path fill="#fff" d="M13.5 5.5a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM9 20v-6l-1.5 3H6l1.5-5.5a1 1 0 011-.75h1l1.5-2 1 1-1.5 2.2V20H9zm6.5-8.5l-1.2 1.2L14 20h-2l-.3-4.5 1.8-1.8 1-3.2h2z"/></svg>`;
  const raw = deliveryType === 'walking' ? walk : bike;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(raw)}`;
}

function driverMapIcon(deliveryType: OrderDeliveryType | undefined): google.maps.Icon | undefined {
  if (typeof google === 'undefined' || !google.maps) return undefined;
  return {
    url: svgDataUri(deliveryType),
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22),
  };
}

const GOOGLE_MAP_LIBRARIES: ('geometry' | 'places')[] = ['geometry', 'places'];
const LOADER_ID = 'google-map-tracking';

export type { OrderTrackingMapProps } from '@/components/tracking/orderTrackingMapProps';

export default function OrderTrackingMapGoogle({ data, className, variant = 'default' }: OrderTrackingMapProps) {
  const { apiKey, isLoadingKey, keyError, keyErrorStatus } = useGoogleMapsJavaScriptKey();

  if (isLoadingKey) {
    return (
      <div className={`flex min-h-[280px] h-full min-h-0 items-center justify-center bg-muted/50 text-muted-foreground text-sm ${className ?? ''}`}>
        Loading map…
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div
        className={`flex min-h-[280px] h-full min-h-0 items-center justify-center border border-amber-200/80 bg-amber-50 px-4 text-center text-amber-900 text-sm ${className ?? ''}`}
        role="status"
      >
        {keyError
          ? keyError
          : 'Google Maps is unavailable. Check the Infelo map subscription and that the server can reach Infelo.'}
        {keyErrorStatus != null ? ` (HTTP ${keyErrorStatus})` : ''}
      </div>
    );
  }

  return <OrderTrackingMapInner apiKey={apiKey} data={data} className={className} variant={variant} />;
}

function OrderTrackingMapInner({
  apiKey,
  data,
  className,
  variant = 'default',
}: OrderTrackingMapProps & { apiKey: string }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const restaurant = useMemo((): LatLng | null => {
    if (data?.restaurant.latitude == null || data?.restaurant.longitude == null) return null;
    return { lat: data.restaurant.latitude, lng: data.restaurant.longitude };
  }, [data?.restaurant.latitude, data?.restaurant.longitude]);

  const destination = useMemo((): LatLng | null => {
    if (data?.destination.latitude == null || data?.destination.longitude == null) return null;
    return { lat: data.destination.latitude, lng: data.destination.longitude };
  }, [data?.destination.latitude, data?.destination.longitude]);

  const driverRaw = useMemo((): LatLng | null => {
    if (data?.driver?.latitude == null || data?.driver?.longitude == null) return null;
    return { lat: data.driver.latitude, lng: data.driver.longitude };
  }, [data?.driver?.latitude, data?.driver?.longitude]);

  const driverSmooth = useSmoothedPosition(driverRaw);

  const deliveryMode = data?.delivery_type;

  const routePath = useMemo(() => {
    if (!isLoaded || !data || typeof google === 'undefined' || !google.maps?.geometry?.encoding) {
      return [] as LatLng[];
    }
    const enc = data.route_polyline?.trim();
    if (enc) {
      try {
        return google.maps.geometry.encoding.decodePath(enc).map(p => ({ lat: p.lat(), lng: p.lng() }));
      } catch {
        return [];
      }
    }
    if (restaurant && destination) {
      return [restaurant, destination];
    }
    return [];
  }, [isLoaded, data?.route_polyline, restaurant, destination]);

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || typeof google === 'undefined') return;
    const bounds = new google.maps.LatLngBounds();
    let n = 0;
    if (restaurant) {
      bounds.extend(restaurant);
      n++;
    }
    if (destination) {
      bounds.extend(destination);
      n++;
    }
    if (driverRaw) {
      bounds.extend(driverRaw);
      n++;
    }
    if (n >= 2) {
      map.fitBounds(bounds, 56);
    } else if (n === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(14);
    }
  }, [restaurant, destination, driverRaw]);

  useEffect(() => {
    if (isLoaded && data) {
      fitBounds();
    }
  }, [isLoaded, data?.order_id, fitBounds, routePath.length]);

  useEffect(() => {
    if (!mapInstance || typeof google === 'undefined') return;
    const el = mapInstance.getDiv();
    const target = el.parentElement ?? el;
    const ro = new ResizeObserver(() => {
      google.maps.event.trigger(mapInstance, 'resize');
    });
    ro.observe(target);
    google.maps.event.trigger(mapInstance, 'resize');
    return () => ro.disconnect();
  }, [mapInstance]);

  const center = useMemo(() => {
    if (destination) return destination;
    if (restaurant) return restaurant;
    return defaultCenter;
  }, [destination, restaurant]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-red-50 text-red-700 text-sm p-6 ${className ?? ''}`}>
        Could not load Google Maps.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 text-muted-foreground text-sm min-h-[280px] h-full min-h-0 ${className ?? ''}`}>
        Loading map…
      </div>
    );
  }

  const rounded = variant === 'live' ? 'rounded-none' : 'rounded-xl';

  return (
    <div
      className={`relative min-h-[280px] h-full min-h-0 overflow-hidden ${rounded} ${className ?? ''}`}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={13}
        onLoad={map => {
          mapRef.current = map;
          setMapInstance(map);
          fitBounds();
        }}
        onUnmount={() => {
          mapRef.current = null;
          setMapInstance(null);
        }}
        options={{
          fullscreenControl: variant !== 'live',
          streetViewControl: false,
          mapTypeControl: variant === 'live',
          mapTypeId: variant === 'live' ? 'hybrid' : 'roadmap',
        }}
      >
        {restaurant && (
          <Marker
            position={restaurant}
            title={data?.restaurant.name ?? 'Restaurant'}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 11,
              fillColor: '#ffffff',
              fillOpacity: 1,
              strokeColor: '#2563eb',
              strokeWeight: 3,
            }}
          />
        )}
        {destination && (
          <Marker
            position={destination}
            title="Delivery address"
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#dc2626',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        )}
        {routePath.length > 1 && (
          <Polyline
            path={routePath}
            options={{
              strokeColor: '#0284c7',
              strokeOpacity: 0.95,
              strokeWeight: variant === 'live' ? 6 : 5,
              geodesic: true,
            }}
          />
        )}
        {driverSmooth && data?.tracking_phase === 'on_the_way' && (
          <Marker
            position={driverSmooth}
            title={deliveryMode === 'walking' ? 'Delivery (walking)' : 'Delivery (bike)'}
            icon={driverMapIcon(deliveryMode)}
            zIndex={1000}
          />
        )}
      </GoogleMap>
    </div>
  );
}
