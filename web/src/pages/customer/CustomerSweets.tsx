import { useQuery } from '@tanstack/react-query';
import CustomerBanners from '@/components/customer/CustomerBanners';
import CustomerProductCard from '@/components/customer/CustomerProductCard';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import { collectDescendantCategoryIds } from '@/lib/category-tree';
import type { ParentCategory, Product } from '@/types';

export default function CustomerSweets() {
  const menusOpen = useStoreMenusOpen();

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', 'sweet'],
    queryFn: () => getJson<Product[]>('/api/products/?is_sweet=1', null),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getJson<ParentCategory[]>('/api/categories/', null),
  });

  const parentsWithSweets = categories.filter(cat => {
    const ids = collectDescendantCategoryIds(categories, cat.id);
    return products.some(p => ids.has(p.category_id));
  });

  if (loadingProducts) {
    return <div className="p-8 text-center text-muted-foreground">Loading sweets…</div>;
  }

  if (!menusOpen) {
    return (
      <div className="pb-24">
        <StoreClosedBanner />
        <p className="px-4 text-sm text-center text-muted-foreground mt-4">
          Sweets and pre-orders are available when the store is open.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <CustomerBanners />
      <div className="px-4 py-4">
        <h1 className="font-display font-bold text-xl mb-1">Sweets</h1>
        <p className="text-sm text-muted-foreground mb-4">Order now or schedule a pre-order.</p>
        {parentsWithSweets.map(parent => {
          const ids = collectDescendantCategoryIds(categories, parent.id);
          const sectionProducts = products.filter(p => ids.has(p.category_id));
          if (!sectionProducts.length) return null;
          return (
            <section key={parent.id} className="mb-6">
              <h2 className="font-semibold text-sm mb-2">{parent.name}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {sectionProducts.map(p => (
                  <CustomerProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          );
        })}
        {!products.length && (
          <p className="text-sm text-muted-foreground text-center py-8">No sweets listed yet.</p>
        )}
      </div>
    </div>
  );
}
