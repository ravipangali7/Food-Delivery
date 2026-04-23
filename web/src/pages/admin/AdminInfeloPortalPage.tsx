import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ExternalLink } from 'lucide-react';

type InfeloOverview = {
  credits: {
    sms_credit?: number;
    per_sms_charge?: string;
    currency?: string;
    buy_credits_url?: string;
    whatsapp_recharge_url?: string;
  } | null;
  credits_error: string;
  embed: {
    portal_origin: string;
    api_base: string;
    infelo_api_key: string | null;
    sms_api_key: string | null;
    script_path: string;
  };
};

type Props = { title: string };

export default function AdminInfeloPortalPage({ title }: Props) {
  const { token } = useAuth();
  const embedHostRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-sms-overview', token],
    queryFn: () => getJson<InfeloOverview>('/api/admin/sms/overview/', token),
    enabled: !!token,
  });

  useEffect(() => {
    const el = embedHostRef.current;
    const portal = data?.embed?.portal_origin?.replace(/\/$/, '');
    const key = data?.embed?.infelo_api_key || data?.embed?.sms_api_key;
    const apiBase = data?.embed?.api_base?.replace(/\/$/, '');
    if (!el || !portal || !key || !apiBase) return;

    const path = (data?.embed?.script_path || '/infelo-api-embed.js').replace(/^\//, '');
    const script = document.createElement('script');
    script.src = `${portal}/${path}`;
    script.async = true;
    script.setAttribute('data-api-key', key);
    script.setAttribute('data-api-base', apiBase);
    script.setAttribute('data-height', '720');
    el.appendChild(script);
    return () => {
      try {
        el.removeChild(script);
      } catch {
        /* already removed */
      }
    };
  }, [data?.embed?.portal_origin, data?.embed?.infelo_api_key, data?.embed?.sms_api_key, data?.embed?.api_base, data?.embed?.script_path]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
        <p className="text-sm text-stone-600 mt-1">
          Infelo account portal embed (<code className="text-xs bg-stone-100 px-1 rounded">infelo-api-embed.js</code>
          ). Summary via{' '}
          <code className="text-xs bg-stone-100 px-1 rounded">GET /api/v1/embed/summary/</code>.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-stone-800 mb-3">Account summary</h2>
        {isLoading ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Failed to load'}</p>
        ) : data?.credits ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-stone-500">Credits remaining</dt>
              <dd className="text-lg font-semibold text-stone-900">{data.credits.sms_credit ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Per SMS</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {data.credits.per_sms_charge != null ? `${data.credits.per_sms_charge}` : '—'}{' '}
                {data.credits.currency ?? ''}
              </dd>
            </div>
            {data.credits.buy_credits_url ? (
              <div className="sm:col-span-2">
                <dt className="text-stone-500 mb-1">Buy credits</dt>
                <dd>
                  <a
                    href={data.credits.buy_credits_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-amber-700 hover:underline"
                  >
                    Open portal <ExternalLink size={14} />
                  </a>
                </dd>
              </div>
            ) : null}
            {data.credits.whatsapp_recharge_url ? (
              <div className="sm:col-span-2">
                <dt className="text-stone-500 mb-1">WhatsApp recharge</dt>
                <dd>
                  <a
                    href={data.credits.whatsapp_recharge_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-amber-700 hover:underline"
                  >
                    WhatsApp <ExternalLink size={14} />
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {data?.credits_error || 'Could not load credits.'} Set <code className="text-xs">INFELO_API_KEY</code> in
            Django <code className="text-xs">settings.py</code> and ensure the key is valid.
          </p>
        )}
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="mt-4 text-sm text-amber-700 hover:underline disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-medium text-stone-800">Infelo portal (embed)</h2>
        {!data?.embed?.portal_origin ? (
          <p className="text-sm text-stone-600">
            Set <code className="text-xs bg-stone-100 px-1 rounded">INFELO_PORTAL_ORIGIN</code> on the Django server
            to the origin that serves <code className="text-xs bg-stone-100 px-1 rounded">infelo-api-embed.js</code> (
            <code className="text-xs">YOUR_PORTAL_ORIGIN</code> in Infelo docs).
          </p>
        ) : !data.embed.infelo_api_key && !data.embed.sms_api_key ? (
          <p className="text-sm text-stone-600">
            Set <code className="text-xs bg-stone-100 px-1 rounded">INFELO_API_KEY</code> in Django settings to load
            the embed script.
          </p>
        ) : (
          <p className="text-xs text-stone-500">
            Script:{' '}
            <code className="break-all bg-stone-50 px-1 py-0.5 rounded">
              {data.embed.portal_origin}
              {data.embed.script_path}
            </code>
          </p>
        )}
        <div
          ref={embedHostRef}
          className="min-h-[200px] border border-dashed border-stone-200 rounded-lg bg-stone-50/50"
        />
      </div>
    </div>
  );
}
