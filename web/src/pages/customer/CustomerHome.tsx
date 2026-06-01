import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone } from 'lucide-react';
import CustomerBanners from '@/components/customer/CustomerBanners';
import CustomerProductCard from '@/components/customer/CustomerProductCard';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import { collectDescendantCategoryIds } from '@/lib/category-tree';
import BrandLogo from '@/components/BrandLogo';
import { resolveStoreLogoUrl } from '@/lib/branding';
import type { ParentCategory, Product, SuperSetting } from '@/types';

export default function CustomerHome() {
  const menusOpen = useStoreMenusOpen();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => getJson<Product[]>('/api/products/', null),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getJson<ParentCategory[]>('/api/categories/', null),
  });

  const topLevelCategories = categories;
  const storeName = settings?.name ?? 'Shyam Sweets';
  const addressLine = settings?.address ?? '';
  const phoneLine = settings?.phone?.trim();
  const featured = products.filter(p => p.is_featured);

  if (loadingProducts) {
    return (
      <div className="p-8 text-center text-muted-foreground min-h-[40vh] flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo src={resolveStoreLogoUrl(settings?.logo)} size="md" alt={storeName} />
          <div className="min-w-0">
            <span className="font-display font-bold text-foreground block truncate">{storeName}</span>
            {phoneLine ? (
              <a
                href={`tel:${phoneLine}`}
                className="text-[11px] text-amber-700 inline-flex items-center gap-1 font-medium"
              >
                <Phone size={11} />
                {phoneLine}
              </a>
            ) : null}
          </div>
        </div>
        {addressLine ? (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <MapPin size={12} className="text-amber-500" />
            {addressLine}
          </div>
        ) : null}
      </div>

      <div className="px-4 py-4 space-y-6">
        <CustomerBanners />
        {!menusOpen ? <StoreClosedBanner /> : null}

        {menusOpen ? (
          <>
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-display font-semibold">Shop by Category</h3>
                <Link to="/customer/explore" className="text-xs text-amber-500">
                  See All →
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {topLevelCategories.map(cat => (
                  <Link
                    key={cat.id}
                    to={`/customer/parent/${cat.id}`}
                    className="flex flex-col items-center min-w-[72px]"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-amber-200 overflow-hidden bg-amber-50">
                      {cat.image_url ? (
                        <img src={cat.image_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🍬</div>
                      )}
                    </div>
                    <span className="text-xs font-medium mt-1.5 text-center">{cat.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-display font-semibold">Featured Items</h3>
                <Link to="/customer/explore" className="text-xs text-amber-500">
                  View All →
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {featured.map(p => (
                  <CustomerProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>

            {topLevelCategories.map(cat => {
              const inCatIds = collectDescendantCategoryIds(categories, cat.id);
              const inCat = products.filter(p => inCatIds.has(p.category_id));
              if (!inCat.length) return null;
              return (
                <div key={cat.id}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-display font-semibold">{cat.name}</h3>
                    <Link to={`/customer/parent/${cat.id}`} className="text-xs text-amber-500">
                      See All →
                    </Link>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {inCat.map(p => (
                      <CustomerProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
