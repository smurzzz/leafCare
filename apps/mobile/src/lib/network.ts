/**
 * Connectivity (screen 26). `useNetworkStatus` drives the pink "No connection"
 * banner and the skeleton state; `flushWateringQueue` runs when we come back.
 */

import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export const useNetworkStatus = (): { isOnline: boolean; isChecking: boolean } => {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    void NetInfo.fetch().then((state) => {
      if (!mounted) return;
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
      setIsChecking(false);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
      setIsChecking(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { isOnline, isChecking };
};

/** Subscribes to transitions; used to flush the offline queue on reconnect. */
export const onReconnect = (callback: () => void): (() => void) =>
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) callback();
  });
