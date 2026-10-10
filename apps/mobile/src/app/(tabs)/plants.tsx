/**
 * 14 — My Plants. Count badge, search, intersecting filter chips, a two-column
 * grid with the coral overdue treatment, and the green + FAB.
 */

import { DEFAULT_LOCATION_KINDS, LOCATION_LABELS, spacing, type PlantSummary } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { SleepingPlantArt } from '@/components/illustrations';
import { CardGridSkeleton, ErrorState } from '@/components/ui/feedback';
import { SearchField } from '@/components/ui/inputs';
import { PlantCard } from '@/components/ui/misc';
import { Button, Chip, IconButton, SectionHeading } from '@/components/ui/primitives';
import { usePlants } from '@/lib/queries';
import { useSettings } from '@/theme/settings-provider';

/** A filter is a predicate so custom locations and rooms share one code path. */
type Filter = { key: string; label: string; matches: (plant: PlantSummary) => boolean };

export default function MyPlantsRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterKey, setFilterKey] = useState('all');

  const plants = usePlants();
  const all = plants.data?.plants ?? [];

  const cardWidth = (width - spacing.xl * 2 - spacing.md) / 2;

  const filters = useMemo<Filter[]>(() => {
    const rooms = DEFAULT_LOCATION_KINDS.filter((kind) =>
      all.some((plant) => plant.locationKind === kind),
    ).map((kind) => ({
      key: kind,
      label: LOCATION_LABELS[kind],
      matches: (plant: PlantSummary) => plant.locationKind === kind,
    }));

    const customLabels = [
      ...new Set(
        all
          .filter((plant) => plant.locationKind === 'custom' && plant.locationCustom)
          .map((plant) => plant.locationCustom as string),
      ),
    ].map((label) => ({
      key: `custom:${label}`,
      label,
      matches: (plant: PlantSummary) =>
        plant.locationKind === 'custom' && plant.locationCustom === label,
    }));

    return [
      { key: 'all', label: 'All', matches: () => true },
      {
        key: 'due_today',
        label: 'Due today',
        matches: (plant: PlantSummary) => plant.status !== 'upcoming',
      },
      ...rooms,
      ...customLabels,
    ];
  }, [all]);

  const active = filters.find((entry) => entry.key === filterKey) ?? filters[0]!;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all.filter((plant) => {
      if (!active.matches(plant)) return false;
      if (!needle) return true;
      return (
        plant.nickname.toLowerCase().includes(needle) ||
        (plant.speciesCommon ?? '').toLowerCase().includes(needle) ||
        (plant.speciesScientific ?? '').toLowerCase().includes(needle) ||
        plant.locationLabel.toLowerCase().includes(needle)
      );
    });
  }, [all, active, query]);

  const body = () => {
    if (plants.isLoading) return <CardGridSkeleton />;
    if (plants.isError && all.length === 0) {
      return <ErrorState onRetry={() => void plants.refetch()} />;
    }
    if (all.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <SleepingPlantArt size={150} />
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>No plants yet</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Add a plant and LeafCare will build a watering schedule and remind you right on time.
          </Text>
          <Button label="Add a plant" onPress={() => router.push('/scan')} />
        </View>
      );
    }
    if (visible.length === 0) {
      return (
        <Text style={[styles.emptyBody, { color: colors.muted, marginTop: spacing.xxl }]}>
          No plants match this filter.
        </Text>
      );
    }
    return (
      <View style={styles.grid}>
        {visible.map((plant) => (
          <PlantCard
            key={plant.id}
            plant={plant}
            width={cardWidth}
            onPress={() => router.push(`/plants/${plant.id}`)}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.ink }]}>My Plants</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.forest }]}>
            <Text style={styles.countBadgeText}>{all.length}</Text>
          </View>
        </View>
        <IconButton
          accessibilityLabel={searchOpen ? 'Close search' : 'Search plants'}
          onPress={() => {
            setSearchOpen((value) => !value);
            if (searchOpen) setQuery('');
          }}
        >
          {searchOpen ? (
            <CloseIcon size={16} color={colors.ink} />
          ) : (
            <SearchIcon size={18} color={colors.ink} />
          )}
        </IconButton>
      </View>

      {searchOpen ? (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search by name or room" />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {filters.map((entry) => (
          <Chip
            key={entry.key}
            label={entry.label}
            selected={entry.key === active.key}
            onPress={() => setFilterKey(entry.key)}
          />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeading
          title={`${visible.length} ${visible.length === 1 ? 'plant' : 'plants'}`}
          action={query.length > 0 ? 'Clear search' : undefined}
          onAction={() => setQuery('')}
        />
        {body()}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a plant"
        onPress={() => router.push('/scan')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.forest, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <PlusIcon size={26} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  chipsScroll: { flexGrow: 0 },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl + 90, gap: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  emptyWrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  emptyTitle: { fontSize: 22, fontWeight: '800' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxxl + 62,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
