import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/formatting';
import { Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteJson, getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types';

function nameInitial(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t[0]!.toUpperCase();
}

function formatLatLng(lat?: number, lng?: number): string {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return '—';
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

export default function AdminUsersList({ type }: { type: 'customers' | 'delivery-boys' }) {
  const [search, setSearch] = useState('');
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const role = type === 'customers' ? 'customers' : 'delivery-boys';

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', role, token],
    queryFn: () => getJson<User[]>(`/api/admin/users/?role=${role}`, token),
    enabled: !!token,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJson(`/api/admin/users/${id}/`, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users', role, token] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-summary', token] });
      toast.success('Deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not remove user'),
  });

  const filtered = useMemo(() => {
    return users.filter(
      u =>
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.phone.includes(search),
    );
  }, [users, search]);

  const onDelete = (u: User) => {
    if (
      !window.confirm(
        `Permanently remove ${u.name} from the list? They can be re-added later if needed.`,
      )
    )
      return;
    deleteMut.mutate(u.id);
  };

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  const isDelivery = type === 'delivery-boys';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-display font-bold text-[#333333]">
          {isDelivery ? 'Delivery partners' : 'Customers'}
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-white text-[#333333] outline-none w-52 placeholder:text-[#777777]"
            />
          </div>
          <Link
            to={isDelivery ? '/admin/delivery-boys/new' : '/admin/customers/new'}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium"
          >
            {isDelivery ? '+ Add delivery partner' : '+ Add user'}
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-[#777777]">Loading…</p>}

      <div className="bg-white rounded-xl border border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9F8F6] text-[#333333]">
                <th className="text-left font-bold uppercase tracking-wide text-xs px-4 py-3.5">User</th>
                <th className="text-left font-bold uppercase tracking-wide text-xs px-4 py-3.5">Phone</th>
                <th className="text-left font-bold uppercase tracking-wide text-xs px-4 py-3.5">Address</th>
                {isDelivery && (
                  <th className="text-left font-bold uppercase tracking-wide text-xs px-4 py-3.5 whitespace-nowrap">
                    Location
                  </th>
                )}
                <th className="text-left font-bold uppercase tracking-wide text-xs px-4 py-3.5">Joined</th>
                <th className="text-center font-bold uppercase tracking-wide text-xs px-4 py-3.5">Active</th>
                <th className="text-right font-bold uppercase tracking-wide text-xs px-4 py-3.5 w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="text-[#777777]">
              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td
                    colSpan={isDelivery ? 7 : 6}
                    className="px-4 py-8 text-center text-[#777777]"
                  >
                    {users.length === 0
                      ? isDelivery
                        ? 'No delivery partners yet.'
                        : 'No customers yet.'
                      : 'No matches for your search.'}
                  </td>
                </tr>
              )}
              {filtered.map(user => (
                <tr key={user.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 text-sm font-semibold"
                        aria-hidden
                      >
                        {nameInitial(user.name)}
                      </span>
                      <span className="font-semibold text-[#333333] truncate">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">{user.phone}</td>
                  <td className="px-4 py-3.5 max-w-[220px]">
                    <span className="line-clamp-2">{user.address?.trim() || '—'}</span>
                  </td>
                  {isDelivery && (
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
                      {formatLatLng(user.latitude, user.longitude)}
                    </td>
                  )}
                  <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3.5 text-center">
                    {user.is_active ? (
                      <span className="inline-block rounded-full bg-[#4CAF50]/12 px-2.5 py-0.5 text-xs font-medium text-[#4CAF50]">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        to={
                          isDelivery
                            ? `/admin/delivery-boys/${user.id}`
                            : `/admin/customers/${user.id}`
                        }
                        title="View"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#333333] hover:bg-[#F9F8F6] transition-colors"
                      >
                        <Eye size={16} strokeWidth={1.75} />
                      </Link>
                      <Link
                        to={
                          isDelivery
                            ? `/admin/delivery-boys/${user.id}/edit`
                            : `/admin/customers/${user.id}/edit`
                        }
                        title="Edit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#333333] hover:bg-[#F9F8F6] transition-colors"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </Link>
                      <button
                        type="button"
                        title="Delete permanently"
                        disabled={deleteMut.isPending}
                        onClick={() => onDelete(user)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
