import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatCurrency, num } from '@/lib/formatting';
import { isOutOfDeliveryRadius, previewDeliveryFeeNpr } from '@/lib/deliveryPreview';
import { ArrowLeft } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { clearGuestCart, guestLinesForCheckout } from '@/lib/guestCart';
import {
  clearGuestCheckoutDetails,
  isCheckoutPersonalDetailsValid,
  readGuestCheckoutDetails,
} from '@/lib/guestCheckoutDetails';
import { saveGuestOrderAccess } from '@/lib/guestOrderAccess';
import LocationMiniMap from '@/components/maps/LocationMiniMap';
import { getDefaultDeliveryCoordinates, isUnsetCoordinates } from '@/lib/defaultDeliveryLocation';
import {
  buildPreorderDateTime,
  PREORDER_TIME_SLOTS,
  preorderSlotLabel,
  todayYmdLocal,
  type PreorderTimeSlotId,
} from '@/lib/preorderSlots';
import type { Order, SuperSetting } from '@/types';

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
  const { cart, isLoading, guestLines } = useCart();

  /** मानव-पठनीय डेलिभरी लाइन map search वा reverse-geocode बाट (अर्डर address को रूपमा पठाइन्छ)। */
  const [deliveryAddressLine, setDeliveryAddressLine] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [showSummary, setShowSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preOrderDate, setPreOrderDate] = useState('');
  const [preOrderSlot, setPreOrderSlot] = useState<PreorderTimeSlotId | ''>('');
  const hydratedCoordsFromProfile = useRef(false);
  const appliedDefaultLocation = useRef(false);

  const onCoordinatesChange = useCallback((lat: string, lng: string) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const onSearchPlaceLabel = useCallback((label: string) => {
    setDeliveryAddressLine(label);
  }, []);

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
      return;
    }
    const defaults = getDefaultDeliveryCoordinates();
    setLatitude(defaults.latitude);
    setLongitude(defaults.longitude);
    if (!deliveryAddressLine.trim()) {
      setDeliveryAddressLine(defaults.label);
    }
  }, [user, deliveryAddressLine]);

  useEffect(() => {
    if (user || appliedDefaultLocation.current) return;
    if (!isUnsetCoordinates(latitude, longitude)) return;
    appliedDefaultLocation.current = true;
    const defaults = getDefaultDeliveryCoordinates();
    setLatitude(defaults.latitude);
    setLongitude(defaults.longitude);
    if (!deliveryAddressLine.trim()) {
      setDeliveryAddressLine(defaults.label);
    }
  }, [user, latitude, longitude, deliveryAddressLine]);

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
  const underKmRadius = num(settings?.delivery_under_km);
  const { fee: deliveryFee, distanceKm } = previewDeliveryFeeNpr(
    deliveryPosition?.lat,
    deliveryPosition?.lng,
    storePosition?.lat,
    storePosition?.lng,
    chargePerKm,
  );
  const outOfRadius =
    !!deliveryPosition &&
    !!storePosition &&
    isOutOfDeliveryRadius(distanceKm, underKmRadius);
  const preOrderDateTime = useMemo(() => {
    if (!preOrderDate || !preOrderSlot) return null;
    return buildPreorderDateTime(preOrderDate, preOrderSlot);
  }, [preOrderDate, preOrderSlot]);

  const preOrderReady = hasPreorderItems && preOrderDateTime != null && preOrderDateTime.getTime() > Date.now();

  const totalPreview = subtotal + deliveryFee;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!deliveryPosition) {
        throw new Error('Place a map pin for your delivery location.');
      }
      const addr =
        deliveryAddressLine.trim() ||
        `Delivery pin ${deliveryPosition.lat.toFixed(6)}, ${deliveryPosition.lng.toFixed(6)}`;
      const body: Record<string, unknown> = {
        address: addr,
        delivery_latitude: deliveryPosition.lat,
        delivery_longitude: deliveryPosition.lng,
      };
      if (!token) {
        const guest = readGuestCheckoutDetails();
        if (!guest || !isCheckoutPersonalDetailsValid(guest.name, guest.phone)) {
          throw new Error('Enter your name and phone on the cart page before checkout.');
        }
        body.items = guestLinesForCheckout(guestLines);
        body.guest_name = guest.name.trim();
        body.guest_phone = guest.phone;
      }
      if (hasPreorderItems) {
        if (!preOrderDate.trim() || !preOrderSlot) {
          throw new Error('Choose a delivery date and time slot for your pre-order.');
        }
        if (!preOrderDateTime || preOrderDateTime.getTime() <= Date.now()) {
          throw new Error('Pre-order date and time must be in the future.');
        }
        body.pre_order_date_time = preOrderDateTime.toISOString();
        body.pre_order_time_slot = preorderSlotLabel(preOrderSlot);
      }
      return postJson<CheckoutRes, Record<string, unknown>>('/api/checkout/', body, token);
    },
    onSuccess: data => {
      if (!token && data.order.guest_access_token) {
        saveGuestOrderAccess(data.order.id, data.order.guest_access_token);
        clearGuestCart();
        clearGuestCheckoutDetails();
      }
      navigate(`/customer/order/${data.order.id}`, { replace: true });
    },
    onError: (e: Error) => setError(e.message),
  });

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

  const guestDetails = !token ? readGuestCheckoutDetails() : null;
  const guestDetailsReady =
    !!token || (!!guestDetails && isCheckoutPersonalDetailsValid(guestDetails.name, guestDetails.phone));

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

        {!guestDetailsReady && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Add your name and phone on the{' '}
            <Link to="/customer/cart" className="underline font-medium">
              cart page
            </Link>{' '}
            before placing your order.
          </div>
        )}

        {guestDetails && guestDetailsReady && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-1">
            <h3 className="font-semibold text-sm">Your details</h3>
            <p className="text-sm">{guestDetails.name.trim()}</p>
            <p className="text-sm text-muted-foreground">{guestDetails.phone}</p>
            <Link to="/customer/cart" className="text-xs text-amber-700 underline">
              Edit on cart
            </Link>
          </div>
        )}

        <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-emerald-900">Payment</h3>
          <p className="text-sm text-emerald-800 mt-1">Cash on delivery only. Pay the rider when your order arrives.</p>
        </div>

        {hasPreorderItems && (
          <div className="bg-violet-50/90 border border-violet-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-violet-950">Pre-order delivery schedule</h3>
            <p className="text-xs text-violet-900/90">
              Choose when you would like your sweets or cake delivered. Pre-orders are available for sweets and cakes
              only.
            </p>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-violet-950" htmlFor="preorder-date">
                Delivery date
              </label>
              <input
                id="preorder-date"
                type="date"
                min={todayYmdLocal()}
                value={preOrderDate}
                onChange={e => setPreOrderDate(e.target.value)}
                className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white text-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-violet-950" htmlFor="preorder-slot">
                Delivery time slot
              </label>
              <select
                id="preorder-slot"
                value={preOrderSlot}
                onChange={e => setPreOrderSlot(e.target.value as PreorderTimeSlotId | '')}
                className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white text-foreground"
              >
                <option value="">Select a time slot</option>
                {PREORDER_TIME_SLOTS.map(slot => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
            {preOrderDate && preOrderSlot && preOrderDateTime ? (
              <p className="text-xs text-violet-900 rounded-lg border border-violet-200 bg-white/80 px-3 py-2">
                <span className="font-semibold">Scheduled for:</span>{' '}
                {preOrderDateTime.toLocaleString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            ) : null}
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">Delivery location</h3>
          <p className="text-xs text-muted-foreground">
            Kohalpur is selected by default. Search for any street or area, use your current location, or drag the pin to
            fine-tune. Your saved profile pin loads here when set.
          </p>
          {!deliveryPosition && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Map pin required.</span>{' '}
              {token ? (
                <Link to="/customer/profile/edit?returnTo=/customer/checkout" className="underline font-medium">
                  Set location in profile
                </Link>
              ) : (
                <span>Sign in to save a default pin on your profile</span>
              )}{' '}
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

          {outOfRadius && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              You are out of delivery radius
              {underKmRadius > 0 ? (
                <span className="block text-xs mt-0.5 text-red-700/90">
                  Delivery is limited to {underKmRadius} km from the store (~{distanceKm.toFixed(2)} km away).
                </span>
              ) : null}
            </div>
          )}

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
                <div className="flex justify-between text-muted-foreground gap-2">
                  <span>
                    Delivery
                    {deliveryPosition && storePosition && distanceKm > 0 ? (
                      <span className="text-[11px] block mt-0.5">
                        {chargePerKm > 0
                          ? `${formatCurrency(chargePerKm)}/km × ${distanceKm.toFixed(2)} km`
                          : `~${distanceKm.toFixed(2)} km (no per-km charge set)`}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0">{formatCurrency(deliveryFee)}</span>
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
          disabled={
            !deliveryPosition ||
            outOfRadius ||
            placeOrder.isPending ||
            (hasPreorderItems && !preOrderReady) ||
            !guestDetailsReady
          }
          onClick={() => {
            setError(null);
            if (outOfRadius) {
              setError('You are out of delivery radius');
              return;
            }
            placeOrder.mutate();
          }}
          className="block w-full py-3.5 bg-primary text-primary-foreground text-center font-semibold rounded-full text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {placeOrder.isPending ? 'Placing…' : `Place order — ${formatCurrency(totalPreview)}`}
        </button>
      </div>
    </div>
  );
}
