import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import type { SuperSetting } from '@/types';

export default function CustomerAboutUs() {
  const { data: s, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });

  return (
    <div className="pb-8">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/profile" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">About us</h1>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-prose mx-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {s && (
          <>
            <div className="flex flex-col items-center text-center gap-3">
              {s.logo ? (
                <img src={s.logo} alt="" className="h-20 w-20 object-contain rounded-2xl border border-border bg-white" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-amber-100 flex items-center justify-center text-3xl">🍬</div>
              )}
              <h2 className="font-display font-bold text-xl text-amber-900">{s.name}</h2>
            </div>

            <section className="space-y-2">
              <h3 className="font-semibold text-sm text-amber-900">Who we are</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.meta_description?.trim()
                  ? s.meta_description
                  : `${s.name} is our food and sweets storefront. We prepare orders placed through this app and coordinate delivery to your door when you choose delivery.`}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-sm text-amber-900">Store location</h3>
              {s.address?.trim() ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.address}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Address is configured in store settings.</p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-sm text-amber-900">Contact</h3>
              {s.phone?.trim() ? (
                <a href={`tel:${s.phone}`} className="text-sm text-amber-700 font-medium">
                  {s.phone}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Phone is set in store settings.</p>
              )}
            </section>

            {s.meta_title?.trim() && (
              <p className="text-[11px] text-muted-foreground border-t border-border pt-4">{s.meta_title}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
