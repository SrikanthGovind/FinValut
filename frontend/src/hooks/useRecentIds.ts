import { useCallback, useState } from "react";

export interface RecentId {
  id: string;
  /** Operator-supplied label, so a list of UUIDs stays readable. */
  label?: string;
  lastUsed: string;
}

const LIMIT = 8;

/** UUID shape check, matching the Postgres `uuid` columns the API exposes. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

/**
 * Browser-local list of recently used identifiers.
 *
 * The API addresses customers and accounts by UUID only: there is no lookup by
 * email or by account number for a teller, whose role holds neither USER_READ
 * nor ACCOUNT_READ_ANY. Without this, serving the same customer twice at a
 * counter would mean re-pasting the same UUID.
 *
 * Nothing here reaches the server. It is convenience state scoped to one
 * browser, and clearing it costs nothing.
 */
export function useRecentIds(storageKey: string) {
  // Read once, during the initial render, rather than in an effect: the key is a
  // constant per call site, so there is nothing to resynchronise afterwards and
  // an effect would only cost an extra render on every mount.
  const [recent, setRecent] = useState<RecentId[]>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as RecentId[]) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback(
    (next: RecentId[]) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage unavailable: the list lasts for this session only */
      }
    },
    [storageKey]
  );

  const remember = useCallback(
    (id: string, label?: string) => {
      setRecent((current) => {
        const next: RecentId[] = [
          { id, label, lastUsed: new Date().toISOString() },
          ...current.filter((entry) => entry.id !== id),
        ].slice(0, LIMIT);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const forget = useCallback(
    (id: string) => {
      setRecent((current) => {
        const next = current.filter((entry) => entry.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clear = useCallback(() => {
    setRecent([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { recent, remember, forget, clear };
}

export const ACCOUNT_RECENT_KEY = "finvault.recentAccounts";
export const CUSTOMER_RECENT_KEY = "finvault.recentCustomers";

export default useRecentIds;
