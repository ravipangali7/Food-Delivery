import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatCurrency, num } from '@/lib/formatting';
import { previewDeliveryFeeNpr } from '@/lib/deliveryPreview';
import { ArrowLeft } from 'lucide-react';
import { getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LocationMiniMap from '@/components/maps/LocationMiniMap';
import type { Cart, CustomerAddress, Order, SuperSetting } from '@/types';

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

  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [showSummary, setShowSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydratedCoordsFromProfile = useRef(false);

  const onCoordinatesChange = useCallback((lat: string, lng: string) => {
    setLatitude(lat);
    setLongitude(lng);
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

  const { data: savedAddresses } = useQuery({
    queryKey: ['savedAddresses', token],
    queryFn: () => getJson<CustomerAddress[]>('/api/addresses/', token),
    enabled: !!token,
  });

  useEffect(() => {
    if (!user) return;
    if (!address.trim() && user.address?.trim()) {
      setAddress(user.address.trim());
    }
  }, [user, address]);

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
      const body: Record<string, unknown> = {
        address: address.trim(),
        special_instructions: instructions.trim() || undefined,
        delivery_latitude: deliveryPosition.lat,
        delivery_longitude: deliveryPosition.lng,
      };
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

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">Delivery address</h3>
          <p className="text-xs text-muted-foreground">
            Enter the full delivery address, then search or tap the map to set the exact drop-off point. A pin is
            required — your profile default loads here when set. That pin is saved with your order and used for
            distance-based delivery when the store location is set in settings.
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

          {savedAddresses && savedAddresses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Saved addresses
              </h4>
              <div className="flex flex-col gap-2">
                {savedAddresses.map(sa => (
                  <button
                    key={sa.id}
                    type="button"
                    onClick={() => {
                      setAddress(sa.address.trim());
                      if (sa.latitude != null && sa.longitude != null) {
                        setLatitude(formatCoord(Number(sa.latitude)));
                        setLongitude(formatCoord(Number(sa.longitude)));
                      }
                    }}
                    className="text-left rounded-xl border border-border px-3 py-2.5 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                  >
                    <p className="text-xs font-semibold text-amber-900">{sa.label || 'Address'}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{sa.address}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            rows={3}
            className="w-full border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            placeholder="Street, area, landmark, floor / flat (required)"
            autoComplete="street-address"
          />

          <div className="pt-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Drop-off location (map)
            </h4>
            <LocationMiniMap
              latitude={latitude}
              longitude={longitude}
              onCoordinatesChange={onCoordinatesChange}
              mapHeightClassName="h-[200px] min-h-[180px]"
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold text-sm mb-2">Special instructions</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Optional notes for the restaurant and delivery partner (allergies, gate code, contact preferences).
          </p>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={2}
            placeholder="Optional — gate codes, allergies, delivery notes"
            className="w-full border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
          />
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
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.product?.name} × {item.quantity}
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
          disabled={!address.trim() || !deliveryPosition || placeOrder.isPending}
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
