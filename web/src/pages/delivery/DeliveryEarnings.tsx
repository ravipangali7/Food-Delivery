import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency, num } from '@/lib/formatting';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type EarningsRes = {
  days: number;
  total_amount: string;
  total_deliveries: number;
  daily: { date: string | null; deliveries: number; amount: string }[];
};

export default function DeliveryEarnings() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-earnings', token],
    queryFn: () => getJson<EarningsRes>('/api/delivery/earnings/?days=14', token),
    enabled: !!token,
  });

  const total = num(data?.total_amount);
  const totalDeliveries = data?.total_deliveries ?? 0;
  const daily = data?.daily ?? [];

  if (!token) {
    return (
      <div className="p-8 text-center">
        <a href="/login" className="text-amber-600">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-lg">Earnings</h1>
      </div>

      {isLoading && <div className="p-8 text-center text-muted-foreground">Loading…</div>}

      {!isLoading && (
        <div className="px-4 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
              <DollarSign size={20} className="opacity-80" />
              <p className="text-2xl font-bold mt-2">{formatCurrency(total)}</p>
              <p className="text-xs opacity-80">Last {data?.days ?? 14} days</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <TrendingUp size={20} className="text-green-600" />
              <p className="text-2xl font-bold mt-2 text-foreground">{totalDeliveries}</p>
              <p className="text-xs text-muted-foreground">Deliveries</p>
            </div>
          </div>

          <div>
            <h3 className="font-display font-semibold mb-3">Daily Breakdown</h3>
            <div className="space-y-2">
              {daily.map((day, idx) => (
                <div
                  key={day.date ?? `d-${idx}`}
                  className="bg-card border border-border rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                      <Calendar size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{day.date ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{day.deliveries} deliveries</p>
                    </div>
                  </div>
                  <span className="font-semibold text-sm text-foreground">
                    {formatCurrency(num(day.amount))}
                  </span>
                </div>
              ))}
            </div>
            {daily.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No delivered orders in this period.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
