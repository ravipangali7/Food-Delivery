import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import { renderAboutPlainText } from '@/lib/customerAboutText';
import type { SuperSetting } from '@/types';

function storeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export default function CustomerAboutUs() {
  const { data: s, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
    refetchOnMount: 'always',
  });

  const aboutText = s?.about_us?.trim();
  const addressText = s?.address?.trim();
  const phoneText = s?.phone?.trim();

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

        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Could not load store settings.'}{' '}
            <button
              type="button"
              className="underline font-medium"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Retry
            </button>
          </div>
        )}

        {s && (
          <>
            <div className="flex flex-col items-center text-center gap-3">
              {s.logo ? (
                <img
                  src={s.logo}
                  alt={s.name}
                  className="h-20 w-20 object-contain rounded-2xl border border-border bg-white"
                />
              ) : (
                <div
                  className="h-20 w-20 rounded-2xl bg-amber-100 flex items-center justify-center text-lg font-bold text-amber-900 border border-border"
                  aria-hidden
                >
                  {storeInitials(s.name)}
                </div>
              )}
              <h2 className="font-display font-bold text-xl text-amber-900">{s.name}</h2>
              {phoneText ? (
                <a href={`tel:${phoneText}`} className="text-sm text-amber-700 font-medium">
                  {phoneText}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Phone number is set in Store settings → General.</p>
              )}
            </div>

            <section className="space-y-2">
              <h3 className="font-semibold text-sm text-amber-900">About</h3>
              {aboutText ? (
                renderAboutPlainText(aboutText)
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  About text has not been published yet. Add it under Store settings → About &amp; legal → About us.
                </p>
              )}
            </section>

            {addressText ? (
              <section className="space-y-2">
                <h3 className="font-semibold text-sm text-amber-900">Address</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{addressText}</p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
