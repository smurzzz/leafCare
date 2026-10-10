import { useAuth } from '@clerk/expo';
import { Redirect, Tabs } from 'expo-router';

import { LeafTabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  // Tabs are only reachable with a Clerk session.
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      tabBar={(props) => <LeafTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="plants" options={{ title: 'My Plants' }} />
      <Tabs.Screen name="reminders" options={{ title: 'Reminders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
