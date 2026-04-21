import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteJson, getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Unit } from '@/types';

export default function AdminUnitsList() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['admin-units', token],
    queryFn: () => getJson<Unit[]>('/api/admin/units/', token),
    enabled: !!token,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJson(`/api/admin/units/${id}/`, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-units'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Unit removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not delete unit'),
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-display font-bold">Units</h1>
        <Link
          to="/admin/units/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          <Plus size={18} />
          Add unit
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Units appear in the product form (e.g. kg, piece, plate). You cannot delete a unit that is still assigned
        to a product.
      </p>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f0e8] text-xs uppercase text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Sort</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => (
                <tr key={u.id} className={i % 2 === 1 ? 'bg-muted/25' : 'bg-card'}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        to={`/admin/units/${u.id}/edit`}
                        className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        title="Delete"
                        className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-destructive"
                        onClick={() => {
                          if (!window.confirm(`Delete unit “${u.name}”?`)) return;
                          deleteMut.mutate(u.id);
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {units.length === 0 && (
            <p className="px-4 py-8 text-center text-muted-foreground">No units yet. Add one to use on products.</p>
          )}
        </div>
      )}
    </div>
  );
}
