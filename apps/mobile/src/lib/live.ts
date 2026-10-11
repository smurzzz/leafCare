/**
 * Keeps the numbers on screen live.
 *
 * React Query decides when to refresh from two signals — "is the app focused?"
 * and "is the phone online?" — and on the web it reads both from the `window`.
 * React Native has neither: `focusManager` would keep reporting the app as
 * focused forever (it defaults to `true` when nothing ever tells it otherwise),
 * and `onlineManager` would keep reporting online. So a screen that came back
 * from the background never refetched: the plant count, the streak and the
 * waterings on Profile stayed exactly as they were when it left.
 *
 * Wiring the two managers to `AppState` and NetInfo is what makes
 * `refetchOnWindowFocus` and `refetchOnReconnect` mean anything on this
 * platform. Both are idempotent: `startLiveQueries` registers one listener per
 * signal no matter how many times it is called (React's dev double-render
 * included), and the returned function tears the listeners down again.
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * One definition of "online" for the whole app: NetInfo reports both may be
 * `null` while it is still probing, and `null` must not be read as offline or
 * every cold start would show the pink "No connection" state.
 */
export const isOnlineState = (state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean =>
  state.isConnected !== false && state.isInternetReachable !== false;

let stopLive: (() => void) | null = null;

/**
 * Connects React Query to the phone's lifecycle. Call once, on mount.
 * Returns a teardown that restores React Query's defaults.
 */
export const startLiveQueries = (): (() => void) => {
  if (stopLive) return stopLive;

  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
  });

  onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(isOnlineState(state));
    });
    return () => unsubscribe();
  });

  let stopped = false;
  const teardown = () => {
    // Idempotent: the listeners are removed once, however many callers tear down.
    if (stopped) return;
    stopped = true;
    stopLive = null;
    focusManager.setEventListener(() => () => undefined);
    onlineManager.setEventListener(() => () => undefined);
    // `undefined` restores the "assume focused and online" defaults rather than
    // leaving the app stuck reporting whatever the last event said.
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  };

  stopLive = teardown;
  return teardown;
};
