import { ClerkProvider, useAuth } from '@clerk/expo';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBannerHost, ToastProvider } from '@/components/ui/feedback';
import { setSessionTokenGetter } from '@/lib/api';
import { tokenCache, CLERK_PUBLISHABLE_KEY, isClerkConfigured } from '@/lib/clerk';
import { registerForPushNotifications } from '@/lib/notifications';
import { useNetworkStatus } from '@/lib/network';
import { flushWateringQueue, hydrateQueryCache, setCacheOwner } from '@/lib/queries';
import { SetupScreen } from '@/screens/setup-screen';
import { SettingsProvider, useTheme } from '@/theme/settings-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
    mutations: { retry: 0 },
  },
});

/** Bridges Clerk's session token into the API client and syncs queued taps. */
const SessionBridge = () => {
  const { getToken, isSignedIn, userId } = useAuth();
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    setSessionTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  // Scope cached payloads to this Clerk user, then restore them so Home, My
  // Plants and Reminders have content before the first request finishes — or
  // when it cannot finish at all.
  useEffect(() => {
    setCacheOwner(userId ?? null);
    if (!userId || hydratedFor.current === userId) return;
    hydratedFor.current = userId;
    void hydrateQueryCache(queryClient).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (!isSignedIn) return;
    // Best-effort: the token is stored server-side by /api/me/push-token once
    // the notification settings screen confirms the opt-in.
    void registerForPushNotifications().catch(() => undefined);
  }, [isSignedIn]);

  return null;
};

/** Flushes offline waterings whenever connectivity returns. */
const OfflineSync = () => {
  const client = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const wasOnline = useRef(isOnline);

  useEffect(() => {
    if (!wasOnline.current && isOnline) {
      void flushWateringQueue(client).catch(() => undefined);
    }
    wasOnline.current = isOnline;
  }, [isOnline, client]);

  return null;
};

/** Shows the pink banner and keeps the layout from shifting under it. */
const NetworkChrome = () => {
  const { isOnline } = useNetworkStatus();
  return isOnline ? null : <OfflineBannerHost />;
};

const RootNavigator = () => {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="scan/identifying" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="plants/add" options={{ presentation: 'card' }} />
      <Stack.Screen name="care-log" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/notifications" />
      <Stack.Screen
        name="settings/delete-account"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
      <Stack.Screen name="error" options={{ presentation: 'modal' }} />
    </Stack>
  );
};

const ThemedApp = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ToastProvider>
        <SessionBridge />
        <OfflineSync />
        <NetworkChrome />
        <RootNavigator />
        <StatusBar style="auto" />
      </ToastProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

export default function RootLayout() {
  // Without a publishable key Clerk cannot boot at all, so show the setup guide
  // rather than crashing on a white screen.
  if (!isClerkConfigured()) {
    return (
      <SafeAreaProvider>
        <SettingsProvider>
          <SetupScreen />
        </SettingsProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <ThemedApp />
        </SettingsProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
