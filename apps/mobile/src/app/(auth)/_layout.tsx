import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

import { useTheme } from '@/theme/settings-provider';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { colors } = useTheme();

  // Returning users skip straight into the app (docs/testing.md auth cases).
  if (isLoaded && isSignedIn) return <Redirect href="/(tabs)/home" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
