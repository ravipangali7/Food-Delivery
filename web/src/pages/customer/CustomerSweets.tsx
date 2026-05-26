import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import CustomerBanners from '@/components/customer/CustomerBanners';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import { useCart } from '@/hooks/useCart';
import { collectDescendantCategoryIds } from '@/lib/category-tree';
import { formatCurrency, getEffectivePrice, num, unitLabel } from '@/lib/formatting';
import type { ParentCategory, Product } from '@/types';

export default function CustomerSweets() {
  const { cart, addProduct, setLineQuantity } = useCart();
  const menusOpen = useStoreMenusOpen();

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', 'sweet'],
    queryFn: () => getJson<Product[]>('/api/products/?is_sweet=1', null),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getJson<ParentCategory[]>('/api/categories/', null),
  });

  const adjustCartQty = (product: Product, delta: number, asPreorder?: boolean) => {
    const line = cart?.items?.find(
      i => i.product_id === product.id && Boolean(i.is_preorder) === Boolean(asPreorder),
    );
    const nextQty = (line?.quantity ?? 0) + delta;
    if (nextQty < 1) {
      if (line) setLineQuantity.mutate({ item: line, quantity: 0, product });
      return;
    }
    if (!line) {
      addProduct.mutate({ product, quantity: nextQty, is_preorder: asPreorder });
    } else {
      setLineQuantity.mutate({ item: line, quantity: nextQty, product });
    }
  };

  const parentsWithSweets = categories.filter(cat => {
    const ids = collectDescendantCategoryIds(categories, cat.id);
    return products.some(p => ids.has(p.category_id));
  });

  const ProductCard = ({ product }: { product: Product }) => {
    const effective = getEffectivePrice(product);
    const line = cart?.items?.find(i => i.product_id === product.id);
    const qty = line?.quantity ?? 0;
    const lineIsPreorder = Boolean(line?.is_preorder);
    const thumb = product.thumbnail_url || product.images?.[0]?.image_url;

    return (
      <Link
        to={`/customer/product/${product.id}`}
        className="min-w-[160px] bg-card rounded-xl border border-border overflow-hidden shadow-sm"
      >
        <div className="relative">
          {thumb ? (
            <img src={thumb} alt={product.name} className="w-full h-[130px] object-cover" />
          ) : (
            <div className="w-full h-[130px] bg-amber-50 flex items-center justify-center text-3xl">🍬</div>
          )}
          {product.is_veg ? (
            <span className="absolute top-2 left-2 bg-green-100 text-green-600 text-[9px] px-1.5 py-0.5 rounded">
              🌿
            </span>
          ) : null}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm truncate">{product.name}</h3>
          <p className="text-[10px] text-muted-foreground">{unitLabel(product)}</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              {num(product.discount_value) > 0 ? (
                <span className="text-[10px] text-muted-foreground line-through block">
                  {formatCurrency(num(product.price))}
                </span>
              ) : null}
              <span className="font-bold text-amber-600 text-sm">{formatCurrency(effective)}</span>
            </div>
            {qty > 0 ? (
              <div className="flex flex-col items-end gap-1" onClick={e => e.preventDefault()}>
                {lineIsPreorder ? (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                    Pre-order
                  </span>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      adjustCartQty(product, -1, lineIsPreorder);
                    }}
                    className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-semibold w-4 text-center">{qty}</span>
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      adjustCartQty(product, 1, lineIsPreorder);
                    }}
                    className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 items-end" onClick={e => e.preventDefault()}>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    adjustCartQty(product, 1, false);
                  }}
                  className="px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full hover:bg-primary/90 whitespace-nowrap"
                >
                  Add to cart
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    adjustCartQty(product, 1, true);
                  }}
                  className="px-2.5 py-1 border border-violet-300 text-violet-800 text-[10px] font-semibold rounded-full bg-violet-50 hover:bg-violet-100 whitespace-nowrap"
                >
                  Pre-order
                </button>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  };

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
                  <ProductCard key={p.id} product={p} />
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
