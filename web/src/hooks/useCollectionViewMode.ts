import { useCallback, useState } from 'react';
import type { CollectionViewMode } from '@/types/collection-view';

function readStoredMode(key: string): CollectionViewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'grid' || raw === 'list') return raw;
  } catch {
    /* बेवास्ता */
  }
  return null;
}

/**
 * localStorage मा grid/list छनोट स्थायी गर्छ — admin UX भ्रमणहरूमा स्थिर।
 * अन्य पृष्ठमा (जस्तै products) एउटै `storageKey` पुन:प्रयोग गर्नुहोस् यदि एउटै ग्लोबल प्राथमिकता चाहनुहुन्छ भने।
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
        /* बेवास्ता */
      }
    },
    [storageKey],
  );

  return [mode, setMode];
}
