import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatCurrency, num } from '@/lib/formatting';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order, User } from '@/types';

export default function AdminUserView() {
  const { id } = useParams();
  const { token } = useAuth();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id, token],
    queryFn: () => getJson<User>(`/api/admin/users/${id}/`, token),
    enabled: !!token && !!id,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', token],
    queryFn: () => getJson<Order[]>('/api/orders/', token),
    enabled: !!token,
  });

  const userOrders = orders.filter(o => o.user_id === Number(id));

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  if (isLoading || !user) {
    return <div className="p-8 text-muted-foreground">{isLoading ? 'Loading…' : 'Not found'}</div>;
  }

  const backPath = user.is_delivery_boy ? '/admin/delivery-boys' : '/admin/customers';
  const editPath = user.is_delivery_boy
    ? `/admin/delivery-boys/${id}/edit`
    : `/admin/customers/${id}/edit`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={backPath} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-display font-bold">{user.name}</h1>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Phone:</span> {user.phone}
        </p>
        <p>
          <span className="text-muted-foreground">Address:</span> {user.address || '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Joined:</span> {formatDate(user.created_at)}
        </p>
        <p>
          <span className="text-muted-foreground">Roles:</span>{' '}
          {user.is_staff ? 'Staff ' : ''}
          {user.is_delivery_boy ? 'Delivery ' : ''}
          {!user.is_staff && !user.is_delivery_boy ? 'Customer' : ''}
        </p>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Orders ({userOrders.length})</h2>
        <div className="space-y-2">
          {userOrders.slice(0, 10).map(o => (
            <Link
              key={o.id}
              to={`/admin/orders/${o.id}`}
              className="block bg-card border border-border rounded-lg p-3 text-sm hover:border-primary"
            >
              {o.order_number} · {formatCurrency(num(o.total_amount))} · {o.status}
            </Link>
          ))}
        </div>
      </div>

      <Link to={editPath} className="text-primary text-sm">
        Edit user →
      </Link>
    </div>
  );
}
