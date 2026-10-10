/**
 * Core primitives shared by every screen (docs/ui-ux.md "Components to build").
 */

import { radius, shadows, spacing } from '@leafcare/shared';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/settings-provider';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
  testID,
}: ButtonProps) => {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const background: Record<ButtonVariant, string> = {
    primary: colors.forest,
    secondary: colors.surface,
    danger: colors.coral,
    ghost: 'transparent',
  };
  const border: Record<ButtonVariant, string> = {
    primary: colors.forest,
    secondary: colors.forest,
    danger: colors.coral,
    ghost: 'transparent',
  };
  const labelColor: Record<ButtonVariant, string> = {
    primary: '#FFFFFF',
    secondary: colors.forest,
    danger: '#FFFFFF',
    ghost: colors.forest,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      testID={testID}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        {
          backgroundColor: background[variant],
          borderColor: border[variant],
          opacity: isDisabled ? 0.55 : pressed ? 0.88 : 1,
        },
        variant !== 'ghost' && shadows.soft,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.forest} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonLabel, { color: labelColor[variant] }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

export const TextButton = ({
  label,
  onPress,
  tone = 'forest',
  style,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'forest' | 'muted' | 'coral';
  style?: StyleProp<TextStyle>;
}) => {
  const { colors } = useTheme();
  const color = tone === 'muted' ? colors.muted : tone === 'coral' ? colors.coralDeep : colors.forest;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={[styles.textButton, { color }, style]}>{label}</Text>
    </Pressable>
  );
};

export const Screen = ({
  children,
  scroll = false,
  style,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) => {
  const { colors } = useTheme();
  const content = (
    <View style={[padded && { paddingHorizontal: spacing.xl }, style]}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
};

export const Card = ({
  children,
  style,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'mint' | 'coral' | 'outline';
}) => {
  const { colors } = useTheme();
  const background: Record<string, string> = {
    surface: colors.surface,
    mint: colors.mint,
    coral: colors.coralSoft,
    outline: 'transparent',
  };
  const border = tone === 'coral' ? colors.coral : tone === 'mint' ? 'transparent' : colors.ring;
  return (
    <View style={[styles.card, { backgroundColor: background[tone], borderColor: border }, style]}>
      {children}
    </View>
  );
};

export const IconWell = ({
  children,
  size = 40,
  tone = 'mint',
  style,
}: {
  children: ReactNode;
  size?: number;
  tone?: 'mint' | 'coral' | 'water' | 'forest';
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  const background: Record<string, string> = {
    mint: colors.mintIcon,
    coral: colors.coralSoft,
    water: colors.waterSoft,
    forest: colors.forest,
  };
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background[tone] },
        styles.center,
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const IconButton = ({
  children,
  onPress,
  variant = 'surface',
  size = 44,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'surface' | 'glass' | 'mint';
  size?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  const background =
    variant === 'surface' ? colors.surface : variant === 'mint' ? colors.mint : 'rgba(255,255,255,0.18)';
  const border = variant === 'glass' ? 'rgba(255,255,255,0.3)' : colors.ring;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderColor: border,
          borderWidth: variant === 'mint' ? 0 : 1,
          opacity: pressed ? 0.85 : 1,
        },
        variant === 'surface' && shadows.soft,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

export const Chip = ({
  label,
  selected,
  onPress,
  tone = 'neutral',
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'water' | 'coral' | 'streak';
  icon?: ReactNode;
}) => {
  const { colors } = useTheme();
  const toneColor: Record<string, { text: string; border: string; background: string }> = {
    neutral: { text: colors.ink, border: colors.ring, background: colors.surface },
    water: { text: colors.waterDeep, border: colors.water, background: colors.waterSoft },
    coral: { text: colors.coralDeep, border: colors.coral, background: colors.coralSoft },
    streak: { text: colors.streak, border: colors.ring, background: colors.surface },
  };
  const palette = toneColor[tone]!;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.forest : palette.background,
          borderColor: selected ? colors.forest : palette.border,
        },
      ]}
    >
      {icon}
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? '#FFFFFF' : palette.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const SectionHeading = ({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.rowBetween, style]}>
      <Text style={[styles.sectionTitle, { color: colors.ink }]}>{title}</Text>
      {action ? <TextButton label={action} onPress={onAction} style={styles.sectionAction} /> : null}
    </View>
  );
};

export const SectionLabel = ({ children }: { children: string }) => {
  const { colors } = useTheme();
  return <Text style={[styles.sectionLabel, { color: colors.muted }]}>{children}</Text>;
};

export const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  right,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton accessibilityLabel="Go back" onPress={onBack} size={44}>
          <BackChevron color={colors.ink} />
        </IconButton>
      ) : null}
      <View style={styles.headerTitles}>
        {title ? <Text style={[styles.headerTitle, { color: colors.ink }]}>{title}</Text> : null}
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
};

export const Divider = ({ label }: { label?: string }) => {
  const { colors } = useTheme();
  if (!label) return <View style={[styles.divider, { backgroundColor: colors.ring }]} />;
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.divider, { backgroundColor: colors.ring }]} />
      <Text style={[styles.dividerLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.divider, { backgroundColor: colors.ring }]} />
    </View>
  );
};

export const BodyText = ({
  children,
  muted,
  style,
  center,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  center?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        styles.body,
        { color: muted ? colors.muted : colors.ink, textAlign: center ? 'center' : 'left' },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const TitleText = ({
  children,
  style,
  center,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  center?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.title, { color: colors.ink, textAlign: center ? 'center' : 'left' }, style]}
    >
      {children}
    </Text>
  );
};

/** Initials avatar with an optional remote image; used in the header + profile. */
export const Avatar = ({
  uri,
  name,
  size = 44,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) => {
  const { colors } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || 'A';
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.mint,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: colors.surface,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text style={{ color: colors.forest, fontWeight: '800', fontSize: size * 0.38 }}>
          {initial}
        </Text>
      )}
    </View>
  );
};

export const statusToneFor = (
  colors: ThemeColors,
  status: 'overdue' | 'due_today' | 'upcoming',
) => {
  if (status === 'overdue') return { text: colors.coralDeep, border: colors.coral, background: colors.coralSoft };
  if (status === 'due_today') return { text: colors.waterDeep, border: colors.water, background: colors.waterSoft };
  return { text: colors.muted, border: colors.ring, background: colors.surface };
};

export const BackChevron = ({ color, size = 20 }: { color: string; size?: number }) => {
  // Drawn with two borders so the icon needs no asset or SVG dependency.
  return (
    <View
      style={{
        width: size * 0.6,
        height: size * 0.6,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginLeft: 3,
      }}
    />
  );
};

export const Circle = ({
  size,
  color,
  children,
}: {
  size: number;
  color: string;
  children?: ReactNode;
}) => (
  <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
    {children}
  </View>
);

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  center: { alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  button: {
    minHeight: 54,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  buttonSm: { minHeight: 44, borderRadius: radius.pill },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  textButton: { fontSize: 13, fontWeight: '700' },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionAction: { paddingBottom: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitles: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  divider: { flex: 1, height: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  dividerLabel: { fontSize: 12, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34 },
});
