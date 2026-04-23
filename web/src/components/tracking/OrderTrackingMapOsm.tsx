import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { OrderDeliveryType, OrderTrackingPayload } from '@/types';
import { decodeGooglePolyline } from '@/lib/decodeGooglePolyline';
import { type OrderTrackingMapProps } from '@/components/tracking/orderTrackingMapProps';
import '@/lib/leafletDefaultIcons';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [27.7172, 85.324];

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

function driverLeafletIcon(deliveryType: OrderDeliveryType | undefined): L.DivIcon {
  return L.divIcon({
    className: 'border-0 bg-transparent',
    html: `<img src="${svgDataUri(deliveryType)}" width="44" height="44" alt="" draggable="false" style="display:block" />`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function MapResizeObserverOsm() {
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

function FitTrackingOsm({ points, revision }: { points: [number, number][]; revision: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56] });
  }, [map, points, revision]);
  return null;
}

function buildRouteLine(data: OrderTrackingPayload | null, restaurant: LatLng | null, destination: LatLng | null): LatLng[] {
  const enc = data?.route_polyline?.trim();
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
}

function pointsForBounds(
  restaurant: LatLng | null,
  destination: LatLng | null,
  driverRaw: LatLng | null,
  route: LatLng[],
): [number, number][] {
  const pts: [number, number][] = [];
  if (restaurant) pts.push([restaurant.lat, restaurant.lng]);
  if (destination) pts.push([destination.lat, destination.lng]);
  if (driverRaw) pts.push([driverRaw.lat, driverRaw.lng]);
  if (pts.length >= 2) return pts;
  if (route.length > 1) return route.map(p => [p.lat, p.lng] as [number, number]);
  if (pts.length === 1) return pts;
  if (route.length === 1) {
    return [[route[0].lat, route[0].lng]];
  }
  return [defaultCenter];
}

export default function OrderTrackingMapOsm({ data, className, variant = 'default' }: OrderTrackingMapProps) {
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

  const routePath = useMemo(
    () => buildRouteLine(data, restaurant, destination),
    [data, restaurant, destination],
  );

  const linePositions: [number, number][] = useMemo(
    () => routePath.map(p => [p.lat, p.lng] as [number, number]),
    [routePath],
  );

  const fitPoints = useMemo(
    () => pointsForBounds(restaurant, destination, driverRaw, routePath),
    [restaurant, destination, driverRaw, routePath],
  );

  const fitRevision = useMemo(
    () =>
      `${data?.order_id ?? 0}|${data?.route_polyline ?? ''}|` +
      `${restaurant ? `${restaurant.lat},${restaurant.lng}` : ''};` +
      `${destination ? `${destination.lat},${destination.lng}` : ''};` +
      `${driverRaw ? `${driverRaw.lat},${driverRaw.lng}` : ''}`,
    [data?.order_id, data?.route_polyline, restaurant, destination, driverRaw],
  );

  const center: [number, number] = useMemo(() => {
    if (destination) return [destination.lat, destination.lng];
    if (restaurant) return [restaurant.lat, restaurant.lng];
    return defaultCenter;
  }, [destination, restaurant]);

  const rounded = variant === 'live' ? 'rounded-none' : 'rounded-xl';
  const lineWeight = variant === 'live' ? 6 : 5;

  return (
    <div
      className={`relative min-h-[280px] h-full min-h-0 overflow-hidden ${rounded} ${className ?? ''}`}
    >
      <MapContainer
        center={center}
        zoom={13}
        className="h-full w-full min-h-[200px] z-0"
        scrollWheelZoom
        zoomControl={variant !== 'live'}
      >
        <MapResizeObserverOsm />
        <FitTrackingOsm points={fitPoints} revision={fitRevision} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={19}
        />
        {restaurant && (
          <CircleMarker
            center={[restaurant.lat, restaurant.lng]}
            radius={11}
            pathOptions={{
              color: '#2563eb',
              weight: 3,
              fillColor: '#ffffff',
              fillOpacity: 1,
            }}
          />
        )}
        {destination && (
          <CircleMarker
            center={[destination.lat, destination.lng]}
            radius={10}
            pathOptions={{
              color: '#dc2626',
              weight: 2,
              fillColor: '#dc2626',
              fillOpacity: 1,
            }}
          />
        )}
        {linePositions.length > 1 && (
          <Polyline
            positions={linePositions}
            pathOptions={{ color: '#0284c7', opacity: 0.95, weight: lineWeight }}
          />
        )}
        {driverSmooth && data?.tracking_phase === 'on_the_way' && (
          <Marker
            position={[driverSmooth.lat, driverSmooth.lng]}
            icon={driverLeafletIcon(deliveryMode)}
            zIndexOffset={1000}
          />
        )}
      </MapContainer>
    </div>
  );
}
