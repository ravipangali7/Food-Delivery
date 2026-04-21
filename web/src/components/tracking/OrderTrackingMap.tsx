import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { OrderDeliveryType, OrderTrackingPayload } from '@/types';
import { decodeGooglePolyline } from '@/lib/decodeGooglePolyline';

import 'leaflet/dist/leaflet.css';

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

function useLeafletDriverIcon(deliveryType: OrderDeliveryType | undefined) {
  return useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<div style="background:transparent;border:none;line-height:0"><img src="${svgDataUri(deliveryType)}" width="44" height="44" alt="" /></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
    [deliveryType],
  );
}

function FitTrackingBounds({
  restaurant,
  destination,
  driverRaw,
  routeLatLngs,
  defaultCtr,
}: {
  restaurant: LatLng | null;
  destination: LatLng | null;
  driverRaw: LatLng | null;
  routeLatLngs: LatLng[];
  defaultCtr: LatLng;
}) {
  const map = useMap();
  useEffect(() => {
    const pts: L.LatLngTuple[] = [];
    if (routeLatLngs.length > 0) {
      routeLatLngs.forEach(p => pts.push([p.lat, p.lng]));
    } else {
      if (restaurant) pts.push([restaurant.lat, restaurant.lng]);
      if (destination) pts.push([destination.lat, destination.lng]);
      if (driverRaw) pts.push([driverRaw.lat, driverRaw.lng]);
    }
    if (pts.length === 0) {
      map.setView([defaultCtr.lat, defaultCtr.lng], 12);
      return;
    }
    if (pts.length === 1) {
      map.setView(pts[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [56, 56] });
  }, [map, restaurant, destination, driverRaw, routeLatLngs, defaultCtr.lat, defaultCtr.lng]);
  return null;
}

/** Leaflet needs invalidateSize when the map container is laid out after mount (e.g. flex/card). */
function LeafletInvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const target = container.parentElement ?? container;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(target);
    map.invalidateSize();
    return () => ro.disconnect();
  }, [map]);
  return null;
}

type Props = {
  data: OrderTrackingPayload | null;
  className?: string;
  /** Satellite + labels, full-bleed styling for live track screen */
  variant?: 'default' | 'live';
};

export default function OrderTrackingMap({ data, className, variant = 'default' }: Props) {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

  if (!apiKey) {
    return <OrderTrackingMapLeaflet data={data} className={className} variant={variant} />;
  }

  return <OrderTrackingMapInner apiKey={apiKey} data={data} className={className} variant={variant} />;
}

function OrderTrackingMapLeaflet({ data, className, variant = 'default' }: Props) {
  const restaurant =
    data?.restaurant.latitude != null && data?.restaurant.longitude != null
      ? { lat: data.restaurant.latitude, lng: data.restaurant.longitude }
      : null;
  const destination =
    data?.destination.latitude != null && data?.destination.longitude != null
      ? { lat: data.destination.latitude, lng: data.destination.longitude }
      : null;
  const driverRaw =
    data?.driver?.latitude != null && data?.driver?.longitude != null
      ? { lat: data.driver.latitude, lng: data.driver.longitude }
      : null;

  const driverSmooth = useSmoothedPosition(driverRaw);
  const deliveryMode = data?.delivery_type;
  const driverLeafletIcon = useLeafletDriverIcon(deliveryMode);

  const routePath = useMemo(() => {
    if (!data) return [] as LatLng[];
    const enc = data.route_polyline?.trim();
    if (enc) {
      try {
        return decodeGooglePolyline(enc);
      } catch {
        return [];
      }
    }
    if (restaurant && destination) {
      return [restaurant, destination];
    }
    return [];
  }, [data, restaurant, destination]);

  const center = useMemo(() => {
    if (destination) return destination;
    if (restaurant) return restaurant;
    return defaultCenter;
  }, [destination, restaurant]);

  const rounded = variant === 'live' ? 'rounded-none' : 'rounded-xl';
  const polyWeight = variant === 'live' ? 6 : 5;

  return (
    <div
      className={`relative min-h-[280px] h-full min-h-0 overflow-hidden ${rounded} ${className ?? ''}`}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        className="h-full w-full [&_.leaflet-container]:z-0 [&_.leaflet-container]:h-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletInvalidateOnResize />
        <FitTrackingBounds
          restaurant={restaurant}
          destination={destination}
          driverRaw={driverRaw}
          routeLatLngs={routePath}
          defaultCtr={defaultCenter}
        />
        {routePath.length > 1 && (
          <LeafletPolyline
            positions={routePath.map(p => [p.lat, p.lng] as L.LatLngTuple)}
            pathOptions={{
              color: '#0284c7',
              opacity: 0.95,
              weight: polyWeight,
            }}
          />
        )}
        {restaurant && (
          <CircleMarker
            center={[restaurant.lat, restaurant.lng]}
            radius={9}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: 3,
            }}
          />
        )}
        {destination && (
          <CircleMarker
            center={[destination.lat, destination.lng]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#dc2626',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}
        {driverSmooth && data?.tracking_phase === 'on_the_way' && (
          <LeafletMarker position={[driverSmooth.lat, driverSmooth.lng]} icon={driverLeafletIcon} />
        )}
      </MapContainer>
    </div>
  );
}

function OrderTrackingMapInner({
  apiKey,
  data,
  className,
  variant = 'default',
}: Props & { apiKey: string }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-tracking',
    googleMapsApiKey: apiKey,
    /** `places` is bundled so checkout/address search can reuse the same script (libraries are fixed on first load). */
    libraries: ['geometry', 'places'],
  });

  const restaurant =
    data?.restaurant.latitude != null && data?.restaurant.longitude != null
      ? { lat: data.restaurant.latitude, lng: data.restaurant.longitude }
      : null;
  const destination =
    data?.destination.latitude != null && data?.destination.longitude != null
      ? { lat: data.destination.latitude, lng: data.destination.longitude }
      : null;
  const driverRaw =
    data?.driver?.latitude != null && data?.driver?.longitude != null
      ? { lat: data.driver.latitude, lng: data.driver.longitude }
      : null;

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
      <div className={`flex items-center justify-center bg-muted/50 text-muted-foreground text-sm ${className ?? ''}`}>
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
