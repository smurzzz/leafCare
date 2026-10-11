/**
 * Refreshing a screen that never unmounts.
 *
 * Home, My Plants, Reminders and Profile stay mounted for the life of the app, so
 * React Query's mount refetch never fires again for them: whatever is on screen is
 * whatever was fetched the last time something else asked. This hook is that
 * "something". Two of its behaviours are easy to get wrong and are pinned here —
 * it refetches stale queries only (a focus is not a licence for a request storm),
 * and it reads the *latest* query results rather than the ones captured when it
 * was first focused.
 *
 * `renderHook`, `rerender` and `act` are async in this version of the testing
 * library, so the render is awaited before anything is read from it.
 */

import { renderHook } from '@testing-library/react-native';

import { useRefreshOnFocus, type FocusRefresh } from '@/hooks/use-refresh-on-focus';

/** Focused callbacks registered so far, so a test can focus the screen again. */
const mockFocusCallbacks: Array<() => void> = [];

jest.mock('expo-router', () => ({
  __esModule: true,
  // The navigator's contract, minus the navigator: subscribe on focus, unsubscribe
  // on blur, and call the effect straight away the first time.
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => {
      mockFocusCallbacks.push(callback);
      callback();
      return () => {
        const at = mockFocusCallbacks.indexOf(callback);
        if (at >= 0) mockFocusCallbacks.splice(at, 1);
      };
    }, [callback]);
  },
}));

const target = (overrides: Partial<FocusRefresh> = {}): FocusRefresh => ({
  refetch: jest.fn(async () => undefined),
  isStale: true,
  isFetching: false,
  ...overrides,
});

const focusAgain = (): void => {
  for (const callback of [...mockFocusCallbacks]) callback();
};

beforeEach(() => {
  mockFocusCallbacks.length = 0;
});

describe('useRefreshOnFocus', () => {
  it('refetches the stale queries it is given', async () => {
    const home = target();
    const plants = target();
    await renderHook(() => useRefreshOnFocus(home, plants));

    expect(home.refetch).toHaveBeenCalledTimes(1);
    expect(plants.refetch).toHaveBeenCalledTimes(1);
  });

  it('leaves fresh queries alone', async () => {
    // Data fetched seconds ago has nothing new to say, and tapping between tabs
    // must not turn into a request per tap.
    const fresh = target({ isStale: false });
    await renderHook(() => useRefreshOnFocus(fresh));

    expect(fresh.refetch).not.toHaveBeenCalled();
  });

  it('leaves a query that is already fetching alone', async () => {
    // On mount the screen's own first fetch is always still running; refetching
    // would cancel it and start the same request again.
    const inFlight = target({ isFetching: true });
    await renderHook(() => useRefreshOnFocus(inFlight));

    expect(inFlight.refetch).not.toHaveBeenCalled();
  });

  it('uses the state from the most recent render, not the first one', async () => {
    // The focus callback is subscribed once (a callback that changed on every
    // render would re-run the focus effect on every render, and refetch in a
    // loop). So it has to read through a ref: by the time the user comes back to
    // the tab, the query that was fetching during the first render has settled.
    const settled = target({ isStale: true, isFetching: false });
    const fetching = target({ isStale: true, isFetching: true });

    const { rerender } = await renderHook(
      ({ query }: { query: FocusRefresh }) => useRefreshOnFocus(query),
      { initialProps: { query: fetching } },
    );
    expect(fetching.refetch).not.toHaveBeenCalled();

    await rerender({ query: settled });
    focusAgain();

    expect(settled.refetch).toHaveBeenCalledTimes(1);
    // One subscription across both renders, not one per render.
    expect(mockFocusCallbacks).toHaveLength(1);
  });

  it('does not care about a query that fails to refresh', async () => {
    const failing = target({ refetch: jest.fn(async () => Promise.reject(new Error('offline'))) });
    await renderHook(() => useRefreshOnFocus(failing));

    // The rejection is swallowed here because the screen renders the error from
    // the query's own state; an unhandled rejection would be a crash instead.
    expect(failing.refetch).toHaveBeenCalledTimes(1);
  });
});
