import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export default function CustomerCartLink() {
  const { cart } = useCart();

  const badge = useMemo(() => {
    const n = (cart?.items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    return n > 0 ? n : undefined;
  }, [cart?.items]);

  const label = badge != null && badge > 99 ? '99+' : badge;

  return (
    <Link
      to="/customer/cart"
      className="relative p-2 text-foreground"
      aria-label={badge != null ? `Cart, ${badge} items` : 'Cart'}
    >
      <ShoppingCart size={20} />
      {badge != null ? (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
          aria-hidden
        >
          {label}
        </span>
      ) : null}
    </Link>
  );
}
