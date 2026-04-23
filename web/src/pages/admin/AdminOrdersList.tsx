import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, timeAgo, num } from '@/lib/formatting';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { orderStatusLabels, validStatusTransitions } from '@/lib/colors';
import { PreorderScheduleSummary } from '@/components/admin/PreorderScheduleSummary';
import { Search, Download, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteJson, getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order, OrderStatus } from '@/types';

function OrderListStatusEditor({ order }: { order: Order }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [nextChoice, setNextChoice] = useState<OrderStatus | ''>('');
  const allowed = (validStatusTransitions[order.status] || []) as OrderStatus[];

  useEffect(() => {
    setNextChoice('');
  }, [order.id, order.status]);

  const transitionMut = useMutation({
    mutationFn: async () => {
      if (!token || !nextChoice) throw new Error('Select a new status');
      const body: { status: OrderStatus; cancellation_reason?: string } = { status: nextChoice };
      if (nextChoice === 'cancelled') {
        const reason = window.prompt('Cancellation reason (optional):') ?? '';
        if (reason.trim()) body.cancellation_reason = reason.trim();
      }
      return postJson<Order>(`/api/orders/${order.id}/transition/`, body, token);
    },
    onSuccess: () => {
      setNextChoice('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-summary', token] });
      queryClient.invalidateQueries({ queryKey: ['order', String(order.id)] });
      toast.success('Status updated');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Could not update status';
      toast.error(msg);
    },
  });

  return (
    <div className="flex flex-col gap-1.5 min-w-[148px]">
      <OrderStatusBadge status={order.status} />
      {allowed.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <select
            value={nextChoice}
            onChange={e => setNextChoice((e.target.value || '') as OrderStatus | '')}
            className="text-[11px] border border-border rounded-md px-1.5 py-1 bg-card max-w-[132px] outline-none focus:ring-1 focus:ring-primary"
            aria-label={`Change status for order ${order.order_number}`}
          >
            <option value="">Set to…</option>
            {allowed.map(s => (
              <option key={s} value={s}>
                {orderStatusLabels[s] ?? s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-40"
            disabled={!nextChoice || transitionMut.isPending}
            onClick={() => transitionMut.mutate()}
          >
            Apply
          </button>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground">No transitions</span>
      )}
    </div>
  );
}

const statusTabs: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready_for_delivery' },
  { label: 'Out for Delivery', value: 'out_for_delivery' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

function matchesTab(order: Order, tab: string): boolean {
  if (tab === 'all') return true;
  if (tab === 'active') return !['delivered', 'cancelled', 'failed'].includes(order.status);
  if (tab === 'completed') return order.status === 'delivered';
  return order.status === tab;
}

export default function AdminOrdersList() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('status') || 'all';
  const [search, setSearch] = useState('');

  const deleteMut = useMutation({
    mutationFn: (orderId: number) => deleteJson(`/api/orders/${orderId}/`, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-summary', token] });
      toast.success('Order deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not delete order'),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', token],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token,
  });

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (!matchesTab(o, activeTab)) return false;
      if (
        search &&
        !o.order_number.toLowerCase().includes(search.toLowerCase()) &&
        !o.customer?.name?.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [orders, activeTab, search]);

  const setTab = (value: string) => {
    if (value === 'all') searchParams.delete('status');
    else searchParams.set('status', value);
    setSearchParams(searchParams);
  };

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff sign-in required.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Orders</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-primary outline-none w-60"
            />
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-muted text-foreground rounded-lg opacity-50"
            disabled
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setTab(tab.value)}
            className={`px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
              activeTab === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-muted text-muted-foreground text-xs uppercase">
              <th className="text-left px-4 py-3">Order #</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Items</th>
              <th className="text-left px-4 py-3 min-w-[200px]">Pre-order / schedule</th>
              <th className="text-left px-4 py-3">Total</th>
              <th className="text-left px-4 py-3 min-w-[160px]">Status</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Delivery</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id} className="border-b border-border hover:bg-amber-50/50 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link to={`/admin/orders/${order.id}`} className="text-primary hover:underline">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-xs">{order.customer?.name}</div>
                  <div className="text-[10px] text-muted-foreground">{order.customer?.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="bg-muted px-2 py-0.5 rounded text-xs">{order.items?.length} items</span>
                </td>
                <td className="px-4 py-3 align-top">
                  {order.is_preorder ? (
                    <PreorderScheduleSummary order={order} variant="compact" />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(num(order.total_amount))}</td>
                <td className="px-4 py-3 align-top">
                  <OrderListStatusEditor order={order} />
                </td>
                <td className="px-4 py-3 text-xs">
                  <span
                    className={
                      order.payment_status === 'paid' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'
                    }
                  >
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {order.delivery_boy?.name || <span className="text-muted-foreground">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(order.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="View"
                    >
                      <Eye size={16} />
                    </Link>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Edit / manage"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      title="Delete order permanently"
                      disabled={deleteMut.isPending}
                      className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40 disabled:pointer-events-none disabled:hover:text-muted-foreground"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Permanently delete order ${order.order_number}? This cannot be undone.`,
                          )
                        ) {
                          return;
                        }
                        deleteMut.mutate(order.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">No orders found</div>
        )}
      </div>
    </div>
  );
}
