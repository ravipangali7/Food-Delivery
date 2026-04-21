import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { formatCurrency, num } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { Link } from 'react-router-dom';
import { TrendingUp, Eye } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order, Product } from '@/types';

type DashboardSummary = {
  orders_total: number;
  orders_pending: number;
  orders_by_status: Record<string, number>;
  revenue_delivered_total: string;
  products_count: number;
  customers_count: number;
  delivery_boys_count: number;
};

type RevenueSeriesResponse = {
  days: number;
  points: { date: string; revenue: number }[];
};

type DashboardToday = {
  date: string;
  orders_placed: number;
  revenue: string;
  avg_order_value: string;
  delivered: number;
  cancelled: number;
  delivery_boys: {
    id: number;
    name: string;
    profile_photo: string;
    delivered_today: number;
    availability: 'available' | 'busy';
  }[];
};

const PIE_COLORS = ['#78716c', '#2563eb', '#7c3aed', '#d97706', '#f59e0b', '#16a34a', '#dc2626', '#9a3412'];
const REVENUE_ORANGE = '#f97316';
const REVENUE_GRID = '#e5e7eb';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [revenueRange, setRevenueRange] = useState<7 | 30 | 90>(7);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['admin-dashboard-summary', token],
    queryFn: () => getJson<DashboardSummary>('/api/admin/dashboard/summary/', token),
    enabled: !!token,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', token],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products', token],
    queryFn: () => getJson<Product[]>('/api/admin/products/', token),
    enabled: !!token,
  });

  const { data: revenueSeries, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin-dashboard-revenue', token, revenueRange],
    queryFn: () =>
      getJson<RevenueSeriesResponse>(`/api/admin/dashboard/revenue/?days=${revenueRange}`, token),
    enabled: !!token,
  });

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['admin-dashboard-today', token],
    queryFn: () => getJson<DashboardToday>('/api/admin/dashboard/today/', token),
    enabled: !!token,
  });

  const revenueChartData = useMemo(() => {
    const pts = revenueSeries?.points ?? [];
    return pts.map(p => ({
      ...p,
      label: format(parseISO(p.date), 'MMM d'),
    }));
  }, [revenueSeries]);

  const revenueYAxis = useMemo(() => {
    const maxR = Math.max(...revenueChartData.map(d => d.revenue), 0);
    const step = 2000;
    const top = maxR === 0 ? 8000 : Math.max(step, Math.ceil(maxR / step) * step);
    const ticks: number[] = [];
    for (let t = 0; t <= top; t += step) {
      ticks.push(t);
    }
    return { top, ticks };
  }, [revenueChartData]);

  const orderStatusData = useMemo(() => {
    const ob = summary?.orders_by_status || {};
    return Object.entries(ob).map(([name, value], i) => ({
      name: name.replace(/_/g, ' '),
      value,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [summary]);

  const recent = orders.slice(0, 8);
  const topProducts = products.filter(p => !p.deleted_at).slice(0, 5);

  const kpiCards = summary
    ? [
        {
          label: 'Total revenue (delivered)',
          value: formatCurrency(num(summary.revenue_delivered_total)),
          icon: '💰',
          bg: 'bg-amber-50',
          iconBg: 'bg-amber-100',
        },
        {
          label: 'Total orders',
          value: String(summary.orders_total),
          icon: '🧾',
          bg: 'bg-blue-50',
          iconBg: 'bg-blue-100',
        },
        {
          label: 'Pending orders',
          value: String(summary.orders_pending),
          icon: '⏳',
          bg: 'bg-orange-50',
          iconBg: 'bg-orange-100',
        },
        {
          label: 'Delivery partners',
          value: String(summary.delivery_boys_count),
          icon: '🛵',
          bg: 'bg-green-50',
          iconBg: 'bg-green-100',
        },
      ]
    : [];

  if (!token) {
    return <div className="p-8 text-muted-foreground">Sign in as staff.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90"
        >
          Refresh
        </button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && summary && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border p-5 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground tracking-tight">Revenue Overview</h2>
                <div className="flex gap-2 shrink-0">
                  {([7, 30, 90] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRevenueRange(d)}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                        revenueRange === d
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'bg-muted/80 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {d}D
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[300px] w-full min-w-0">
                {revenueLoading ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Loading chart…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminRevenueAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={REVENUE_ORANGE} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={REVENUE_ORANGE} stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke={REVENUE_GRID}
                        strokeDasharray="4 4"
                        vertical
                        horizontal
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={[0, revenueYAxis.top]}
                        ticks={revenueYAxis.ticks}
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickFormatter={v => String(v)}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0].payload as { revenue: number; date: string };
                          return (
                            <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                              <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
                              <p className="font-semibold text-foreground">{formatCurrency(row.revenue)}</p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={REVENUE_ORANGE}
                        strokeWidth={2}
                        fill="url(#adminRevenueAreaFill)"
                        dot={false}
                        activeDot={{ r: 4, fill: REVENUE_ORANGE, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-[14px] border border-border bg-card p-5 md:p-6 shadow-sm flex flex-col min-h-0">
              {todayLoading || !todayData ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
              ) : (
                <>
                  <h2 className="text-base font-bold text-foreground tracking-tight mb-4">Today&apos;s Stats</h2>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#666666]">Orders placed</dt>
                      <dd className="font-bold text-foreground tabular-nums">{todayData.orders_placed}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#666666]">Revenue</dt>
                      <dd className="font-bold text-foreground tabular-nums">
                        {formatCurrency(num(todayData.revenue))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#666666]">Avg order value</dt>
                      <dd className="font-bold text-foreground tabular-nums">
                        {formatCurrency(num(todayData.avg_order_value))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#666666]">Delivered</dt>
                      <dd className="font-bold tabular-nums text-[#28a745]">{todayData.delivered}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#666666]">Cancelled</dt>
                      <dd className="font-bold tabular-nums text-[#dc3545]">{todayData.cancelled}</dd>
                    </div>
                  </dl>
                  <div className="border-t border-border my-5" />
                  <h2 className="text-base font-bold text-foreground tracking-tight mb-4">Delivery Boys</h2>
                  {todayData.delivery_boys.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No delivery partners yet.</p>
                  ) : (
                    <ul className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-0.5">
                      {todayData.delivery_boys.map(boy => (
                        <li key={boy.id}>
                          <Link
                            to={`/admin/delivery-boys/${boy.id}`}
                            className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 hover:bg-muted/60 transition-colors"
                          >
                            <div className="shrink-0 w-11 h-11 rounded-full bg-[#fff3cd] flex items-center justify-center overflow-hidden border border-amber-100/80">
                              {boy.profile_photo ? (
                                <img
                                  src={boy.profile_photo}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-lg leading-none" aria-hidden>
                                  🛵
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground text-sm truncate">{boy.name}</p>
                              <p className="text-xs text-[#666666]">
                                {boy.delivered_today} delivered today
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 text-xs font-medium px-2.5 py-1 rounded-full',
                                boy.availability === 'available'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-800',
                              )}
                            >
                              {boy.availability === 'available' ? 'Available' : 'Busy'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map(kpi => (
              <div key={kpi.label} className="bg-card rounded-lg shadow-sm border border-border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{kpi.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full ${kpi.iconBg} flex items-center justify-center text-lg`}>
                    {kpi.icon}
                  </div>
                </div>
                <div className="mt-3 text-xs font-medium text-green-600">
                  <TrendingUp size={12} className="inline mr-1" />
                  Live data
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card rounded-lg shadow-sm border border-border p-5">
              <h3 className="font-semibold text-foreground mb-4">Recent orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-muted-foreground text-xs uppercase">
                      <th className="text-left px-4 py-3">Order #</th>
                      <th className="text-left px-4 py-3">Customer</th>
                      <th className="text-left px-4 py-3">Total</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(order => (
                      <tr key={order.id} className="border-b border-border hover:bg-amber-50/50">
                        <td className="px-4 py-3 font-medium text-primary">
                          <Link to={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                        </td>
                        <td className="px-4 py-3">{order.customer?.name}</td>
                        <td className="px-4 py-3 font-semibold">
                          {formatCurrency(num(order.total_amount))}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/orders/${order.id}`}
                            className="text-primary hover:underline text-xs flex items-center gap-1"
                          >
                            <Eye size={14} /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-card rounded-lg shadow-sm border border-border p-5">
              <h3 className="font-semibold text-foreground mb-4">Orders by status</h3>
              {orderStatusData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No order data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                    >
                      {orderStatusData.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm border border-border">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold text-foreground">Products</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-xs uppercase">
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">Price</th>
                    <th className="text-left px-4 py-3">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(p => {
                    const thumb = p.thumbnail_url || p.images?.[0]?.image_url;
                    return (
                      <tr key={p.id} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-10 h-10 rounded-md object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center text-xs">
                                🍬
                              </div>
                            )}
                            <Link
                              to={`/admin/products/${encodeURIComponent(p.slug)}`}
                              className="font-medium hover:underline"
                            >
                              {p.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3">{formatCurrency(num(p.price))}</td>
                        <td className="px-4 py-3">{p.stock_quantity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
