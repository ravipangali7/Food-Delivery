import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import type { SuperSetting } from '@/types';

/** false भए उत्पादन browse मेनु लुकाउनुपर्छ। settings लोड हुँदासम्म true। */
export function useStoreMenusOpen() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });
  return settings?.is_open !== false;
}
