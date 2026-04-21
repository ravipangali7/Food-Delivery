import { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, getEffectivePrice, unitLabel } from '@/lib/formatting';
import { ArrowLeft } from 'lucide-react';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import type { ParentCategory, Product } from '@/types';

export default function CustomerParentCategory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const menusOpen = useStoreMenusOpen();

  const { data: parent, isLoading: loadingParent } = useQuery({
    queryKey: ['parent-category', id],
    queryFn: () => getJson<ParentCategory>(`/api/parent-categories/${id}/`, null),
    enabled: !!id,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => getJson<Product[]>('/api/products/', null),
  });

  const subIds = useMemo(
    () => new Set((parent?.children ?? []).map(c => c.id)),
    [parent?.children],
  );

  const list = useMemo(() => {
    return products.filter(p => subIds.has(p.category_id));
  }, [products, subIds]);

  return (
    <div className="pb-20">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-lg truncate">{parent?.name || 'Category'}</h1>
          </div>
        </div>
      </div>

      {menusOpen && parent?.image_url ? (
        <div className="px-4 pt-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30">
            <img
              src={parent.image_url}
              alt=""
              className="w-full h-40 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <p className="text-lg font-display font-bold drop-shadow-sm">{parent.name}</p>
              {parent.description ? (
                <p className="text-xs text-white/90 line-clamp-2 mt-1">{parent.description}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {menusOpen ? (
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Browse by type</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(parent?.children ?? []).map(sub => (
              <Link
                key={sub.id}
                to={`/customer/category/${sub.id}`}
                className="shrink-0 px-4 py-2 rounded-full bg-muted text-sm font-medium border border-border hover:bg-amber-50 hover:border-amber-200 transition-colors"
              >
                {sub.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!menusOpen ? (
        <div className="p-4">
          <StoreClosedBanner />
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 gap-3">
          {(loadingParent || loadingProducts) && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">Loading…</div>
          )}
          {!loadingParent && !loadingProducts &&
            list.map(p => {
              const thumb = p.thumbnail_url || p.images?.[0]?.image_url;
              return (
                <Link
                  key={p.id}
                  to={`/customer/product/${p.id}`}
                  className="bg-card rounded-xl border border-border overflow-hidden shadow-sm"
                >
                  {thumb ? (
                    <img src={thumb} alt={p.name} className="w-full h-[120px] object-cover" />
                  ) : (
                    <div className="w-full h-[120px] bg-amber-50 flex items-center justify-center text-2xl">🍬</div>
                  )}
                  <div className="p-2.5">
                    <h3 className="font-semibold text-xs truncate">{p.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{unitLabel(p)}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-bold text-amber-600 text-sm">
                        {formatCurrency(getEffectivePrice(p))}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          {!loadingParent && !loadingProducts && list.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              No products in this section yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
