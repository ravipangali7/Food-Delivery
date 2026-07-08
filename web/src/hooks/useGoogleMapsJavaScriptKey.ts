import { useQuery } from '@tanstack/react-query';
import { ApiHttpError, getPublicJson } from '@/lib/api';

type MapsKeyRes = { mapsApiKey: string };

/**
 * Google Maps JS `key` — Infelo बाट API मार्फत proxy।
 * `VITE_GOOGLE_MAPS_API_KEY` ले local/dev override गर्न सक्छ।
 */
export function useGoogleMapsJavaScriptKey() {
  const devOverride = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';
  const q = useQuery({
    queryKey: ['google-maps-js-key', devOverride],
    queryFn: async () => {
      return getPublicJson<MapsKeyRes>('/api/google-maps-js-key/');
    },
    enabled: !devOverride,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const apiKey = devOverride || q.data?.mapsApiKey;
  return {
    apiKey: apiKey as string | undefined,
    isLoadingKey: !devOverride && q.isPending,
    keyError: !devOverride && q.isError ? (q.error instanceof ApiHttpError ? q.error.message : String(q.error)) : null,
    keyErrorStatus: !devOverride && q.isError && q.error instanceof ApiHttpError ? q.error.status : null,
  };
}
