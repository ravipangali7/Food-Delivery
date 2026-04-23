import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatCurrency, num } from '@/lib/formatting';
import { previewDeliveryFeeNpr } from '@/lib/deliveryPreview';
import { ArrowLeft } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LocationMiniMap from '@/components/maps/LocationMiniMap';
import type { Cart, Order, SuperSetting } from '@/types';

type CheckoutRes = { order: Order };

function formatCoord(value: number): string {
  const rounded = Math.round(value * 1e8) / 1e8;
  return String(rounded);
}

function parseLatLng(latStr: string, lngStr: string): { lat: number; lng: number } | null {
  const lat = Number.parseFloat(latStr.trim());
  const lng = Number.parseFloat(lngStr.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function CustomerCheckout() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  /** Human-readable delivery line from map search or reverse-geocode (sent as order address). */
  const [deliveryAddressLine, setDeliveryAddressLine] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [showSummary, setShowSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preOrderLocal, setPreOrderLocal] = useState('');
  const hydratedCoordsFromProfile = useRef(false);

  const onCoordinatesChange = useCallback((lat: string, lng: string) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const onSearchPlaceLabel = useCallback((label: string) => {
    setDeliveryAddressLine(label);
  }, []);

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart', token],
    queryFn: () => getJson<Cart>('/api/cart/', token),
    enabled: !!token,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  useEffect(() => {
    if (!user) return;
    if (!deliveryAddressLine.trim() && user.address?.trim()) {
      setDeliveryAddressLine(user.address.trim());
    }
  }, [user, deliveryAddressLine]);

  useEffect(() => {
    if (!user || hydratedCoordsFromProfile.current) return;
    hydratedCoordsFromProfile.current = true;
    if (user.latitude != null && user.longitude != null) {
      setLatitude(formatCoord(Number(user.latitude)));
      setLongitude(formatCoord(Number(user.longitude)));
    }
  }, [user]);

  const storePosition = useMemo((): { lat: number; lng: number } | null => {
    if (settings?.latitude != null && settings?.longitude != null) {
      return { lat: Number(settings.latitude), lng: Number(settings.longitude) };
    }
    return null;
  }, [settings?.latitude, settings?.longitude]);

  const deliveryPosition = useMemo(() => parseLatLng(latitude, longitude), [latitude, longitude]);

  const hasPreorderItems = useMemo(
    () => (cart?.items ?? []).some(i => Boolean(i.is_preorder)),
    [cart?.items],
  );

  const subtotal = num(cart?.subtotal);
  const chargePerKm = num(settings?.delivery_charge_per_km);
  const { fee: deliveryFee, distanceKm } = previewDeliveryFeeNpr(
    deliveryPosition?.lat,
    deliveryPosition?.lng,
    storePosition?.lat,
    storePosition?.lng,
    chargePerKm,
  );
  const totalPreview = subtotal + deliveryFee;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Not signed in');
      if (!deliveryPosition) {
        throw new Error('Place a map pin for your delivery location (or open Edit Profile to set a default pin).');
      }
      const addr =
        deliveryAddressLine.trim() ||
        `Delivery pin ${deliveryPosition.lat.toFixed(6)}, ${deliveryPosition.lng.toFixed(6)}`;
      const body: Record<string, unknown> = {
        address: addr,
        delivery_latitude: deliveryPosition.lat,
        delivery_longitude: deliveryPosition.lng,
      };
      if (hasPreorderItems) {
        if (!preOrderLocal.trim()) {
          throw new Error('Choose the date and time for your pre-order.');
        }
        const preDt = new Date(preOrderLocal);
        if (Number.isNaN(preDt.getTime()) || preDt.getTime() <= Date.now()) {
          throw new Error('Pre-order date and time must be in the future.');
        }
        body.pre_order_date_time = preDt.toISOString();
      }
      return postJson<CheckoutRes, Record<string, unknown>>('/api/checkout/', body, token);
    },
    onSuccess: data => {
      navigate(`/customer/order/${data.order.id}`, { replace: true });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!token) {
    return (
      <div className="p-8 text-center">
        <Link to="/login" className="text-amber-600">
          Sign in
        </Link>{' '}
        to checkout.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  if (!cart?.items?.length) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty.</p>
        <Link to="/customer/cart" className="text-amber-600">
          Back to cart
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/cart" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Checkout</h1>
      </div>
      <div className="px-4 py-4 space-y-4">
        {settings && !settings.is_open && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-sm text-amber-800">
            Store is closed. Your order may not be accepted until the store opens.
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-emerald-900">Payment</h3>
          <p className="text-sm text-emerald-800 mt-1">Cash on delivery only. Pay the rider when your order arrives.</p>
        </div>

        {hasPreorderItems && (
          <div className="bg-violet-50/90 border border-violet-200 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-sm text-violet-950">Pre-order date and time</h3>
            <p className="text-xs text-violet-900/90">
              When should we have your pre-order sweets ready? Pick a future date and time in your local timezone.
            </p>
            <input
              type="datetime-local"
              value={preOrderLocal}
              onChange={e => setPreOrderLocal(e.target.value)}
              className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white text-foreground"
            />
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">Delivery location</h3>
          <p className="text-xs text-muted-foreground">
            A map pin is required. Search for any street, area, ward, or place in Nepal, pick a result, then fine-tune by
            dragging the pin if needed. Your saved profile pin loads here when set. The text we send with your order comes
            from your search choice or from the pin position (automatic lookup).
          </p>
          {!deliveryPosition && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Map pin required.</span>{' '}
              <Link to="/customer/profile/edit?returnTo=/customer/checkout" className="underline font-medium">
                Set location in profile
              </Link>{' '}
              or place a pin below.
            </div>
          )}

          <div className="pt-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Search or set pin
            </h4>
            <LocationMiniMap
              latitude={latitude}
              longitude={longitude}
              onCoordinatesChange={onCoordinatesChange}
              onSearchPlaceLabel={onSearchPlaceLabel}
              mapHeightClassName="h-[200px] min-h-[180px]"
            />
          </div>

          {deliveryAddressLine.trim() ? (
            <p className="text-xs text-muted-foreground rounded-[10px] border border-border bg-muted/20 px-3 py-2">
              <span className="font-semibold text-foreground">Sent with order: </span>
              {deliveryAddressLine.trim()}
            </p>
          ) : deliveryPosition ? (
            <p className="text-xs text-muted-foreground rounded-[10px] border border-border bg-muted/20 px-3 py-2">
              Use search or nudge the map pin — the line sent to the restaurant updates from your search pick or from the
              pin position.
            </p>
          ) : null}
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <button
            type="button"
            onClick={() => setShowSummary(!showSummary)}
            className="w-full text-left font-semibold text-sm flex justify-between"
          >
            <span>Order summary — {cart.items.length} items</span>
          </button>
          {showSummary && (
            <div className="mt-3 space-y-2 text-sm">
              {cart.items.map(item => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span>
                    {item.product?.name}
                    {item.is_preorder ? (
                      <span className="ml-1 text-[10px] font-semibold text-violet-700">(pre-order)</span>
                    ) : null}{' '}
                    × {item.quantity}
                  </span>
                  <span>{formatCurrency(num(item.total_price))}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Delivery
                    {deliveryPosition && storePosition && distanceKm > 0 ? (
                      <span className="text-[11px] ml-1">(~{distanceKm.toFixed(2)} km)</span>
                    ) : null}
                  </span>
                  <span>{formatCurrency(deliveryFee)}</span>
                </div>
                {!storePosition && (
                  <p className="text-[11px] text-muted-foreground">
                    Store coordinates are not set — distance fee stays NPR 0 until configured in store settings.
                  </p>
                )}
                {storePosition && !deliveryPosition && (
                  <p className="text-[11px] text-muted-foreground">
                    Place a map pin (or search) to include distance in the delivery fee and to place your order.
                  </p>
                )}
                <div className="flex justify-between font-bold">
                  <span>Total due</span>
                  <span className="text-amber-600">{formatCurrency(totalPreview)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-card border-t border-border z-30">
        <button
          type="button"
          disabled={!deliveryPosition || placeOrder.isPending || (hasPreorderItems && !preOrderLocal.trim())}
          onClick={() => {
            setError(null);
            placeOrder.mutate();
          }}
          className="block w-full py-3.5 bg-amber-500 text-white text-center font-semibold rounded-full text-sm hover:bg-amber-600 disabled:opacity-50"
        >
          {placeOrder.isPending ? 'Placing…' : `Place order — ${formatCurrency(totalPreview)}`}
        </button>
      </div>
    </div>
  );
}
