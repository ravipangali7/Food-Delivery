import type { OrderTrackingPayload } from '@/types';

function formatDistanceM(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return '—';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 30) return '—';
  const m = Math.round(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  }
  return `${Math.max(1, m)} min`;
}

type Props = {
  data: OrderTrackingPayload | null;
};

export default function LiveTrackingStats({ data }: Props) {
  if (!data) return null;
  const dist =
    data.tracking_phase === 'on_the_way'
      ? data.distance_remaining_meters ?? data.route_distance_meters
      : data.route_distance_meters;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm sm:col-span-1 col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Order status</p>
          <p className="mt-1 text-base sm:text-lg font-bold text-foreground">{data.tracking_status_label}</p>
          {data.route_straight_fallback && data.tracking_phase === 'on_the_way' && (
            <p className="text-[10px] text-muted-foreground mt-1">Straight-line route (enable Directions API for roads)</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {data.tracking_phase === 'on_the_way' ? 'Distance remaining' : 'Route distance'}
          </p>
          <p className="mt-1 text-base sm:text-lg font-bold text-foreground tabular-nums">{formatDistanceM(dist)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ETA</p>
          <p className="mt-1 text-base sm:text-lg font-bold text-foreground tabular-nums">{formatEta(data.eta_seconds)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Payment status
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{data.payment_status_label}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Cash on delivery</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery type</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span aria-hidden>{data.delivery_type === 'walking' ? '🚶' : '🚴'}</span>
            {data.delivery_type_label}
          </p>
        </div>
      </div>
    </div>
  );
}
