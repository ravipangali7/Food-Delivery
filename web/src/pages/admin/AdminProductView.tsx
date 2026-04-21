import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency, getEffectivePrice, formatDate, num, unitLabel } from '@/lib/formatting';
import {
  ArrowLeft,
  Beef,
  CheckSquare,
  Leaf,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { deleteJson, getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

export default function AdminProductView() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const slugEncoded = slug ? encodeURIComponent(slug) : '';

  const deleteMut = useMutation({
    mutationFn: () => deleteJson(`/api/admin/products/${slugEncoded}/`, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product'] });
      toast.success('Product removed from catalog');
      navigate('/admin/products');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not delete product'),
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ['admin-product', slug, token],
    queryFn: () => getJson<Product>(`/api/admin/products/${slugEncoded}/`, token),
    enabled: !!token && !!slug,
  });

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  if (isLoading || !product) {
    return <div className="p-8 text-muted-foreground">{isLoading ? 'Loading…' : 'Not found'}</div>;
  }

  const thumb = product.thumbnail_url || product.images?.[0]?.image_url;
  const discountAmt = num(product.discount_value);
  const hasDiscount = discountAmt > 0;
  const effective = getEffectivePrice(product);

  const infoRows: [string, ReactNode][] = [
    ['Price', formatCurrency(num(product.price))],
    [
      'Discount',
      hasDiscount
        ? product.discount_type === 'percentage'
          ? `${discountAmt}%`
          : formatCurrency(discountAmt)
        : '—',
    ],
    [
      'Effective Price',
      <span key="eff" className="font-semibold text-amber-600">
        {formatCurrency(effective)}
      </span>,
    ],
    ['Unit', unitLabel(product)],
    ['Stock', `${product.stock_quantity} units`],
    ['Sort Order', String(product.sort_order)],
    ['Slug', <code key="slug" className="text-sm font-mono">{product.slug}</code>],
    ['Created', formatDate(product.created_at)],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/admin/products" className="shrink-0 rounded-lg p-2 hover:bg-muted">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="truncate font-display text-2xl font-bold text-foreground">{product.name}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to={`/admin/products/${encodeURIComponent(product.slug)}/edit`}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-600"
          >
            <Pencil size={16} strokeWidth={2.5} />
            Edit
          </Link>
          <button
            type="button"
            title={product.deleted_at ? 'Already removed' : 'Remove from catalog'}
            disabled={!!product.deleted_at || deleteMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
            onClick={() => {
              if (
                !window.confirm(
                  `Remove “${product.name}” from the catalog? Customers will no longer see it.`,
                )
              ) {
                return;
              }
              deleteMut.mutate();
            }}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        <div
          className={cn(
            'overflow-hidden rounded-2xl border border-border bg-muted/30',
            'aspect-[4/3] min-h-[220px] lg:aspect-auto lg:min-h-[320px]',
          )}
        >
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center bg-amber-50/90 text-5xl lg:min-h-[320px]">
              🍬
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {product.is_veg ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
                <Leaf size={14} className="shrink-0" />
                Vegetarian
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-900">
                <Beef size={14} className="shrink-0" />
                Non-vegetarian
              </span>
            )}
            {product.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                <Star size={14} className="shrink-0 fill-amber-400 text-amber-600" />
                Featured
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                product.is_available
                  ? 'border-sky-200 bg-sky-50 text-sky-900'
                  : 'border-border bg-muted text-muted-foreground',
              )}
            >
              <CheckSquare size={14} className="shrink-0" />
              {product.is_available ? 'Available' : 'Unavailable'}
            </span>
          </div>

          <h2 className="mb-4 text-lg font-bold text-foreground">{product.name}</h2>

          <dl className="space-y-3 text-sm">
            {infoRows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-border/80 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-2 font-bold text-foreground">Description</h3>
        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {product.description?.trim() ? product.description : '—'}
        </p>
        <h3 className="mb-2 mt-6 font-bold text-foreground">Short Description</h3>
        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {product.short_description?.trim() ? product.short_description : '—'}
        </p>
      </div>
    </div>
  );
}
