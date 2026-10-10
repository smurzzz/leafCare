/**
 * Form controls (docs/ui-ux.md). Text fields use the uppercase label + leading
 * icon treatment from the sign-up and add-plant screens.
 */

import { radius, spacing } from '@leafcare/shared';
import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/settings-provider';

import { BackChevron, styles as primitiveStyles } from './primitives';

type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  secure?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  maxLength?: number;
  error?: string | null;
  editable?: boolean;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onBlur?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
};

export const TextField = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  maxLength,
  error,
  editable = true,
  trailing,
  style,
  onBlur,
  returnKeyType,
  onSubmitEditing,
}: TextFieldProps) => {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={[inputStyles.label, { color: colors.muted }]}>{label}</Text> : null}
      <View
        style={[
          inputStyles.field,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.coral : colors.ring,
            opacity: editable ? 1 : 0.6,
          },
        ]}
      >
        {icon ? <View style={inputStyles.icon}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          maxLength={maxLength}
          editable={editable}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={colors.forest}
          style={[inputStyles.input, { color: colors.ink }]}
        />
        {trailing}
      </View>
      {error ? <Text style={[inputStyles.error, { color: colors.coralDeep }]}>{error}</Text> : null}
    </View>
  );
};

export const SwitchRow = ({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={inputStyles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[inputStyles.switchTitle, { color: colors.ink }]}>{title}</Text>
        {description ? (
          <Text style={[inputStyles.switchDescription, { color: colors.muted }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.ring, true: colors.forest }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
};

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  return (
    <View style={[inputStyles.segmented, { backgroundColor: colors.surfaceAlt }, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              inputStyles.segment,
              selected && { backgroundColor: colors.surface, borderColor: colors.ring },
            ]}
          >
            <Text
              style={[
                inputStyles.segmentLabel,
                { color: selected ? colors.forest : colors.muted, fontWeight: selected ? '700' : '600' },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const Stepper = ({
  value,
  onChange,
  min = 1,
  max = 60,
  suffix,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  size?: 'md' | 'lg';
}) => {
  const { colors } = useTheme();
  const big = size === 'lg';
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };
  return (
    <View style={inputStyles.stepperRow}>
      <StepButton label="−" onPress={() => step(-1)} disabled={value <= min} big={big} />
      <View style={{ alignItems: 'center', minWidth: big ? 110 : 84 }}>
        <Text style={[inputStyles.stepperValue, { color: colors.ink, fontSize: big ? 26 : 18 }]}>
          {value}
          {suffix ? ` ${suffix}` : ''}
        </Text>
      </View>
      <StepButton label="+" onPress={() => step(1)} disabled={value >= max} big={big} />
    </View>
  );
};

const StepButton = ({
  label,
  onPress,
  disabled,
  big,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  big?: boolean;
}) => {
  const { colors } = useTheme();
  const size = big ? 56 : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase' : 'Decrease'}
      onPress={disabled ? undefined : onPress}
      style={[
        inputStyles.stepButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface,
          borderColor: colors.ring,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[inputStyles.stepLabel, { color: colors.forest, fontSize: big ? 26 : 20 }]}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Six boxes, auto-advance, paste a full code in one go (screen 07). */
export const OtpBoxes = ({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}) => {
  const { colors } = useTheme();
  const inputs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const commit = (next: string) => {
    const cleaned = next.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) onComplete?.(cleaned);
  };

  return (
    <View style={inputStyles.otpRow}>
      {digits.map((digit, index) => {
        const isActive = index === Math.min(value.length, length - 1) && value.length < length;
        return (
          <TextInput
            key={index}
            ref={(ref) => {
              inputs.current[index] = ref;
            }}
            value={digit.trim()}
            onChangeText={(text) => {
              if (text.length > 1) {
                commit(text);
                inputs.current[length - 1]?.focus();
                return;
              }
              const characters = value.split('');
              characters[index] = text;
              commit(characters.join(''));
              if (text && index < length - 1) inputs.current[index + 1]?.focus();
              if (!text && index > 0) inputs.current[index - 1]?.focus();
            }}
            keyboardType="number-pad"
            maxLength={length}
            autoFocus={autoFocus && index === 0}
            accessibilityLabel={`Digit ${index + 1} of ${length}`}
            selectionColor={colors.forest}
            style={[
              inputStyles.otpBox,
              {
                backgroundColor: colors.surface,
                borderColor: isActive ? colors.forest : colors.ring,
                borderWidth: isActive ? 2 : 1,
                color: colors.ink,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

/** Weak / Fair / Good — three segments, per the sign-up PNG. */
export const PasswordMeter = ({ password }: { password: string }) => {
  const { colors } = useTheme();
  const strength = scorePassword(password);
  const filled = strength.score;
  const tone = strength.label === 'Good' ? colors.forest : strength.label === 'Fair' ? colors.water : colors.coral;

  return (
    <View style={{ gap: 6 }}>
      <View style={inputStyles.meterRow}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              inputStyles.meterSegment,
              { backgroundColor: index < filled ? tone : colors.ring },
            ]}
          />
        ))}
        <Text style={[inputStyles.meterLabel, { color: tone }]}>{strength.label}</Text>
      </View>
      <Text style={[inputStyles.hint, { color: colors.muted }]}>
        {strength.hint}
      </Text>
    </View>
  );
};

export const scorePassword = (password: string): { score: number; label: 'Weak' | 'Fair' | 'Good'; hint: string } => {
  if (password.length === 0) {
    return { score: 0, label: 'Weak', hint: 'Use at least 8 characters.' };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { score: Math.max(1, score), label: 'Weak', hint: 'Add a number or a symbol.' };
  }
  if (score === 2) return { score: 2, label: 'Fair', hint: 'Add a capital letter to make it Good.' };
  return { score: 3, label: 'Good', hint: 'Nice — that is a strong password.' };
};

export const SearchField = ({
  value,
  onChangeText,
  placeholder = 'Search plants',
  onSubmit,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        inputStyles.field,
        { backgroundColor: colors.surface, borderColor: colors.ring },
      ]}
    >
      <View style={inputStyles.icon}>
        <SearchGlyph color={colors.muted} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        selectionColor={colors.forest}
        style={[inputStyles.input, { color: colors.ink }]}
      />
      {value.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')}>
          <Text style={{ color: colors.muted, fontSize: 16, paddingHorizontal: 6 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export const SearchGlyph = ({ color }: { color: string }) => (
  <View
    style={{
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: color,
    }}
  >
    <View
      style={{
        position: 'absolute',
        width: 2,
        height: 5,
        backgroundColor: color,
        right: -2,
        bottom: -3,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);

export const ChevronRight = ({ color }: { color: string }) => (
  <View style={{ transform: [{ rotate: '180deg' }] }}>
    <BackChevron color={color} size={14} />
  </View>
);

export const inputStyles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 54,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  icon: { width: 20, alignItems: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  error: { fontSize: 12, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  switchTitle: { fontSize: 15, fontWeight: '700' },
  switchDescription: { fontSize: 12, lineHeight: 17 },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentLabel: { fontSize: 13 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  stepButton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepLabel: { fontWeight: '500' },
  stepperValue: { fontWeight: '800', letterSpacing: -0.5 },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: radius.input,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meterSegment: { flex: 1, height: 5, borderRadius: 3 },
  meterLabel: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  hint: { fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontSize: 13, fontWeight: '700' },
});

export const styles = primitiveStyles;
