/**
 * Shown when the app cannot possibly work: no Clerk publishable key in
 * development, or a build whose configuration never made it into the bundle.
 *
 * The app must be openable before .env is filled in, so instead of a red screen
 * we explain exactly which file needs which value. A *built* app gets different
 * copy, because whoever installed it cannot edit a .env file — they need to know
 * the build itself is wrong, not their phone.
 */

import { palette, spacing } from '@leafcare/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SplashMark } from '@/components/illustrations';

const ROWS: [string, string][] = [
  ['apps/mobile/.env', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…'],
  ['apps/mobile/.env', 'EXPO_PUBLIC_API_BASE_URL=http://<your LAN IP>:3000'],
  ['apps/api/.env.local', 'CLERK_SECRET_KEY / CLERK_WEBHOOK_SECRET'],
  ['apps/api/.env.local', 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'],
  ['apps/api/.env.local', 'PLANT_ID_API_KEY (or IDENTIFY_PROVIDER=mock)'],
];

export const SetupScreen = ({
  variant = 'dev',
  issue,
}: {
  /** `build` means an installed app with a broken build, not an unfilled .env. */
  variant?: 'dev' | 'build';
  /** The single missing or unusable value, shown verbatim. */
  issue?: string | null;
} = {}) => {
  const isBuild = variant === 'build';
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mark}>
          <SplashMark size={96} />
        </View>
        <Text style={styles.title}>{isBuild ? 'This build is incomplete' : 'Almost there'}</Text>
        <Text style={styles.body}>
          {isBuild
            ? 'LeafCare was built without the settings it needs, so it cannot reach its server. The build has to be made again with its configuration in place — nothing on this phone can fix it.'
            : 'LeafCare needs its environment filled in before it can sign you in. Copy the example files and paste your keys, then restart the dev server.'}
        </Text>

        {issue ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.file}>Build configuration</Text>
              <Text style={styles.value}>{issue}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          {ROWS.map(([file, value]) => (
            <View key={`${file}-${value}`} style={styles.row}>
              <Text style={styles.file}>{file}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          {isBuild
            ? 'Build settings live in the EAS environment for the build profile: eas env:list. Expo only bundles EXPO_PUBLIC_* values; secret keys stay on the API.'
            : 'Secrets never belong in this app. Only EXPO_PUBLIC_* values are bundled; Plant.id, Clerk secret keys and the Supabase service role stay on the API.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.forestDeep },
  content: { padding: spacing.xxl, gap: spacing.lg, alignItems: 'center' },
  mark: { marginTop: spacing.xxxl },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  body: { color: palette.mint, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  card: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  row: { gap: 2 },
  file: { color: palette.mintIcon, fontSize: 12, fontWeight: '800' },
  value: { color: '#FFFFFF', fontSize: 12, fontFamily: 'monospace' },
  footnote: {
    color: 'rgba(231,244,234,0.7)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
