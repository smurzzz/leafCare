/**
 * Keeping what is on screen live.
 *
 * React Query refreshes a stale query when the app regains focus, and on
 * reconnect — but only if something tells it when those happen. On the web the
 * `window` does; on a phone, nothing does, and without this bridge the managers
 * report "focused and online" forever. The failure is silent and expensive: every
 * number the user looks at (plant count, streak, waterings) keeps rendering a
 * value that was true whenever the payload was last fetched.
 *
 * So the signals are simulated here and the managers' own state is read back,
 * ending with the behaviour rather than the wiring: a mounted query refetches
 * when the app returns to the foreground.
 */

import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { isOnlineState, startLiveQueries } from '@/lib/live';

type AppStateChange = (status: string) => void;

/** Handlers `startLiveQueries` registered; the mock pushes them here. */
const mockAppStateHandlers: AppStateChange[] = [];
const mockAppStateRemovals: jest.Mock[] = [];

jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    currentState: 'active',
    addEventListener: jest.fn((_type: string, handler: AppStateChange) => {
      mockAppStateHandlers.push(handler);
      const removal = jest.fn(() => {
        const at = mockAppStateHandlers.indexOf(handler);
        if (at >= 0) mockAppStateHandlers.splice(at, 1);
      });
      mockAppStateRemovals.push(removal);
      return { remove: removal };
    }),
  },
}));

/** The callback NetInfo was subscribed with; null once unsubscribed. */
let mockNetworkListener: ((state: unknown) => void) | null = null;
const mockNetInfoUnsubscribe = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((callback: (state: unknown) => void) => {
      mockNetworkListener = callback;
      return () => {
        mockNetworkListener = null;
      };
    }),
  },
}));

const netInfo = NetInfo as unknown as { addEventListener: jest.Mock };

/** Local helper: the API's `null` (still probing) must not read as offline. */
const state = (isConnected: boolean | null, isInternetReachable: boolean | null) => ({
  isConnected,
  isInternetReachable,
});

let stop: (() => void) | null = null;

afterEach(() => {
  stop?.();
  stop = null;
  mockAppStateHandlers.length = 0;
  mockAppStateRemovals.length = 0;
  mockNetworkListener = null;
  mockNetInfoUnsubscribe.mockClear();
});

describe('startLiveQueries', () => {
  it('follows the app into the background and back again', () => {
    stop = startLiveQueries();
    const useApp = mockAppStateHandlers[0] as AppStateChange;

    useApp('background');
    expect(focusManager.isFocused()).toBe(false);

    // The screen the user comes back to is refreshed, which is the whole point:
    // the query cache refetches its stale queries on this event.
    useApp('active');
    expect(focusManager.isFocused()).toBe(true);
  });

  it('reports the phone as offline when the network goes away, and back', () => {
    stop = startLiveQueries();

    mockNetworkListener?.(state(false, false));
    expect(onlineManager.isOnline()).toBe(false);

    mockNetworkListener?.(state(true, true));
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('does not read a half-finished NetInfo probe as offline', () => {
    // On a cold start NetInfo answers twice: once with what it knows already
    // (`isInternetReachable: null`) and once after probing. Treating the first
    // answer as offline would flash the pink banner and block every mutation.
    expect(isOnlineState(state(true, null))).toBe(true);
    expect(isOnlineState(state(null, null))).toBe(true);
    expect(isOnlineState(state(false, true))).toBe(false);
    expect(isOnlineState(state(true, false))).toBe(false);
  });

  it('registers one listener per signal, however many times it is started', () => {
    // React's dev double-render mounts the root layout twice; a second pair of
    // listeners would also mean the first pair is never removed.
    stop = startLiveQueries();
    startLiveQueries();
    startLiveQueries();

    expect(mockAppStateHandlers).toHaveLength(1);
    expect(netInfo.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('removes the listeners when it is torn down', () => {
    const teardown = startLiveQueries();
    expect(mockAppStateHandlers).toHaveLength(1);

    teardown();

    expect(mockAppStateHandlers).toHaveLength(0);
    expect(mockAppStateRemovals[0]).toHaveBeenCalledTimes(1);
    expect(mockNetworkListener).toBeNull();
    // The managers go back to assuming focused and online rather than being stuck
    // on whatever the last event said.
    expect(focusManager.isFocused()).toBe(true);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('refetches a mounted query when the app comes back to the foreground', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true } },
    });
    const queryFn = jest.fn(async () => 1);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = await renderHook(() => useQuery({ queryKey: ['plants'], queryFn }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryFn).toHaveBeenCalledTimes(1);

    stop = startLiveQueries();
    const useApp = mockAppStateHandlers[0] as AppStateChange;
    useApp('background');
    useApp('active');

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

    client.clear();
  });
});
