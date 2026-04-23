import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, getEffectivePrice, num, unitLabel } from '@/lib/formatting';
import { ArrowLeft, Share2, Heart, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import StoreClosedBanner from '@/components/customer/StoreClosedBanner';
import { getJson, postJson } from '@/lib/api';
import { isProductFavorited, toggleFavoriteProductId } from '@/lib/favoriteProducts';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreMenusOpen } from '@/hooks/useStoreMenusOpen';
import type { Cart, Product } from '@/types';

export default function CustomerProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const menusOpen = useStoreMenusOpen();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [favorited, setFavorited] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getJson<Product>(`/api/products/${id}/`, null),
    enabled: !!id,
  });

  const { data: cart } = useQuery({
    queryKey: ['cart', token],
    queryFn: () => getJson<Cart>('/api/cart/', token),
    enabled: !!token,
  });

  const mutateCart = useMutation({
    mutationFn: async (mode: 'regular' | 'preorder') => {
      if (!token || !product) throw new Error('Login required');
      if (mode === 'regular' && product.stock_quantity < 1) {
        throw new Error('This item is out of stock for immediate cart orders.');
      }
      const line = cart?.items?.find(i => i.product_id === product.id);
      const quantity = (line?.quantity ?? 0) + qty;
      const body: {
        product_id: number;
        quantity: number;
        notes?: string;
        is_preorder?: boolean;
      } = {
        product_id: product.id,
        quantity,
        notes: notes || undefined,
      };
      if (mode === 'preorder') body.is_preorder = true;
      await postJson<Cart, typeof body>('/api/cart/items/', body, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setQty(1);
      setNotes('');
      navigate('/customer/cart');
    },
  });

  useEffect(() => {
    if (!id) return;
    const pid = Number(id);
    if (!Number.isFinite(pid)) return;
    setFavorited(isProductFavorited(pid));
  }, [id]);

  const handleShare = async () => {
    if (!product) return;
    const url = window.location.href;
    const title = product.name;
    const text = `Check out ${product.name}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
        return;
      }
      toast.error('Sharing is not supported here');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          toast.success('Link copied to clipboard');
        } else {
          toast.error('Could not share or copy link');
        }
      } catch {
        toast.error('Could not share or copy link');
      }
    }
  };

  const handleToggleFavorite = () => {
    if (!product) return;
    const next = toggleFavoriteProductId(product.id);
    const on = next.includes(product.id);
    setFavorited(on);
    toast.success(on ? 'Saved to favorites' : 'Removed from favorites');
  };

  if (isLoading || !product) {
    return (
      <div className="p-8 text-center text-muted-foreground min-h-[40vh] flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (!menusOpen) {
    return (
      <div className="pb-24">
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border">
          <Link to="/customer" className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <ArrowLeft size={20} />
          </Link>
        </div>
        <div className="px-4 py-6 space-y-4 max-w-md mx-auto">
          <StoreClosedBanner />
          <p className="text-sm text-center text-muted-foreground">
            The menu is unavailable while the store is closed.
          </p>
        </div>
      </div>
    );
  }

  const effective = getEffectivePrice(product);
  const savings = Math.max(0, num(product.price) - effective) * qty;
  const thumb = product.thumbnail_url || product.images?.[0]?.image_url;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border">
        <Link to="/customer" className="p-2 -ml-2 hover:bg-muted rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Share product"
            onClick={() => void handleShare()}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <Share2 size={18} />
          </button>
          <button
            type="button"
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            onClick={handleToggleFavorite}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <Heart
              size={18}
              className={favorited ? 'fill-red-500 text-red-500 stroke-red-500' : undefined}
            />
          </button>
        </div>
      </div>
      {thumb ? (
        <img src={thumb} alt={product.name} className="w-full h-[280px] object-cover" />
      ) : (
        <div className="w-full h-[280px] bg-amber-50 flex items-center justify-center text-6xl">🍬</div>
      )}
      <div className="px-4 pt-4 space-y-4">
        <div className="flex gap-2">
          {product.is_veg && (
            <span className="bg-green-50 text-green-600 text-xs px-2 py-0.5 rounded-full">Veg</span>
          )}
          {product.is_featured && (
            <span className="bg-amber-50 text-amber-600 text-xs px-2 py-0.5 rounded-full">Featured</span>
          )}
        </div>
        <h1 className="text-xl font-display font-bold">{product.name}</h1>
        <div className="flex items-center gap-3">
          {num(product.discount_value) > 0 ? (
            <span className="text-muted-foreground line-through">{formatCurrency(num(product.price))}</span>
          ) : null}
          <span className="text-2xl font-bold text-amber-600">{formatCurrency(effective)}</span>
          {savings > 0 && (
            <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
              Save {formatCurrency(savings)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Unit: {unitLabel(product)}</span>
          <span
            className={
              product.stock_quantity > 5
                ? 'text-green-600'
                : product.stock_quantity > 0
                  ? 'text-amber-600'
                  : 'text-red-600'
            }
          >
            {product.stock_quantity > 5
              ? `${product.stock_quantity} available`
              : product.stock_quantity > 0
                ? `Only ${product.stock_quantity} left`
                : 'Out of Stock'}
          </span>
        </div>
        {product.description && (
          <div>
            <h3 className="font-semibold text-sm mb-1">Description</h3>
            <p className="text-sm text-muted-foreground">{product.description}</p>
          </div>
        )}
        <div>
          <h3 className="font-semibold text-sm mb-1">Special Request</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add a note e.g. less sweet"
            className="w-full border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            rows={2}
          />
        </div>
      </div>
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-card border-t border-border p-4">
        {product.is_sweet ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 justify-between w-full">
              <span className="font-bold text-lg text-amber-600">{formatCurrency(effective * qty)}</span>
              <div className="flex items-center gap-2 border border-border rounded-full px-1">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"
                >
                  <Minus size={16} />
                </button>
                <span className="w-6 text-center font-semibold">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Pre-order skips live stock; choose pickup or delivery time at checkout.
            </p>
            <div className="flex gap-2 w-full">
              <button
                type="button"
                disabled={product.stock_quantity === 0 || !token || mutateCart.isPending}
                onClick={() => mutateCart.mutate('regular')}
                className="flex-1 py-3 bg-amber-500 text-white font-semibold rounded-full text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!token ? 'Sign in' : 'Add to cart'}
              </button>
              <button
                type="button"
                disabled={!token || mutateCart.isPending}
                onClick={() => mutateCart.mutate('preorder')}
                className="flex-1 py-3 border border-violet-400 text-violet-900 font-semibold rounded-full text-sm bg-violet-50 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pre-order
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg text-amber-600">{formatCurrency(effective * qty)}</span>
            <div className="flex items-center gap-2 border border-border rounded-full px-1">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"
              >
                <Minus size={16} />
              </button>
              <span className="w-6 text-center font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              type="button"
              disabled={product.stock_quantity === 0 || !token || mutateCart.isPending}
              onClick={() => mutateCart.mutate('regular')}
              className="flex-1 py-3 bg-amber-500 text-white font-semibold rounded-full text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!token ? 'Sign in to add' : 'Add to Cart'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
