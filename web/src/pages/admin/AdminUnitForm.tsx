import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { getJson, patchJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Unit } from '@/types';

export default function AdminUnitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: existing } = useQuery({
    queryKey: ['admin-unit', id, token],
    queryFn: () => getJson<Unit>(`/api/admin/units/${id}/`, token),
    enabled: !!token && !!id,
  });

  const [form, setForm] = useState({ name: '', sort_order: '0' });

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      sort_order: String(existing.sort_order),
    });
  }, [existing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = { name: form.name.trim(), sort_order: Number(form.sort_order) || 0 };
      if (isEdit && id) {
        return patchJson<Unit>(`/api/admin/units/${id}/`, body, token);
      }
      return postJson<Unit>('/api/admin/units/', body, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-units'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success(isEdit ? 'Unit updated.' : 'Unit created.');
      navigate('/admin/units');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save unit'),
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link to="/admin/units" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-display font-bold">{isEdit ? 'Edit unit' : 'New unit'}</h1>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Name *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. kg, piece, plate"
            className="w-full border border-border rounded-lg p-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Sort order</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
            className="w-full border border-border rounded-lg p-3 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link to="/admin/units" className="px-6 py-2.5 text-sm border border-border rounded-lg">
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !form.name.trim()}
          className="px-6 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
        >
          {saveMut.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  );
}
