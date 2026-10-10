/**
 * 11 — Scan result (top suggestion ≥ 80%). Hero photo, match chip, care tiles,
 * tappable alternatives that swap the selection, and Add to My Plants.
 */

import { radius, spacing, type IdentificationSuggestion } from '@leafcare/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeftIcon, DropletIcon, LeafIcon } from '@/components/icons';
import { ErrorState } from '@/components/ui/feedback';
import { Button, IconButton } from '@/components/ui/primitives';
import {
  allSuggestions,
  clearScanSession,
  getScanSession,
  selectSuggestion,
  selectedSuggestion,
} from '@/lib/scan-session';
import { useSettings } from '@/theme/settings-provider';

export default function ScanResultRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const session = getScanSession();
  const [index, setIndex] = useState(session?.selectedIndex ?? 0);
  const suggestions = allSuggestions();
  const selected = suggestions[index] ?? selectedSuggestion();

  if (!session || !selected) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ErrorState
          title="That result expired"
          body="Scan a leaf again and we will keep the result open while you add it."
          onRetry={() => router.replace('/scan')}
        />
      </SafeAreaView>
    );
  }

  const alternatives = suggestions.slice(1);
  const matchPercent = Math.round(selected.score * 100);

  const chooseAlternative = (position: number) => {
    setIndex(position);
    // Keep the shared session in step so the add-plant screen is prefilled.
    selectSuggestion(position);
  };

  const retake = () => {
    clearScanSession();
    router.replace('/scan');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <Image source={{ uri: session.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <SafeAreaView edges={['top']} style={styles.heroChrome}>
          <IconButton accessibilityLabel="Go back" onPress={retake} variant="glass">
            <ChevronLeftIcon size={18} color="#FFFFFF" />
          </IconButton>
        </SafeAreaView>
      </View>

      <ScrollView
        style={[styles.sheet, { backgroundColor: colors.surface }]}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grabberWrap}>
          <View style={[styles.grabber, { backgroundColor: colors.ring }]} />
        </View>

        <Text style={[styles.species, { color: colors.ink }]}>{selected.commonName}</Text>
        <Text style={[styles.scientific, { color: colors.muted }]}>{selected.scientificName}</Text>

        <View style={[styles.matchChip, { backgroundColor: colors.mint }]}>
          <DropletIcon size={14} color={colors.forest} />
          <Text style={[styles.matchLabel, { color: colors.forest }]}>{matchPercent}% match</Text>
        </View>

        <View style={styles.tiles}>
          <CareTile title="Water" value={`Every ${selected.intervalDays} days`} icon="💧" colors={colors} />
          <CareTile title="Light" value={selected.light} icon="☀️" colors={colors} />
          <CareTile title="Difficulty" value={selected.difficulty} icon="🌱" colors={colors} />
        </View>

        {alternatives.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Not right? Other matches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.altRow}>
              {alternatives.map((item, position) => (
                <Pressable
                  key={item.scientificName}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${item.commonName}`}
                  onPress={() => chooseAlternative(position + 1)}
                  style={[styles.altCard, { borderColor: colors.ring, backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.altPercent, { color: colors.forest }]}>
                    {Math.round(item.score * 100)}%
                  </Text>
                  <Text style={[styles.altName, { color: colors.ink }]} numberOfLines={2}>
                    {item.commonName}
                  </Text>
                  <Text style={[styles.altScientific, { color: colors.muted }]} numberOfLines={1}>
                    {item.scientificName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={[styles.careDetail, { color: colors.muted }]}>{selected.careDetail}</Text>

        <View style={{ gap: spacing.md }}>
          <Button
            label="Add to My Plants"
            icon={<LeafIcon size={18} color="#FFFFFF" />}
            onPress={() => router.push('/plants/add')}
          />
          <Button label="Retake photo" variant="secondary" onPress={retake} />
        </View>
      </ScrollView>
    </View>
  );
}

const CareTile = ({
  title,
  value,
  icon,
  colors,
}: {
  title: string;
  value: string;
  icon: string;
  colors: ReturnType<typeof useSettings>['colors'];
}) => (
  <View style={[styles.tile, { backgroundColor: colors.surfaceAlt, borderColor: colors.ring }]}>
    <Text style={{ fontSize: 16 }}>{icon}</Text>
    <Text style={[styles.tileTitle, { color: colors.muted }]}>{title}</Text>
    <Text style={[styles.tileValue, { color: colors.ink }]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

export type { IdentificationSuggestion };

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: '42%' },
  heroChrome: { padding: spacing.md },
  sheet: {
    flex: 1,
    marginTop: -radius.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheetContent: { padding: spacing.xxl, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  grabberWrap: { alignItems: 'center', paddingBottom: spacing.sm },
  grabber: { width: 44, height: 5, borderRadius: 3 },
  species: { fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  scientific: { fontSize: 13, fontStyle: 'italic' },
  matchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: spacing.sm,
  },
  matchLabel: { fontSize: 13, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  tile: { flex: 1, borderRadius: 18, borderWidth: 1, padding: spacing.md, gap: 4, minHeight: 96 },
  tileTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  tileValue: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  altRow: { gap: spacing.md },
  altCard: { width: 150, borderRadius: 18, borderWidth: 1, padding: spacing.md, gap: 4 },
  altPercent: { fontSize: 18, fontWeight: '800' },
  altName: { fontSize: 13, fontWeight: '700' },
  altScientific: { fontSize: 11, fontStyle: 'italic' },
  careDetail: { fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
});
