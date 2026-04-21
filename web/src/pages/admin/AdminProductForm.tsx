import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { computeEffectivePreview, formatCurrency, generateSlug } from '@/lib/formatting';
import { ArrowLeft } from 'lucide-react';
import { getJson, patchFormData, patchJson, postFormData, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { DiscountType, ParentCategory, Product, Unit } from '@/types';
import { CategoryTreeSelect } from '@/components/admin/CategoryTreeSelect';

function buildProductFormData(form: {
  name: string;
  slug: string;
  category_id: string;
  description: string;
  short_description: string;
  price: string;
  discount_type: DiscountType;
  discount_value: string;
  unit_id: string;
  stock_quantity: string;
  sort_order: string;
  is_veg: boolean;
  is_featured: boolean;
  is_available: boolean;
}): FormData {
  const fd = new FormData();
  const slug = form.slug.trim() || generateSlug(form.name);
  fd.append('name', form.name);
  fd.append('slug', slug);
  fd.append('category_id', form.category_id);
  fd.append('description', form.description || '');
  fd.append('short_description', form.short_description || '');
  fd.append('price', form.price);
  fd.append('discount_type', form.discount_type);
  if (form.discount_value) {
    fd.append('discount_value', form.discount_value);
  }
  fd.append('unit_id', form.unit_id);
  fd.append('stock_quantity', form.stock_quantity);
  fd.append('sort_order', form.sort_order);
  fd.append('is_veg', form.is_veg ? '1' : '0');
  fd.append('is_featured', form.is_featured ? '1' : '0');
  fd.append('is_available', form.is_available ? '1' : '0');
  return fd;
}

export default function AdminProductForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(slug);

  const { data: categoryParents = [] } = useQuery({
    queryKey: ['admin-categories-tree', token],
    queryFn: () => getJson<ParentCategory[]>('/api/admin/categories/', token),
    enabled: !!token,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['admin-units', token],
    queryFn: () => getJson<Unit[]>('/api/admin/units/', token),
    enabled: !!token,
  });

  const { data: existing } = useQuery({
    queryKey: ['admin-product', slug, token],
    queryFn: () =>
      getJson<Product>(`/api/admin/products/${encodeURIComponent(slug!)}/`, token),
    enabled: !!token && !!slug,
  });

  const [form, setForm] = useState({
    name: '',
    slug: '',
    category_id: '',
    description: '',
    short_description: '',
    price: '',
    discount_type: 'flat' as DiscountType,
    discount_value: '',
    unit_id: '',
    stock_quantity: '0',
    sort_order: '0',
    is_veg: true,
    is_featured: false,
    is_available: true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      slug: existing.slug,
      category_id: String(existing.category_id),
      description: existing.description || '',
      short_description: existing.short_description || '',
      price: String(existing.price),
      discount_type: existing.discount_type ?? 'flat',
      discount_value: existing.discount_value != null ? String(existing.discount_value) : '',
      unit_id: String(existing.unit_id ?? existing.unit?.id ?? ''),
      stock_quantity: String(existing.stock_quantity),
      sort_order: String(existing.sort_order),
      is_veg: existing.is_veg,
      is_featured: existing.is_featured,
      is_available: existing.is_available,
    });
    setImageFile(null);
    setPreviewUrl(existing.thumbnail_url || existing.images?.[0]?.image_url || null);
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
      return existing?.thumbnail_url || existing?.images?.[0]?.image_url || null;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const slugVal = form.slug.trim() || generateSlug(form.name);
      if (imageFile) {
        const fd = buildProductFormData({ ...form, slug: slugVal });
        fd.append('thumbnail_file', imageFile);
        if (isEdit && slug) {
          return patchFormData<Product>(
            `/api/admin/products/${encodeURIComponent(slug)}/`,
            fd,
            token,
          );
        }
        return postFormData<Product>('/api/admin/products/', fd, token);
      }

      const body: Record<string, unknown> = {
        name: form.name,
        slug: slugVal,
        category_id: Number(form.category_id),
        description: form.description || null,
        short_description: form.short_description || null,
        price: form.price,
        discount_type: form.discount_type,
        discount_value: form.discount_value ? form.discount_value : null,
        unit_id: Number(form.unit_id),
        stock_quantity: Number(form.stock_quantity),
        sort_order: Number(form.sort_order),
        is_veg: form.is_veg,
        is_featured: form.is_featured,
        is_available: form.is_available,
      };
      if (isEdit && slug) {
        return patchJson<Product>(
          `/api/admin/products/${encodeURIComponent(slug)}/`,
          body,
          token,
        );
      }
      return postJson<Product>('/api/admin/products/', body, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product'] });
      navigate('/admin/products');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not save product');
    },
  });

  const handleChange = (field: string, value: string | boolean) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'name' && typeof value === 'string') {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  const effectivePrice = computeEffectivePreview(
    Number(form.price || 0),
    form.discount_type,
    Number(form.discount_value || 0),
  );

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/products" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-display font-bold">{isEdit ? 'Edit product' : 'New product'}</h1>
      </div>

      {units.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No units defined yet.{' '}
          <Link to="/admin/units/new" className="font-semibold underline">
            Add a unit
          </Link>{' '}
          before creating a product.
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Name *</label>
            <input
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full border border-border rounded-lg p-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Slug</label>
            <input value={form.slug} readOnly className="w-full border border-border rounded-lg p-3 text-sm bg-muted" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Category *</label>
          <CategoryTreeSelect
            parents={categoryParents}
            value={form.category_id}
            onChange={id => handleChange('category_id', id)}
            placeholder="Select a subcategory"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => handleChange('description', e.target.value)}
            rows={3}
            className="w-full border border-border rounded-lg p-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Short description</label>
          <textarea
            value={form.short_description}
            onChange={e => handleChange('short_description', e.target.value)}
            rows={2}
            className="w-full border border-border rounded-lg p-3 text-sm"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Price *</label>
            <input
              type="number"
              value={form.price}
              onChange={e => handleChange('price', e.target.value)}
              className="w-full border border-border rounded-lg p-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Unit *</label>
            <select
              value={form.unit_id}
              onChange={e => handleChange('unit_id', e.target.value)}
              className="w-full border border-border rounded-lg p-3 text-sm bg-card"
            >
              <option value="">Select unit</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Discount type</label>
            <select
              value={form.discount_type}
              onChange={e => handleChange('discount_type', e.target.value as DiscountType)}
              className="w-full border border-border rounded-lg p-3 text-sm bg-card"
            >
              <option value="flat">Flat (NPR off)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              {form.discount_type === 'percentage' ? 'Discount (%)' : 'Discount (NPR)'}
            </label>
            <input
              type="number"
              value={form.discount_value}
              onChange={e => handleChange('discount_value', e.target.value)}
              min={0}
              max={form.discount_type === 'percentage' ? 100 : undefined}
              step={form.discount_type === 'percentage' ? 1 : 0.01}
              className="w-full border border-border rounded-lg p-3 text-sm"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Stock *</label>
            <input
              type="number"
              value={form.stock_quantity}
              onChange={e => handleChange('stock_quantity', e.target.value)}
              className="w-full border border-border rounded-lg p-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Sort order</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={e => handleChange('sort_order', e.target.value)}
              className="w-full border border-border rounded-lg p-3 text-sm"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Preview effective: {formatCurrency(Math.max(0, effectivePrice))}
        </p>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">Diet</p>
          <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Diet">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="diet"
                checked={form.is_veg}
                onChange={() => handleChange('is_veg', true)}
              />
              Vegetarian
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="diet"
                checked={!form.is_veg}
                onChange={() => handleChange('is_veg', false)}
              />
              Non-vegetarian
            </label>
          </div>
          <div className="flex gap-6 flex-wrap">
            {(
              [
                ['is_featured', 'Featured'],
                ['is_available', 'Available'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={e => handleChange(field, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Thumbnail</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-border file:bg-muted file:text-sm"
            onChange={e => {
              const f = e.target.files?.[0];
              onPickImage(f ?? null);
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, or GIF. Optional.</p>
          {previewUrl && (
            <div className="mt-3">
              <img src={previewUrl} alt="" className="max-h-48 rounded-lg border object-contain" />
              {imageFile && (
                <button
                  type="button"
                  className="mt-2 text-xs text-primary"
                  onClick={() => onPickImage(null)}
                >
                  Remove selected file
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link to="/admin/products" className="px-6 py-2.5 text-sm border border-border rounded-lg">
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !form.name || !form.category_id || !form.unit_id}
          className="px-6 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
        >
          {saveMut.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  );
}
