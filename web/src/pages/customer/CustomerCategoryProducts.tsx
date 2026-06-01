import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import CustomerProductCard from '@/components/customer/CustomerProductCard';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import type { Category, Product } from '@/types';

export default function CustomerCategoryProducts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const catId = Number(id);
  const menusOpen = useStoreMenusOpen();

  const { data: category } = useQuery({
    queryKey: ['category-detail', id],
    queryFn: () => getJson<Category>(`/api/categories/${id}/`, null),
    enabled: !!id,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => getJson<Product[]>('/api/products/', null),
  });

  const list = useMemo(() => {
    return products.filter(p => p.category_id === catId);
  }, [products, catId]);

  return (
    <div className="pb-20">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Subcategory</p>
          <h1 className="font-display font-bold text-lg">{category?.name || 'Category'}</h1>
        </div>
      </div>
      {!menusOpen ? (
        <div className="p-4">
          <StoreClosedBanner />
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 gap-3">
          {isLoading && <div className="col-span-2 text-center py-12 text-muted-foreground">Loading…</div>}
          {!isLoading &&
            list.map(p => (
              <CustomerProductCard key={p.id} product={p} layout="grid" />
            ))}
          {!isLoading && list.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">No products in this category</div>
          )}
        </div>
      )}
    </div>
  );
}
