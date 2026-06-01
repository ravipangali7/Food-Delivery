import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteJson, getJson, postJson } from '@/lib/api';
import {
  clearGuestCart,
  GUEST_CART_EVENT,
  guestCartToCart,
  readGuestCart,
  upsertGuestLine,
  writeGuestCart,
  type GuestCartLine,
} from '@/lib/guestCart';
import { useAuth } from '@/contexts/AuthContext';
import type { Cart, CartItem, Product, ProductVariant } from '@/types';

export function useCart() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [guestRev, setGuestRev] = useState(0);
  const bumpGuest = useCallback(() => setGuestRev(v => v + 1), []);

  useEffect(() => {
    const onGuestCartChange = () => bumpGuest();
    window.addEventListener(GUEST_CART_EVENT, onGuestCartChange);
    return () => window.removeEventListener(GUEST_CART_EVENT, onGuestCartChange);
  }, [bumpGuest]);

  const serverQuery = useQuery({
    queryKey: ['cart', token],
    queryFn: () => getJson<Cart>('/api/cart/', token),
    enabled: !!token,
  });

  const guestLines = useMemo(
    () => (token ? [] : readGuestCart()),
    [token, guestRev],
  );

  const cart = token ? serverQuery.data : guestCartToCart(guestLines);
  const isLoading = !!token && serverQuery.isLoading;

  const invalidate = () => {
    if (token) {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    } else {
      bumpGuest();
    }
  };

  const addProduct = useMutation({
    mutationFn: async ({
      product,
      quantity,
      notes,
      is_preorder,
      variant_id,
      variant,
      unit_price,
    }: {
      product: Product;
      quantity: number;
      notes?: string;
      is_preorder?: boolean;
      variant_id?: number | null;
      variant?: ProductVariant | null;
      unit_price?: number;
    }) => {
      if (token) {
        const body: {
          product_id: number;
          variant_id?: number | null;
          quantity: number;
          notes?: string;
          is_preorder?: boolean;
        } = {
          product_id: product.id,
          quantity,
          notes: notes || undefined,
        };
        if (variant_id != null) body.variant_id = variant_id;
        if (is_preorder) body.is_preorder = true;
        await postJson<Cart, typeof body>('/api/cart/items/', body, token);
        return;
      }
      const lines = readGuestCart();
      const existing = lines.find(
        l =>
          l.product_id === product.id &&
          (l.variant_id ?? null) === (variant_id ?? null) &&
          Boolean(l.is_preorder) === Boolean(is_preorder),
      );
      const nextQty = (existing?.quantity ?? 0) + quantity;
      writeGuestCart(
        upsertGuestLine(lines, product, nextQty, { notes, is_preorder, variant_id, variant, unit_price }),
      );
      bumpGuest();
    },
    onSuccess: invalidate,
  });

  const setLineQuantity = useMutation({
    mutationFn: async ({
      item,
      quantity,
      product,
    }: {
      item: CartItem;
      quantity: number;
      product?: Product;
    }) => {
      if (token) {
        if (quantity < 1) {
          await deleteJson<Cart>(`/api/cart/items/${item.id}/`, token);
          return;
        }
        const body: {
          product_id: number;
          variant_id?: number | null;
          quantity: number;
          notes?: string;
          is_preorder?: boolean;
        } = {
          product_id: item.product_id,
          quantity,
          notes: item.notes,
        };
        if (item.variant_id != null) body.variant_id = item.variant_id;
        if (item.is_preorder) body.is_preorder = true;
        await postJson<Cart, typeof body>('/api/cart/items/', body, token);
        return;
      }
      let lines = readGuestCart();
      if (quantity < 1) {
        lines = lines.filter((_, i) => -(i + 1) !== item.id);
      } else if (product) {
        lines = upsertGuestLine(lines, product, quantity, {
          notes: item.notes,
          is_preorder: item.is_preorder,
          variant_id: item.variant_id ?? null,
          variant: item.variant ?? null,
          unit_price: item.unit_price,
        });
      }
      writeGuestCart(lines);
      bumpGuest();
    },
    onSuccess: invalidate,
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (token) {
        const current = serverQuery.data;
        if (!current?.items?.length) return;
        for (const item of current.items) {
          await deleteJson<Cart>(`/api/cart/items/${item.id}/`, token);
        }
        return;
      }
      clearGuestCart();
      bumpGuest();
    },
    onSuccess: invalidate,
  });

  return {
    cart,
    isLoading,
    isLoggedIn: !!token,
    guestLines: guestLines as GuestCartLine[],
    addProduct,
    setLineQuantity,
    clearAll,
    invalidate,
  };
}
