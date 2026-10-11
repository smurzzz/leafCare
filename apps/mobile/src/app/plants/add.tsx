/**
 * 13 — Add plant. Confirms the details from the scan (or accepts a manual add),
 * with photo replace, location chips + custom, last-watered calendar and the
 * recommended-interval badge.
 */

import {
  DEFAULT_LOCATION_KINDS,
  LOCATION_LABELS,
  parseDateKey,
  radius,
  spacing,
  zonedTimeToUtc,
} from '@leafcare/shared';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraIcon, LeafIcon } from '@/components/icons';
import { DatePickerSheet } from '@/components/ui/date-picker-sheet';
import { Stepper, TextField } from '@/components/ui/inputs';
import { Sheet, TipCard } from '@/components/ui/misc';
import { Button, Chip, ScreenHeader, SectionLabel, TextButton } from '@/components/ui/primitives';
import { deviceTimeZone, formatMediumDate, todayDateKey } from '@/lib/format';
import { useCreatePlant } from '@/lib/queries';
import { clearScanSession, getScanSession, selectedSuggestion } from '@/lib/scan-session';
import { nicknameIssue } from '@/lib/validation';
import { useSettings } from '@/theme/settings-provider';

export default function AddPlantRoute() {
  const router = useRouter();
  const { colors } = useSettings();
  const create = useCreatePlant();

  const session = getScanSession();
  const suggestion = selectedSuggestion();
  const timeZone = deviceTimeZone();

  const [photoUri, setPhotoUri] = useState<string | null>(session?.photoUri ?? null);
  const [nickname, setNickname] = useState(suggestion?.commonName?.split(' ')[0] ?? '');
  const [locationKind, setLocationKind] = useState<string>('living_room');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [lastWateredKey, setLastWateredKey] = useState(todayDateKey(timeZone));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [intervalDays, setIntervalDays] = useState(suggestion?.intervalDays ?? 7);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recommended = suggestion?.intervalDays ?? 7;
  const isRecommended = intervalDays === recommended;

  const replacePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]?.uri) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    const issue = nicknameIssue(nickname);
    if (issue) {
      setError(issue);
      return;
    }
    setError(null);

    // Noon local on the chosen day, converted to an instant the API can store.
    const { year, month, day } = parseDateKey(lastWateredKey);
    const lastWateredAt = zonedTimeToUtc(year, month, day, 12, 0, timeZone).toISOString();

    const created = await create.mutateAsync({
      input: {
        nickname: nickname.trim(),
        speciesScientific: suggestion?.scientificName ?? null,
        speciesCommon: suggestion?.commonName ?? null,
        locationKind: (locationKind === 'custom' ? 'custom' : locationKind) as never,
        locationCustom: locationKind === 'custom' ? customLocation.trim() || 'Custom' : null,
        intervalDays,
        lastWateredAt,
        reminderTime: '08:00',
        notes: notes.trim() || null,
        confidence: suggestion && suggestion.score > 0 ? suggestion.score : null,
        light: suggestion?.light ?? null,
        difficulty: suggestion?.difficulty ?? null,
        identificationId: session?.identificationId ?? undefined,
      },
      image: photoUri ? { uri: photoUri } : null,
    });

    clearScanSession();
    router.replace(`/plants/${created.plant.id}`);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title="Add plant"
            subtitle="Confirm the details"
            onBack={() => router.back()}
          />

          <View style={styles.hero}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.heroEmpty]}>
                <Text style={{ fontSize: 40 }}>🌿</Text>
              </View>
            )}
            {suggestion ? (
              <View style={[styles.speciesChip, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
                <LeafIcon size={13} color={colors.forest} />
                <Text style={[styles.speciesChipText, { color: colors.forest }]} numberOfLines={1}>
                  {suggestion.commonName}
                </Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replace photo"
              onPress={() => void replacePhoto()}
              style={[styles.cameraButton, { backgroundColor: colors.forest }]}
            >
              <CameraIcon size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <TextField
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            placeholder="Monty"
            autoCapitalize="sentences"
            icon={<LeafIcon size={16} color={colors.forest} />}
          />

          <View style={{ gap: spacing.md }}>
            <SectionLabel>Location</SectionLabel>
            <View style={styles.chipWrap}>
              {DEFAULT_LOCATION_KINDS.map((kind) => (
                <Chip
                  key={kind}
                  label={LOCATION_LABELS[kind]}
                  selected={locationKind === kind}
                  onPress={() => setLocationKind(kind)}
                />
              ))}
              <Chip
                label={locationKind === 'custom' && customLocation ? customLocation : '+ Custom'}
                selected={locationKind === 'custom'}
                onPress={() => setShowCustomLocation(true)}
              />
            </View>
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionLabel>Last watered</SectionLabel>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDatePickerOpen(true)}
              style={[styles.dateField, { backgroundColor: colors.surface, borderColor: colors.ring }]}
            >
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>
                {formatMediumDate(new Date(`${lastWateredKey}T12:00:00.000Z`), timeZone)}
              </Text>
              <TextButton label="Change" tone="muted" onPress={() => setDatePickerOpen(true)} />
            </Pressable>
          </View>

          <View style={{ gap: spacing.md }}>
            <View style={styles.scheduleHeader}>
              <SectionLabel>Watering schedule</SectionLabel>
              {isRecommended ? (
                <View style={[styles.badge, { backgroundColor: colors.mint }]}>
                  <Text style={[styles.badgeText, { color: colors.forest }]}>Recommended</Text>
                </View>
              ) : (
                <TextButton
                  label={`Use recommended (${recommended})`}
                  tone="muted"
                  onPress={() => setIntervalDays(recommended)}
                />
              )}
            </View>
            <Stepper value={intervalDays} onChange={setIntervalDays} min={1} max={60} suffix="days" />
          </View>

          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything you want to remember"
            autoCapitalize="sentences"
          />

          {suggestion ? (
            <TipCard title="Care tip" body={suggestion.careDetail} />
          ) : (
            <TipCard
              title="No identification yet"
              body="You are adding this plant manually. Scan a leaf any time to fill in the species and care plan."
            />
          )}

          {error ? <Text style={[styles.error, { color: colors.coralDeep }]}>{error}</Text> : null}

          <Button label="Save Plant" onPress={() => void save()} loading={create.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerSheet
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={lastWateredKey}
        onChange={setLastWateredKey}
        timeZone={timeZone}
      />

      <Sheet
        visible={showCustomLocation}
        onClose={() => setShowCustomLocation(false)}
        title="Custom location"
      >
        <TextField
          label="Name"
          value={customLocation}
          onChangeText={setCustomLocation}
          placeholder="Balcony"
          autoCapitalize="sentences"
        />
        <Button
          label="Add location"
          onPress={() => {
            setLocationKind('custom');
            setShowCustomLocation(false);
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },
  hero: { height: 200, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#D8E5DC' },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F4EA' },
  speciesChip: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: '70%',
  },
  speciesChipText: { fontSize: 12, fontWeight: '700' },
  cameraButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  error: { fontSize: 13, fontWeight: '600' },
});
