/**
 * Shared empty arrays for query fallbacks.
 *
 * `data?.accounts ?? []` allocates a fresh array on every render, so any
 * `useMemo` keyed on it recomputes each time and the memoization buys nothing.
 * Reusing these constants keeps the reference stable while the query has no
 * data yet.
 *
 * `never[]` is assignable to any array type, and nothing can be pushed onto
 * one, so a single instance can be shared without any risk of it being filled.
 */
export const EMPTY: never[] = [];