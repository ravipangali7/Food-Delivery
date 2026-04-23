import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Phone, Plus, Minus } from 'lucide-react';
import CustomerBanners from '@/components/customer/CustomerBanners';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson, postJson, deleteJson } from '@/lib/api';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import { collectDescendantCategoryIds } from '@/lib/category-tree';
import { formatCurrency, getEffectivePrice, num, unitLabel } from '@/lib/formatting';
import { useAuth } from '@/contexts/AuthContext';
import type { Cart, ParentCategory, Product, SuperSetting } from '@/types';

export default function CustomerHome() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
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

  const { data: cart } = useQuery({
    queryKey: ['cart', token],
    queryFn: () => getJson<Cart>('/api/cart/', token),
    enabled: !!token,
  });

  const topLevelCategories = categories;

  const mutateCart = useMutation({
    mutationFn: async (next: { productId: number; delta: number; asPreorder?: boolean }) => {
      if (!token) throw new Error('Login required');
      const line = cart?.items?.find(i => i.product_id === next.productId);
      const isPreorder = line ? Boolean(line.is_preorder) : Boolean(next.asPreorder);
      const cur = line?.quantity ?? 0;
      const quantity = cur + next.delta;
      if (quantity < 1 && line) {
        await deleteJson<Cart>(`/api/cart/items/${line.id}/`, token);
        return;
      }
      if (quantity < 1) return;
      const body: { product_id: number; quantity: number; is_preorder?: boolean } = {
        product_id: next.productId,
        quantity,
      };
      if (isPreorder) body.is_preorder = true;
      await postJson<Cart, typeof body>('/api/cart/items/', body, token);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const storeName = settings?.name ?? 'Shyam Sweets';
  const addressLine = settings?.address ?? '';
  const phoneLine = settings?.phone?.trim();
  const logoUrl = settings?.logo?.trim();

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
          {product.is_veg && (
            <span className="absolute top-2 left-2 bg-green-100 text-green-600 text-[9px] px-1.5 py-0.5 rounded">
              🌿
            </span>
          )}
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
            {!token ? (
              <span className="text-[10px] text-muted-foreground">Login to cart</span>
            ) : qty > 0 ? (
              <div className="flex flex-col items-end gap-1" onClick={e => e.preventDefault()}>
                {product.is_sweet && lineIsPreorder ? (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                    Pre-order
                  </span>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      mutateCart.mutate({ productId: product.id, delta: -1 });
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
                      mutateCart.mutate({ productId: product.id, delta: 1 });
                    }}
                    className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ) : product.is_sweet ? (
              <div className="flex flex-col gap-1 items-end" onClick={e => e.preventDefault()}>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    mutateCart.mutate({ productId: product.id, delta: 1, asPreorder: false });
                  }}
                  className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-semibold rounded-full hover:bg-amber-600 whitespace-nowrap"
                >
                  Add to cart
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    mutateCart.mutate({ productId: product.id, delta: 1, asPreorder: true });
                  }}
                  className="px-2.5 py-1 border border-violet-300 text-violet-800 text-[10px] font-semibold rounded-full bg-violet-50 hover:bg-violet-100 whitespace-nowrap"
                >
                  Pre-order
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  mutateCart.mutate({ productId: product.id, delta: 1 });
                }}
                className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full hover:bg-amber-600"
              >
                + Add
              </button>
            )}
          </div>
        </div>
      </Link>
    );
  };

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
          <div className="h-10 w-10 rounded-xl border border-border bg-amber-50 overflow-hidden shrink-0 flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl">🍬</span>
            )}
          </div>
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
                  <ProductCard key={p.id} product={p} />
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
                      <ProductCard key={p.id} product={p} />
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
