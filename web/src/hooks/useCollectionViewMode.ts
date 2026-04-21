import { useCallback, useState } from 'react';
import type { CollectionViewMode } from '@/types/collection-view';

function readStoredMode(key: string): CollectionViewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'grid' || raw === 'list') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Persists grid/list choice in localStorage for a stable admin UX across visits.
 * Reuse the same `storageKey` on other pages (e.g. products) only if you want one global preference.
 */
export function useCollectionViewMode(
  storageKey: string,
  defaultMode: CollectionViewMode = 'grid',
): [CollectionViewMode, (mode: CollectionViewMode) => void] {
  const [mode, setModeState] = useState<CollectionViewMode>(() => {
    return readStoredMode(storageKey) ?? defaultMode;
  });

  const setMode = useCallback(
    (next: CollectionViewMode) => {
      setModeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  return [mode, setMode];
}
