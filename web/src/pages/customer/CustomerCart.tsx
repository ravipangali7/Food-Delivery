import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { formatCurrency, num, unitLabel, unitLabelFromUnit } from '@/lib/formatting';
import { useCart } from '@/hooks/useCart';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  isCheckoutPersonalDetailsValid,
  phoneDigitsOnly,
  readGuestCheckoutDetails,
  writeGuestCheckoutDetails,
} from '@/lib/guestCheckoutDetails';
import type { CartItem, SuperSetting } from '@/types';

export default function CustomerCart() {
  const { user } = useAuth();
  const { cart, isLoading, setLineQuantity, clearAll } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  useEffect(() => {
    if (user) {
      setCustomerName(user.name?.trim() ?? '');
      setCustomerPhone(user.phone ?? '');
      return;
    }
    const stored = readGuestCheckoutDetails();
    setCustomerName(stored?.name ?? '');
    setCustomerPhone(stored?.phone ?? '');
  }, [user]);

  const personalDetailsReady = isCheckoutPersonalDetailsValid(customerName, customerPhone);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const items = cart?.items ?? [];
  const subtotal = num(cart?.subtotal);
  const total = num(cart?.total);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading cart…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] px-8 text-center">
        <ShoppingCart size={64} className="text-stone-200 mb-4" />
        <h2 className="font-display font-bold text-lg">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground mt-1">Add some delicious items!</p>
        <Link
          to="/customer/explore"
          className="mt-4 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-full text-sm"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center justify-between">
        <h1 className="font-display font-bold text-lg">My Cart</h1>
        <button
          type="button"
          onClick={() => clearAll.mutate()}
          className="text-red-500 text-xs flex items-center gap-1"
        >
          <Trash2 size={14} /> Clear All
        </button>
      </div>
      <div className="px-4 py-4 space-y-3">
        {items.map(item => {
          const thumb = item.product?.thumbnail_url || item.product?.images?.[0]?.image_url;
          return (
            <div key={item.id} className="flex gap-3 bg-card rounded-xl border border-border p-3">
              {thumb ? (
                <img src={thumb} alt="" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-amber-50 flex items-center justify-center">🍬</div>
              )}
              <div className="flex-1">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">{item.product?.name}</h3>
                    {item.is_preorder ? (
                      <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                        Pre-order
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLineQuantity.mutate({
                        item,
                        quantity: 0,
                        product: item.product,
                      })
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {item.variant
                    ? item.variant.display_label ||
                      item.variant.label ||
                      unitLabelFromUnit(item.variant.unit)
                    : item.product
                      ? unitLabel(item.product)
                      : ''}
                </p>
                <p className="text-xs text-amber-600 font-semibold">
                  {formatCurrency(num(item.unit_price))} each
                </p>
                {item.notes && (
                  <p className="text-[10px] italic text-muted-foreground">Note: {item.notes}</p>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5 border border-border rounded-full px-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setLineQuantity.mutate({
                          item,
                          quantity: item.quantity - 1,
                          product: item.product,
                        })
                      }
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setLineQuantity.mutate({
                          item,
                          quantity: item.quantity + 1,
                          product: item.product,
                        })
                      }
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="font-bold text-sm">{formatCurrency(num(item.total_price))}</span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Your details</h2>
          <p className="text-xs text-muted-foreground">
            {user
              ? 'Filled from your account. Update them in your profile if needed.'
              : 'Required for delivery and order updates.'}
          </p>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground" htmlFor="cart-customer-name">
              Full name
            </label>
            <input
              id="cart-customer-name"
              type="text"
              value={customerName}
              onChange={e => {
                const name = e.target.value;
                setCustomerName(name);
                if (!user) {
                  writeGuestCheckoutDetails({ name, phone: customerPhone });
                }
              }}
              readOnly={!!user}
              placeholder="Your full name"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground disabled:opacity-80"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground" htmlFor="cart-customer-phone">
              Phone number
            </label>
            <input
              id="cart-customer-phone"
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={e => {
                const phone = phoneDigitsOnly(e.target.value);
                setCustomerPhone(phone);
                if (!user) {
                  writeGuestCheckoutDetails({ name: customerName, phone });
                }
              }}
              readOnly={!!user}
              placeholder="98XXXXXXXX"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground disabled:opacity-80"
            />
          </div>
          {!personalDetailsReady && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Enter your full name and a valid phone number to continue to checkout.
            </p>
          )}
          {user ? (
            <Link to="/customer/profile/edit?returnTo=/customer/cart" className="text-xs text-amber-700 underline">
              Edit in profile
            </Link>
          ) : null}
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-bold">
            <span>Cart total:</span>
            <span className="text-amber-600 text-lg">{formatCurrency(total)}</span>
          </div>
        </div>

        {settings && !settings.is_open && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-sm text-amber-700">
            Store is closed. Checkout may be unavailable.
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-card border-t border-border space-y-2">
        <p className="text-[11px] text-center text-muted-foreground px-1">
          At checkout, a delivery map pin is required. Sign in to save a default pin on your profile, or set one on the
          map at checkout.
        </p>
        {personalDetailsReady ? (
          <Link
            to="/customer/checkout"
            className="block w-full py-3.5 bg-primary text-primary-foreground text-center font-semibold rounded-full text-sm hover:bg-primary/90"
          >
            Proceed to Checkout
          </Link>
        ) : (
          <span
            className="block w-full py-3.5 bg-amber-500/50 text-white text-center font-semibold rounded-full text-sm cursor-not-allowed"
            aria-disabled="true"
          >
            Proceed to Checkout
          </span>
        )}
      </div>
    </div>
  );
}
