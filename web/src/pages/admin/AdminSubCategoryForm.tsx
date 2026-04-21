import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { generateSlug } from '@/lib/formatting';
import { ArrowLeft } from 'lucide-react';
import { getJson, patchFormData, patchJson, postFormData, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Category, ParentCategory } from '@/types';

function buildSubFormData(form: {
  name: string;
  slug: string;
  description: string;
  parent_id: string;
  sort_order: string;
  is_active: boolean;
}): FormData {
  const fd = new FormData();
  const slug = form.slug.trim() || generateSlug(form.name);
  fd.append('name', form.name);
  fd.append('slug', slug);
  fd.append('description', form.description || '');
  fd.append('parent_id', form.parent_id);
  fd.append('sort_order', form.sort_order);
  fd.append('is_active', form.is_active ? 'true' : 'false');
  return fd;
}

export default function AdminSubCategoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const preselectParent = searchParams.get('parent');

  const { data: existing } = useQuery({
    queryKey: ['admin-sub-category', id, token],
    queryFn: () => getJson<Category>(`/api/admin/categories/${id}/`, token),
    enabled: !!token && !!id,
  });

  const { data: parents = [], isSuccess: parentsLoaded } = useQuery({
    queryKey: ['admin-parent-categories-flat', token],
    queryFn: () => getJson<ParentCategory[]>('/api/admin/parent-categories/?format=flat', token),
    enabled: !!token,
  });

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: '',
    sort_order: '0',
    is_active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit || !token || !parentsLoaded) return;
    if (!parents.length) {
      toast.error('Add a parent category first.');
      navigate('/admin/parent-categories/new', { replace: true });
    }
  }, [isEdit, token, parentsLoaded, parents.length, navigate]);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      slug: existing.slug,
      description: existing.description || '',
      parent_id: String(existing.parent_id),
      sort_order: String(existing.sort_order),
      is_active: existing.is_active,
    });
    setImageFile(null);
    setPreviewUrl(existing.image_url || null);
  }, [existing]);

  useEffect(() => {
    if (isEdit || !preselectParent || form.parent_id) return;
    setForm(f => ({ ...f, parent_id: preselectParent }));
  }, [isEdit, preselectParent, form.parent_id]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const onPickImage = (file: File | null) => {
    setImageFile(file);
    setPreviewUrl(prev => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      if (file) {
        return URL.createObjectURL(file);
      }
      return existing?.image_url || null;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.parent_id) {
        throw new Error('Choose a parent category.');
      }
      const slug = form.slug.trim() || generateSlug(form.name);
      const baseJson: Record<string, unknown> = {
        name: form.name,
        slug,
        description: form.description || null,
        parent_id: Number(form.parent_id),
        sort_order: Number(form.sort_order),
        is_active: form.is_active,
      };

      if (imageFile) {
        const fd = buildSubFormData({
          ...form,
          slug,
          parent_id: form.parent_id,
        });
        fd.append('image', imageFile);
        if (isEdit && id) {
          return patchFormData<Category>(`/api/admin/categories/${id}/`, fd, token);
        }
        return postFormData<Category>('/api/admin/categories/', fd, token);
      }

      if (isEdit && id) {
        return patchJson(`/api/admin/categories/${id}/`, baseJson, token);
      }
      return postJson('/api/admin/categories/', baseJson, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-categories-flat'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parent-categories-flat'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['admin-sub-category', id] });
      }
      navigate('/admin/categories/all');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not save subcategory');
    },
  });

  const hasParents = useMemo(() => parents.length > 0, [parents]);

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/categories/all" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-display font-bold">
          {isEdit ? 'Edit subcategory' : 'New subcategory'}
        </h1>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Parent category *</label>
          <select
            value={form.parent_id}
            onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
            className="w-full border border-border rounded-lg p-3 text-sm"
            required
            disabled={!hasParents}
          >
            <option value="">Select parent…</option>
            {parents.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {!hasParents ? (
            <p className="text-xs text-destructive mt-1">Create a parent category before adding subcategories.</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Name *</label>
          <input
            value={form.name}
            onChange={e => {
              const name = e.target.value;
              setForm(f => ({ ...f, name, slug: generateSlug(name) }));
            }}
            className="w-full border border-border rounded-lg p-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Slug</label>
          <input
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            className="w-full border border-border rounded-lg p-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full border border-border rounded-lg p-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Image (optional)</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-border file:bg-muted file:text-sm"
            onChange={e => {
              const f = e.target.files?.[0];
              onPickImage(f ?? null);
            }}
          />
          {previewUrl && (
            <div className="mt-3 flex items-start gap-3">
              <img src={previewUrl} alt="" className="h-16 w-16 rounded-lg border object-cover" />
              {imageFile && (
                <button
                  type="button"
                  className="mt-1 text-xs text-primary"
                  onClick={() => onPickImage(null)}
                >
                  Remove selected file
                </button>
              )}
            </div>
          )}
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
          />
          Active
        </label>
      </div>

      <div className="flex justify-end gap-3">
        <Link to="/admin/categories/all" className="px-6 py-2 border border-border rounded-lg text-sm">
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !form.name || !form.parent_id || !hasParents}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
        >
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
