/**
 * Refreshes a screen's data when it comes back into focus.
 *
 * React Query refetches when a component *mounts* with stale data, but the tab
 * screens here never unmount: Expo Router keeps Home, My Plants, Reminders and
 * Profile alive once visited, so switching between them re-renders the same
 * components and no mount ever happens. Without this, the only things that could
 * move a number were a mutation on this device, or `staleTime` expiring in the
 * background while nothing asked for the data.
 *
 * Two details worth keeping:
 *
 * - The focus callback has no dependencies. `useFocusEffect` re-subscribes
 *   whenever its callback identity changes, so a callback that captured the
 *   queries would tear down and re-run on every render — and, since re-running a
 *   focus effect calls it again, it would refetch in a loop. The newest query
 *   results are read from a ref instead.
 * - Only *stale, idle* queries refetch. A query that is fresh was fetched
 *   moments ago and has nothing new to say; one that is already fetching would
 *   just be cancelled and restarted, which is a second request for the same
 *   payload (and on mount it is always in flight, since the screen's own first
 *   fetch hasn't finished yet).
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/** Just enough of a React Query result to decide whether a focus refetch is worth it. */
export type FocusRefresh = {
  refetch: () => Promise<unknown>;
  isStale: boolean;
  isFetching: boolean;
};

export const useRefreshOnFocus = (...queries: FocusRefresh[]): void => {
  const latest = useRef(queries);

  useEffect(() => {
    latest.current = queries;
  });

  useFocusEffect(
    useCallback(() => {
      for (const query of latest.current) {
        if (!query.isStale || query.isFetching) continue;
        void query.refetch().catch(() => undefined);
      }
    }, []),
  );
};
