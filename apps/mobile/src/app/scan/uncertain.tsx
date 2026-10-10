/**
 * 12 — Low confidence. Tips, ranked possible matches (tap to accept), Retake and
 * a manual species search that queries our own catalogue.
 */

import { palette, spacing, type Species } from '@leafcare/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchIcon } from '@/components/icons';
import { ErrorState } from '@/components/ui/feedback';
import { SearchField } from '@/components/ui/inputs';
import { Sheet, TipCard } from '@/components/ui/misc';
import { Button, Card, TextButton } from '@/components/ui/primitives';
import { allSuggestions, clearScanSession, getScanSession, setScanResult } from '@/lib/scan-session';
import { useSpeciesSearch } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

export default function LowConfidenceRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const session = getScanSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const species = useSpeciesSearch(query);

  if (!session?.result) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ErrorState
          title="That scan expired"
          body="Retake the photo and we will try again in even daylight."
          onRetry={() => router.replace('/scan')}
        />
      </SafeAreaView>
    );
  }

  const matches = allSuggestions();

  const retake = () => {
    clearScanSession();
    router.replace('/scan');
  };

  /** Accepts a match as the selected species and continues to Add plant. */
  const acceptMatch = (index: number) => {
    if (!session.result || !session.identificationId) return;
    const suggestion = matches[index];
    if (!suggestion) return;
    const reordered = {
      ...session.result,
      top: suggestion,
      alternatives: matches.filter((_, position) => position !== index),
    };
    setScanResult(session.identificationId, reordered);
    router.replace('/scan/result');
  };

  const acceptSpecies = (entry: Species) => {
    if (!session.result || !session.identificationId) return;
    setScanResult(session.identificationId, {
      ...session.result,
      top: {
        scientificName: entry.scientificName,
        commonName: entry.commonName,
        score: 0,
        intervalDays: entry.intervalDays,
        light: entry.light,
        difficulty: entry.difficulty,
        careDetail: entry.careDetail,
      },
      alternatives: session.result.alternatives,
    });
    setSearchOpen(false);
    router.replace('/plants/add');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.mint }]}>
            <Text style={{ fontSize: 30 }}>🔍</Text>
          </View>
          <Text style={[styles.question, { color: colors.forest }]}>?</Text>
        </View>

        <Text style={[styles.title, { color: colors.ink }]}>We’re not quite sure</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          The photo was a little dark or blurry. Try again in even daylight and fill the frame with
          a single leaf.
        </Text>

        <TipCard
          title="Best results"
          body="Natural light, leaf flat and centred, no other plants in frame."
        />

        {matches.length > 0 ? (
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Possible matches</Text>
        ) : null}

        <View style={{ gap: spacing.md }}>
          {matches.map((match, index) => (
            <Pressable
              key={match.scientificName}
              accessibilityRole="button"
              accessibilityLabel={`Use ${match.commonName}`}
              onPress={() => acceptMatch(index)}
              style={[
                styles.matchRow,
                { backgroundColor: colors.surface, borderColor: colors.ring },
              ]}
            >
              {session.photoUri ? (
                <Image source={{ uri: session.photoUri }} style={styles.matchThumb} contentFit="cover" />
              ) : (
                <View style={[styles.matchThumb, { backgroundColor: colors.mint }]} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.matchName, { color: colors.ink }]} numberOfLines={1}>
                  {match.commonName}
                </Text>
                <Text style={[styles.matchSub, { color: colors.muted }]} numberOfLines={1}>
                  Likely houseplant · {match.scientificName}
                </Text>
              </View>
              <Text style={[styles.matchPercent, { color: colors.forest }]}>
                {Math.max(1, Math.round(match.score * 100))}%
              </Text>
            </Pressable>
          ))}
        </View>

        {matches.length === 0 ? (
          <Card tone="mint">
            <Text style={{ color: colors.forestDeep, fontSize: 13 }}>
              No matches came back for this photo. Try a clearer, closer shot.
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.sticky, { backgroundColor: colors.background, borderTopColor: colors.ring }]}>
        <Button label="Retake photo" onPress={retake} />
        <Button label="Search manually" variant="secondary" onPress={() => setSearchOpen(true)} />
      </View>

      <Sheet visible={searchOpen} onClose={() => setSearchOpen(false)} title="Search species">
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Monstera, ZZ plant, Ficus…"
        />
        <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
          {(species.data?.results ?? []).map((entry) => (
            <Pressable
              key={entry.scientificName}
              accessibilityRole="button"
              onPress={() => acceptSpecies(entry)}
              style={[styles.speciesRow, { borderBottomColor: colors.ring }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>
                  {entry.commonName}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, fontStyle: 'italic' }}>
                  {entry.scientificName} · every {entry.intervalDays} days
                </Text>
              </View>
              <SearchIcon size={15} color={colors.muted} />
            </Pressable>
          ))}
          {query.trim().length >= 2 && (species.data?.results ?? []).length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13, paddingVertical: spacing.lg }}>
              No species matched “{query}”.
            </Text>
          ) : null}
          {query.trim().length < 2 ? (
            <Text style={{ color: colors.muted, fontSize: 13, paddingVertical: spacing.lg }}>
              Type at least two letters, or pick one of the curated species above.
            </Text>
          ) : null}
        </ScrollView>
        <TextButton label="Cancel" tone="muted" onPress={() => setSearchOpen(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg, alignItems: 'stretch' },
  iconRow: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  iconCircle: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  question: { fontSize: 24, fontWeight: '800', marginTop: -spacing.md },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.7, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: spacing.sm },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
  },
  matchThumb: { width: 46, height: 46, borderRadius: 12 },
  matchName: { fontSize: 15, fontWeight: '700' },
  matchSub: { fontSize: 11, marginTop: 2 },
  matchPercent: { fontSize: 15, fontWeight: '800' },
  sticky: { padding: spacing.xl, gap: spacing.md, borderTopWidth: 1 },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
});
