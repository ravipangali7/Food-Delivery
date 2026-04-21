import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { generateSlug } from '@/lib/formatting';
import { ArrowLeft } from 'lucide-react';
import { getJson, patchFormData, patchJson, postFormData } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ParentCategory } from '@/types';

function buildParentFormData(form: {
  name: string;
  slug: string;
  description: string;
  sort_order: string;
  is_active: boolean;
}): FormData {
  const fd = new FormData();
  const slug = form.slug.trim() || generateSlug(form.name);
  fd.append('name', form.name);
  fd.append('slug', slug);
  fd.append('description', form.description || '');
  fd.append('sort_order', form.sort_order);
  fd.append('is_active', form.is_active ? 'true' : 'false');
  return fd;
}

export default function AdminParentCategoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: existing } = useQuery({
    queryKey: ['admin-parent-category', id, token],
    queryFn: () => getJson<ParentCategory>(`/api/admin/parent-categories/${id}/`, token),
    enabled: !!token && !!id,
  });

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    sort_order: '0',
    is_active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      slug: existing.slug,
      description: existing.description || '',
      sort_order: String(existing.sort_order),
      is_active: existing.is_active,
    });
    setImageFile(null);
    setPreviewUrl(existing.image_url || null);
  }, [existing]);

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
      const slug = form.slug.trim() || generateSlug(form.name);
      if (!isEdit && !imageFile) {
        throw new Error('Please upload an image for this parent category.');
      }
      if (isEdit && id) {
        if (imageFile) {
          const fd = buildParentFormData({ ...form, slug });
          fd.append('image', imageFile);
          return patchFormData<ParentCategory>(`/api/admin/parent-categories/${id}/`, fd, token);
        }
        return patchJson<ParentCategory, Record<string, unknown>>(
          `/api/admin/parent-categories/${id}/`,
          {
            name: form.name,
            slug,
            description: form.description || null,
            sort_order: Number(form.sort_order),
            is_active: form.is_active,
          },
          token,
        );
      }
      const fd = buildParentFormData({ ...form, slug });
      fd.append('image', imageFile!);
      return postFormData<ParentCategory>('/api/admin/parent-categories/', fd, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-categories-flat'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parent-categories-flat'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['admin-parent-category', id] });
      }
      navigate('/admin/categories/parents');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not save parent category');
    },
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/categories/parents" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-display font-bold">
          {isEdit ? 'Edit parent category' : 'New parent category'}
        </h1>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Logo / banner
          </p>
          {previewUrl ? (
            <div className="flex flex-col items-start gap-3">
              <img
                src={previewUrl}
                alt=""
                className="h-28 w-28 rounded-xl border-2 border-border object-cover shadow-sm"
              />
              {imageFile && (
                <button
                  type="button"
                  className="text-xs text-primary"
                  onClick={() => onPickImage(null)}
                >
                  Remove selected file
                </button>
              )}
            </div>
          ) : (
            <div className="h-28 w-28 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-xs text-muted-foreground text-center px-2">
              No image
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="mt-3 w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-border file:bg-muted file:text-sm"
            onChange={e => {
              const f = e.target.files?.[0];
              onPickImage(f ?? null);
            }}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Upload a thumbnail or logo (required for new parent categories).
          </p>
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
        <Link to="/admin/categories/parents" className="px-6 py-2 border border-border rounded-lg text-sm">
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !form.name}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
        >
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
