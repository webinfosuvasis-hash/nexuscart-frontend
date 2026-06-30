/**
 * useRecentlyViewed — per-browser "recently viewed products" state, same
 * localStorage pattern as StoreContext's wishlist (`mt_wish`). This is
 * intentionally frontend-only: which ids a visitor looked at is not catalog
 * data, so it has no business living in the backend. The *list of ids* is
 * client state; the *product cards rendered from those ids* are always a
 * live API call (see RecentlyViewedSection), so nothing displayed is faked.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mt_recently_viewed';
const MAX_ITEMS = 12;

function readIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(() => readIds());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);

  const addViewed = useCallback((id: string) => {
    setIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, MAX_ITEMS));
  }, []);

  return { ids, addViewed };
}
