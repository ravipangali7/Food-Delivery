import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import type { SuperSetting } from '@/types';

export default function CustomerTerms() {
  const { data: s } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const store = s?.name ?? 'the store';

  return (
    <div className="pb-8">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/profile" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Terms &amp; conditions</h1>
      </div>

      <div className="px-4 py-6 space-y-5 text-sm text-muted-foreground leading-relaxed max-w-prose mx-auto">
        <p>
          These terms describe how orders, payments, and delivery work in this application, consistent with our data
          model: each order has a status lifecycle, line items, delivery address, and optional coordinates for routing.
        </p>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Orders</h2>
          <p>
            When you place an order, we create an order record with a unique order number, your cart lines as order items,
            and totals for subtotal, delivery fee, and amount due. Orders move through statuses such as pending,
            confirmed, preparing, ready for delivery, out for delivery, delivered, or cancelled, as reflected in the
            system.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Payment</h2>
          <p>
            Payment is <strong className="text-foreground">cash on delivery</strong> only. You agree to pay the rider
            the order total when your order arrives. This matches the supported payment method on each order.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Delivery fee</h2>
          <p>
            Delivery charges may depend on distance from {store}
            {s?.delivery_charge_per_km != null
              ? ` (per-km rate is configured in store settings, currently NPR ${String(s.delivery_charge_per_km)} per km where distance applies)`
              : ''}
            . Fees are included in your order total at checkout when applicable.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Address &amp; delivery</h2>
          <p>
            You are responsible for accurate delivery address and, where used, map pin coordinates. Special instructions
            you provide are stored on the order for the kitchen and delivery partner.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Cancellations</h2>
          <p>
            Cancellation rules follow the allowed status transitions in the system. You may cancel while an order is still
            pending where the app allows; after preparation or dispatch, cancellation may not be available.
          </p>
        </section>

        <p className="text-xs pt-4 border-t border-border">
          Last updated for app version aligned with Order and SuperSetting models. For store-specific policies, contact{' '}
          {s?.phone?.trim() ? (
            <a href={`tel:${s.phone}`} className="text-amber-700">
              {s.phone}
            </a>
          ) : (
            'the store'
          )}
          .
        </p>
      </div>
    </div>
  );
}
