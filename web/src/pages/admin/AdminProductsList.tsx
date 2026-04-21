import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Beef,
  Check,
  Eye,
  LayoutGrid,
  Leaf,
  List,
  Pencil,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { formatCurrency, getEffectivePrice, num, unitLabel } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { deleteJson, getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Product } from '@/types';

const VIEW_STORAGE_KEY = 'admin-products-view';
const PRODUCTS_RESTORE_KEY = 'admin-products-restore';
type ViewMode = 'grid' | 'list';

function formatDiscountLabel(p: Product): string {
  const v = num(p.discount_value);
  if (v <= 0) return '—';
  if (p.discount_type === 'percentage') return `${v}%`;
  return formatCurrency(v);
}

function useProductsViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'grid' || stored === 'list') return stored;
    } catch {
      /* ignore */
    }
    return 'grid';
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  return [view, setView];
}

export default function AdminProductsList() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useProductsViewMode();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const captureListState = () => {
    try {
      sessionStorage.setItem(
        PRODUCTS_RESTORE_KEY,
        JSON.stringify({ scrollY: window.scrollY, viewMode }),
      );
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PRODUCTS_RESTORE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PRODUCTS_RESTORE_KEY);
      const { scrollY, viewMode: vm } = JSON.parse(raw) as {
        scrollY?: number;
        viewMode?: ViewMode;
      };
      if (vm === 'grid' || vm === 'list') setViewMode(vm);
      requestAnimationFrame(() => {
        window.scrollTo(0, Number(scrollY) || 0);
      });
    } catch {
      /* ignore */
    }
  }, [setViewMode]);

  const deleteMut = useMutation({
    mutationFn: (productSlug: string) =>
      deleteJson(`/api/admin/products/${encodeURIComponent(productSlug)}/`, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product'] });
      toast.success('Product removed from catalog');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not delete product'),
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products', token],
    queryFn: () => getJson<Product[]>('/api/admin/products/', token),
    enabled: !!token,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => {
      const cat = (p.category_name || p.category?.name || '').toLowerCase();
      const u = unitLabel(p).toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        u.includes(q) ||
        cat.includes(q)
      );
    });
  }, [products, search]);

  const onDelete = (p: Product) => {
    if (
      !window.confirm(`Remove “${p.name}” from the catalog? Customers will no longer see it.`)
    ) {
      return;
    }
    deleteMut.mutate(p.slug);
  };

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground shrink-0">Products</h1>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 min-w-[min(100%,280px)]">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-card text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Product layout">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-pressed={viewMode === 'grid'}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted',
              )}
            >
              <LayoutGrid size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List view"
              aria-pressed={viewMode === 'list'}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted',
              )}
            >
              <List size={18} strokeWidth={2} />
            </button>
          </div>

          <Link
            to="/admin/products/new"
            className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium whitespace-nowrap"
          >
            + Add Product
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductGridCard
              key={p.id}
              product={p}
              onDelete={() => onDelete(p)}
              deletePending={deleteMut.isPending}
              onNavigateList={captureListState}
            />
          ))}
        </div>
      )}

      {!isLoading && filtered.length > 0 && viewMode === 'list' && (
        <div className="bg-card border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-[#f5f0e8] text-xs uppercase text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Category</th>
                <th className="text-left px-4 py-3 font-semibold">Price</th>
                <th className="text-left px-4 py-3 font-semibold">Discount</th>
                <th className="text-left px-4 py-3 font-semibold">Effective</th>
                <th className="text-left px-4 py-3 font-semibold">Stock</th>
                <th className="text-center px-4 py-3 font-semibold">Veg</th>
                <th className="text-center px-4 py-3 font-semibold">Featured</th>
                <th className="text-center px-4 py-3 font-semibold">Available</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const thumb = p.thumbnail_url || p.images?.[0]?.image_url;
                const discountAmt = num(p.discount_value);
                const hasDiscount = discountAmt > 0;
                return (
                  <tr
                    key={p.id}
                    data-product-slug={p.slug}
                    className={cn(
                      'border-b border-border',
                      i % 2 === 1 ? 'bg-muted/25' : 'bg-card',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-amber-50 flex items-center justify-center shrink-0 text-sm">
                            🍬
                          </div>
                        )}
                        <Link
                          to={`/admin/products/${encodeURIComponent(p.slug)}`}
                          onClick={captureListState}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.category_name || p.category?.name || '—'}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(num(p.price))}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hasDiscount ? formatDiscountLabel(p) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {formatCurrency(getEffectivePrice(p))}
                    </td>
                    <td className="px-4 py-3">{p.stock_quantity}</td>
                    <td className="px-4 py-3 text-center">
                      {p.is_veg ? (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-green-200 bg-green-50 text-green-700 mx-auto"
                          title="Veg"
                        >
                          <Leaf size={16} strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-800 mx-auto"
                          title="Non-veg"
                        >
                          <Beef size={16} strokeWidth={2.5} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.is_featured ? (
                        <Star
                          size={18}
                          className="inline text-amber-500 fill-amber-400 mx-auto"
                          aria-label="Featured"
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.is_available ? (
                        <Check className="inline text-green-600" size={18} strokeWidth={2.5} />
                      ) : (
                        <X className="inline text-red-600" size={18} strokeWidth={2.5} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <Link
                          to={`/admin/products/${encodeURIComponent(p.slug)}`}
                          onClick={captureListState}
                          className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="View"
                        >
                          <Eye size={16} />
                        </Link>
                        <Link
                          to={`/admin/products/${encodeURIComponent(p.slug)}/edit`}
                          onClick={captureListState}
                          className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          type="button"
                          title={p.deleted_at ? 'Already removed' : 'Remove from catalog'}
                          disabled={!!p.deleted_at || deleteMut.isPending}
                          className="inline-flex p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
                          onClick={() => onDelete(p)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-muted-foreground py-8 text-center">
          {search.trim() ? 'No products match your search.' : 'No products yet.'}
        </p>
      )}
    </div>
  );
}

function ProductGridCard({
  product: p,
  onDelete,
  deletePending,
  onNavigateList,
}: {
  product: Product;
  onDelete: () => void;
  deletePending: boolean;
  onNavigateList: () => void;
}) {
  const thumb = p.thumbnail_url || p.images?.[0]?.image_url;
  const base = num(p.price);
  const discountAmt = num(p.discount_value);
  const hasDiscount = discountAmt > 0;
  const effective = getEffectivePrice(p);

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col"
      data-product-slug={p.slug}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-amber-50/80 text-4xl">🍬</div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {p.is_veg ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium border border-green-200/80">
              <Leaf size={12} className="shrink-0" />
              Veg
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-900 px-2 py-0.5 text-xs font-medium border border-rose-200/80">
              <Beef size={12} className="shrink-0" />
              Non-Veg
            </span>
          )}
          {p.is_featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-xs font-medium border border-amber-200/80">
              <Star size={12} className="shrink-0 text-amber-600 fill-amber-400" />
              Featured
            </span>
          )}
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-1">
        <h2 className="font-semibold text-foreground leading-tight">{p.name}</h2>
        <p className="text-sm text-muted-foreground">{unitLabel(p)}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1">
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">{formatCurrency(base)}</span>
          )}
          <span
            className={cn('text-base font-bold', hasDiscount ? 'text-primary' : 'text-foreground')}
          >
            {formatCurrency(effective)}
          </span>
        </div>
        <p className="text-xs text-green-700 font-medium mt-1">Stock: {p.stock_quantity} units</p>
        {p.deleted_at && (
          <p className="text-xs text-muted-foreground">Removed from catalog</p>
        )}
      </div>

      <div className="p-3 pt-0 grid grid-cols-[1fr_1fr_auto] gap-2">
        <Link
          to={`/admin/products/${encodeURIComponent(p.slug)}`}
          onClick={onNavigateList}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Eye size={16} />
          View
        </Link>
        <Link
          to={`/admin/products/${encodeURIComponent(p.slug)}/edit`}
          onClick={onNavigateList}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Pencil size={16} />
          Edit
        </Link>
        <button
          type="button"
          title={p.deleted_at ? 'Already removed' : 'Remove from catalog'}
          disabled={!!p.deleted_at || deletePending}
          onClick={onDelete}
          className="inline-flex h-[42px] w-11 items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
