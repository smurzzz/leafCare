/**
 * Connectivity (src/lib/network.ts, screen 26 and XC-1).
 *
 * `useNetworkStatus` decides whether the pink "No connection" banner and the
 * skeleton cards appear, and whether mutating calls are attempted at all, so the
 * mapping from NetInfo's state is pinned here: "no internet" must be treated as
 * offline even while the phone is still attached to Wi-Fi, and coming back must
 * fire the queue flush exactly once.
 *
 * Note the v14 testing-library API: `renderHook`, `act` and `unmount` are all
 * async, so every interaction is awaited.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { onReconnect, useNetworkStatus } from '../network';

type MockNetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

const mockListeners = new Set<(state: MockNetInfoState) => void>();
let mockState: MockNetInfoState = { isConnected: true, isInternetReachable: true };

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async (): Promise<MockNetInfoState> => mockState),
    addEventListener: jest.fn((listener: (state: MockNetInfoState) => void) => {
      mockListeners.add(listener);
      return () => {
        mockListeners.delete(listener);
      };
    }),
  },
}));

/** Delivers a state change the way NetInfo would. */
const emit = (state: MockNetInfoState): Promise<void> =>
  act(() => {
    for (const listener of [...mockListeners]) listener(state);
  });

beforeEach(() => {
  mockListeners.clear();
  mockState = { isConnected: true, isInternetReachable: true };
});

describe('useNetworkStatus', () => {
  it('settles online once NetInfo answers', async () => {
    // The first paint is deliberately optimistic (`isOnline` true while
    // `isChecking`), but v14's async render has already flushed the fetch by the
    // time it hands back a result, so only the settled state is observable here.
    const { result } = await renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.isOnline).toBe(true);
  });

  it('reports offline when the device has no connection', async () => {
    mockState = { isConnected: false, isInternetReachable: false };
    const { result } = await renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isOnline).toBe(false));
    expect(result.current.isChecking).toBe(false);
  });

  it('reports offline while connected to a network with no internet', async () => {
    // Captive portals and dead Wi-Fi: `isConnected` is true, the app still cannot
    // reach the API, and the screen must show the offline treatment.
    mockState = { isConnected: true, isInternetReachable: false };
    const { result } = await renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isOnline).toBe(false));
  });

  it('follows transitions in both directions', async () => {
    const { result } = await renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current.isChecking).toBe(false));

    await emit({ isConnected: false, isInternetReachable: false });
    await waitFor(() => expect(result.current.isOnline).toBe(false));

    await emit({ isConnected: true, isInternetReachable: true });
    await waitFor(() => expect(result.current.isOnline).toBe(true));
  });

  it('unsubscribes from NetInfo when the last screen using it unmounts', async () => {
    const { unmount } = await renderHook(() => useNetworkStatus());
    await waitFor(() => expect(mockListeners.size).toBe(1));

    await unmount();

    expect(mockListeners.size).toBe(0);
  });
});

describe('onReconnect', () => {
  it('flushes only on a connected state', async () => {
    let flushed = 0;
    const off = onReconnect(() => {
      flushed += 1;
    });

    await emit({ isConnected: false, isInternetReachable: false });
    await emit({ isConnected: true, isInternetReachable: false });
    expect(flushed).toBe(0);

    await emit({ isConnected: true, isInternetReachable: true });
    expect(flushed).toBe(1);

    off();
  });

  it('stops listening after unsubscribe', async () => {
    let flushed = 0;
    const off = onReconnect(() => {
      flushed += 1;
    });
    off();

    await emit({ isConnected: true, isInternetReachable: true });

    expect(flushed).toBe(0);
  });
});
