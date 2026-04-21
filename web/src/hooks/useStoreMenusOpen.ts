import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import type { SuperSetting } from '@/types';

/** When false, product browsing menus should be hidden. True while settings are still loading. */
export function useStoreMenusOpen() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getJson<SuperSetting>('/api/settings/', null),
  });
  return settings?.is_open !== false;
}
