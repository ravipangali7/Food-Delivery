import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import CustomerBanners from '@/components/customer/CustomerBanners';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import { formatCurrency, getEffectivePrice, unitLabel } from '@/lib/formatting';
import type { ParentCategory, Product } from '@/types';

export default function CustomerExplore() {
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const menusOpen = useStoreMenusOpen();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => getJson<Product[]>('/api/products/', null),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getJson<ParentCategory[]>('/api/categories/', null),
  });

  const topLevel = categories;

  const results = useMemo(() => {
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (vegOnly && !p.is_veg) return false;
      return true;
    });
  }, [products, search, vegOnly]);

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-10 py-3 text-sm border border-border rounded-xl bg-stone-50 focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
            autoFocus={menusOpen}
            disabled={!menusOpen}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={16} />
            </button>
          )}
        </div>
        {menusOpen ? (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              type="button"
              onClick={() => setVegOnly(!vegOnly)}
              className={`px-3 py-1 text-xs rounded-full ${vegOnly ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
            >
              Veg Only
            </button>
            {topLevel.map(c => (
              <Link
                key={c.id}
                to={`/customer/parent/${c.id}`}
                className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground"
              >
                {c.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {!menusOpen ? (
        <div className="p-4 space-y-4">
          <CustomerBanners />
          <StoreClosedBanner />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <CustomerBanners />
          <div className="grid grid-cols-2 gap-3">
          {isLoading && <div className="col-span-2 text-center py-12 text-muted-foreground">Loading…</div>}
          {!isLoading &&
            results.map(p => {
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
                      <span className="font-bold text-amber-600 text-sm">{formatCurrency(getEffectivePrice(p))}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          {!isLoading && results.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">No products found</div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
