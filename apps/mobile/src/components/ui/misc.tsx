/**
 * Composite LeafCare components: watering ring, plant photo/card/row, status
 * pill, water action, bottom sheet and achievement chip.
 */

import { radius, shadows, spacing, type PlantSummary } from '@leafcare/shared';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/settings-provider';

import { Avatar, Chip, IconWell, TextButton, statusToneFor } from './primitives';

export { Avatar };

/* --------------------------------------------------------- progress ring */

export const ProgressRing = ({
  value,
  size = 70,
  thickness = 8,
  color,
  track,
  children,
  caption,
}: {
  /** 0–1 */
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  caption?: string;
}) => {
  const { colors } = useTheme();
  const stroke = color ?? colors.forest;
  const trackColor = track ?? colors.ring;
  const clamped = Math.max(0, Math.min(1, value));
  const radiusValue = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radiusValue;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke={stroke}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {children ?? (
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '800' }}>{caption}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

/* ----------------------------------------------------------- plant photo */

export const PlantPhoto = ({
  uri,
  nickname,
  size,
  radiusValue = radius.card,
  style,
}: {
  uri?: string | null;
  nickname: string;
  size?: number;
  radiusValue?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  const dimension = size ? { width: size, height: size } : undefined;
  return (
    <View
      style={[
        {
          backgroundColor: colors.mint,
          borderRadius: radiusValue,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        dimension,
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={180}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={nickname}
        />
      ) : (
        <Text style={{ fontSize: size ? size * 0.34 : 28 }}>🌿</Text>
      )}
    </View>
  );
};

/* ---------------------------------------------------------- status pieces */

export const StatusPill = ({ plant }: { plant: PlantSummary }) => {
  const { colors } = useTheme();
  const tone = statusToneFor(colors, plant.status);
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone.border,
        backgroundColor: tone.background,
      }}
    >
      <Text style={{ color: tone.text, fontSize: 11, fontWeight: '700' }}>{plant.statusLabel}</Text>
    </View>
  );
};

export const WaterButton = ({
  onPress,
  disabled,
  label,
  size = 40,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  size?: number;
}) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={disabled ? undefined : onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: disabled ? colors.surfaceAlt : colors.forest,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.42 }}>{disabled ? '✓' : '💧'}</Text>
    </Pressable>
  );
};

/* ------------------------------------------------------------ plant cards */

export const PlantCard = ({
  plant,
  onPress,
  width,
}: {
  plant: PlantSummary;
  onPress: () => void;
  width: number;
}) => {
  const { colors } = useTheme();
  const overdue = plant.status === 'overdue';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plant.nickname}, ${plant.statusLabel}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.plantCard,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: overdue ? colors.coral : colors.ring,
          borderWidth: overdue ? 2 : 1,
          opacity: pressed ? 0.92 : 1,
        },
        shadows.soft,
      ]}
    >
      <PlantPhoto uri={plant.photoUrl} nickname={plant.nickname} style={styles.plantCardPhoto} radiusValue={radius.input} />
      <Text style={[styles.plantCardName, { color: colors.ink }]} numberOfLines={1}>
        {plant.nickname}
      </Text>
      <Text style={[styles.plantCardSpecies, { color: colors.muted }]} numberOfLines={1}>
        {plant.speciesCommon ?? plant.speciesScientific ?? plant.locationLabel}
      </Text>
      <View style={{ marginTop: 'auto' }}>
        <StatusPill plant={plant} />
      </View>
    </Pressable>
  );
};

export const CareRow = ({
  plant,
  onPress,
  onWater,
  watering,
  subtitle,
}: {
  plant: PlantSummary;
  onPress?: () => void;
  onWater?: () => void;
  watering?: boolean;
  subtitle?: string;
}) => {
  const { colors } = useTheme();
  const overdue = plant.status === 'overdue';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plant.nickname}, ${plant.statusLabel}`}
      onPress={onPress}
      style={[
        styles.careRow,
        {
          backgroundColor: colors.surface,
          borderColor: overdue ? colors.coral : colors.ring,
        },
        shadows.soft,
      ]}
    >
      <PlantPhoto uri={plant.photoUrl} nickname={plant.nickname} size={52} radiusValue={16} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.careRowName, { color: colors.ink }]} numberOfLines={1}>
          {plant.nickname}
        </Text>
        <Text style={[styles.careRowSub, { color: colors.muted }]} numberOfLines={1}>
          {subtitle ?? plant.speciesCommon ?? plant.speciesScientific ?? plant.locationLabel}
        </Text>
      </View>
      <StatusPill plant={plant} />
      {onWater ? (
        <WaterButton
          label={`Mark ${plant.nickname} as watered`}
          onPress={onWater}
          disabled={watering}
        />
      ) : null}
    </Pressable>
  );
};

export const StatBlock = ({ value, label }: { value: string; label: string }) => {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
};

export const AchievementChip = ({
  title,
  unlocked,
  hint,
}: {
  title: string;
  unlocked: boolean;
  hint?: string;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.achievement,
        {
          backgroundColor: unlocked ? colors.mint : colors.surface,
          borderColor: colors.ring,
          opacity: unlocked ? 1 : 0.75,
        },
      ]}
    >
      <IconWell size={34} tone={unlocked ? 'mint' : 'coral'}>
        <Text style={{ fontSize: 15 }}>{unlocked ? '🌱' : '🔒'}</Text>
      </IconWell>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{unlocked ? hint ?? 'Unlocked' : 'Locked'}</Text>
      </View>
    </View>
  );
};

/* ------------------------------------------------------------------ sheet */

export const Sheet = ({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close sheet" />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={[styles.grabber, { backgroundColor: colors.ring }]} />
        {title ? <Text style={[styles.sheetTitle, { color: colors.ink }]}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
};

export const SheetRow = ({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.sheetRow, { borderBottomColor: colors.ring }]}
    >
      <Text style={{ color: destructive ? colors.coralDeep : colors.ink, fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>{value ?? '›'}</Text>
    </Pressable>
  );
};

export const Tabs = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabsRow, { borderBottomColor: colors.ring }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.tab,
              selected && { borderBottomColor: colors.forest, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={{
                color: selected ? colors.forest : colors.muted,
                fontWeight: selected ? '800' : '600',
                fontSize: 14,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const ProgressBar = ({ value, color }: { value: number; color?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.ring, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`,
          height: '100%',
          borderRadius: 3,
          backgroundColor: color ?? colors.forest,
        }}
      />
    </View>
  );
};

export const TipCard = ({ title, body }: { title: string; body: string }) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.mint,
        borderRadius: radius.card,
        padding: spacing.lg,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.forestDeep, fontSize: 13, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: colors.forestDeep, fontSize: 12, lineHeight: 18, opacity: 0.8 }}>{body}</Text>
    </View>
  );
};

export { Chip, TextButton };

const styles = StyleSheet.create({
  plantCard: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 4,
    minHeight: 200,
  },
  plantCardPhoto: { width: '100%', height: 108, marginBottom: spacing.sm },
  plantCardName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  plantCardSpecies: { fontSize: 12 },
  careRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  careRowName: { fontSize: 15, fontWeight: '800' },
  careRowSub: { fontSize: 12, marginTop: 2 },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    minWidth: 190,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15,35,26,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  tabsRow: { flexDirection: 'row', gap: spacing.xxl, borderBottomWidth: 1 },
  tab: { paddingBottom: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
});
