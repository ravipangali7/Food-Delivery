import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getJson } from '@/lib/api';
import type { SuperSetting } from '@/types';

export default function CustomerTerms() {
  const { data: s, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
    refetchOnMount: 'always',
  });

  const customTerms = s?.terms_and_conditions?.trim();

  return (
    <div className="pb-8">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/profile" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Terms &amp; conditions</h1>
      </div>

      <div className="px-4 py-6 space-y-5 text-sm text-muted-foreground leading-relaxed max-w-prose mx-auto">
        {isLoading && <p>Loading…</p>}

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

        {customTerms ? (
          <>
            <div className="whitespace-pre-wrap">{customTerms}</div>
            {s?.phone?.trim() ? (
              <p className="text-xs pt-4 border-t border-border">
                Questions? Call{' '}
                <a href={`tel:${s.phone}`} className="text-amber-700">
                  {s.phone}
                </a>
                .
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground border border-border rounded-lg px-3 py-3 bg-muted/30">
            Terms have not been published yet. They are managed in the admin panel under Store settings → About &amp;
            legal → Terms &amp; conditions.
            {s?.phone?.trim() ? (
              <>
                {' '}
                For help, call{' '}
                <a href={`tel:${s.phone}`} className="text-amber-700 font-medium">
                  {s.phone}
                </a>
                .
              </>
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}
