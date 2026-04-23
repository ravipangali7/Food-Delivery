import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Cart } from '@/types';

export default function CustomerCartLink() {
  const { token } = useAuth();

  const { data: cart } = useQuery({
    queryKey: ['cart', token],
    queryFn: () => getJson<Cart>('/api/cart/', token),
    enabled: !!token,
  });

  const badge = useMemo(() => {
    const n = (cart?.items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    return n > 0 ? n : undefined;
  }, [cart?.items]);

  const label = badge != null && badge > 99 ? '99+' : badge;

  return (
    <Link to="/customer/cart" className="relative p-2 text-foreground" aria-label="Cart">
      <ShoppingCart size={20} />
      {badge != null ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
          {label}
        </span>
      ) : null}
    </Link>
  );
}
