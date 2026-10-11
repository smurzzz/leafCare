/**
 * Pull-to-refresh state for a scrollable screen (XC-1's "try again" gesture).
 *
 * The screens refresh more than one query at a time — Home alone reads the home
 * payload, the plant list and the profile — so this takes one callback that does
 * all of it and reports a single spinner, rather than leaving three spinners tied
 * to three queries that finish at different moments.
 *
 * The callback is held in a ref: a caller that passes an inline arrow function
 * gets a new identity every render, and a `useCallback`-keyed `onRefresh` would
 * be recreated with it, which makes `RefreshControl` re-render mid-gesture. The
 * spinner is driven by the promise, so a failed refetch still stops it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type PullToRefresh = {
  refreshing: boolean;
  onRefresh: () => void;
};

export const usePullToRefresh = (refresh: () => Promise<unknown>): PullToRefresh => {
  const latest = useRef(refresh);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    latest.current = refresh;
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void latest
      .current()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, []);

  return { refreshing, onRefresh };
};
