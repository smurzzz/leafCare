/**
 * Authenticated tab bar: Home · My Plants · Scan (raised centre FAB) ·
 * Reminders · Profile (docs/specification.md navigation chrome).
 *
 * The FAB is not a route: it pushes /scan so the capture flow keeps its own
 * stack and the tab bar never shows the camera behind itself.
 */

import { radius, shadows, spacing } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/settings-provider';

import { BellIcon, HomeIcon, LeafIcon, ScanFrameIcon, UserIcon, type IconProps } from './icons';

type TabRoute = { key: string; name: string };

type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    navigate: (name: string, params?: object) => void;
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
};

const TABS: { name: string; label: string; Icon: (props: IconProps) => React.ReactElement }[] = [
  { name: 'home', label: 'Home', Icon: HomeIcon },
  { name: 'plants', label: 'My Plants', Icon: LeafIcon },
  { name: 'reminders', label: 'Reminders', Icon: BellIcon },
  { name: 'profile', label: 'Profile', Icon: UserIcon },
];

export const LeafTabBar = ({ state, navigation }: TabBarProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeName = state.routes[state.index]?.name;

  const renderTab = (tab: (typeof TABS)[number]) => {
    const route = state.routes.find((candidate) => candidate.name === tab.name);
    const focused = activeName === tab.name;
    const color = focused ? colors.forest : colors.muted;

    return (
      <Pressable
        key={tab.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={() => {
          if (!route) return;
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
        }}
        style={styles.tab}
      >
        <tab.Icon size={22} color={color} />
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.ring,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
        shadows.card,
      ]}
    >
      {renderTab(TABS[0]!)}
      {renderTab(TABS[1]!)}

      <View style={styles.fabSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Identify a plant"
          onPress={() => router.push('/scan')}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.forestDeep,
              opacity: pressed ? 0.9 : 1,
              borderColor: colors.tabBar,
            },
          ]}
        >
          <ScanFrameIcon size={26} color="#FFFFFF" />
        </Pressable>
      </View>

      {renderTab(TABS[2]!)}
      {renderTab(TABS[3]!)}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2, minHeight: 48 },
  label: { fontSize: 10, fontWeight: '700' },
  fabSlot: { width: 76, alignItems: 'center', justifyContent: 'flex-start' },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
});
