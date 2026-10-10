/**
 * 07 — Verify email. Six boxes, auto-advance, paste support, a resend cooldown
 * and the locked copy, wired to Clerk's email_code verification.
 */

import { useClerk, useSignUp } from '@clerk/expo';
import { formatCountdown, palette, spacing } from '@leafcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpBoxes } from '@/components/ui/inputs';
import { Button, IconButton, ScreenHeader, TextButton } from '@/components/ui/primitives';
import { CloseIcon } from '@/components/icons';

const RESEND_SECONDS = 30;

export default function VerifyEmailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { signUp } = useSignUp();
  const { setActive } = useClerk();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  const email = params.email ?? 'your email';

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const verify = async (value: string) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);

    const result = await signUp.verifications.verifyEmailCode({ code: value });
    if (result?.error) {
      setError(result.error.message ?? 'That code did not work. Try again.');
      setVerifying(false);
      setCode('');
      return;
    }

    if (signUp.status === 'complete' && signUp.createdSessionId) {
      await setActive({ session: signUp.createdSessionId });
      router.replace('/(tabs)/home');
      return;
    }

    setError('Your account still needs another step. Please try signing in.');
    setVerifying(false);
  };

  const resend = async () => {
    setError(null);
    const result = await signUp.verifications.sendEmailCode();
    if (result?.error) {
      setError(result.error.message ?? 'We could not resend the code.');
      return;
    }
    setSeconds(RESEND_SECONDS);
    setCode('');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <ScreenHeader
          onBack={() => router.back()}
          right={
            <IconButton
              accessibilityLabel="Close"
              onPress={() => router.replace('/(auth)/sign-in')}
              size={40}
              variant="mint"
            >
              <CloseIcon size={16} color={palette.forest} />
            </IconButton>
          }
        />

        <View style={styles.badge}>
          <Text style={styles.badgeGlyph}>✉️</Text>
          <View style={styles.badgeCheck}>
            <Text style={styles.badgeCheckGlyph}>✓</Text>
          </View>
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          Enter the 6-digit code we sent to <Text style={styles.strong}>{email}</Text>
        </Text>

        <OtpBoxes
          value={code}
          onChange={setCode}
          onComplete={(value) => void verify(value)}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.resendRow}>
          {seconds > 0 ? (
            <Text style={styles.resendMuted}>Resend code in {formatCountdown(seconds)}</Text>
          ) : (
            <TextButton label="Resend code" onPress={() => void resend()} />
          )}
        </View>

        <Text style={styles.help}>
          Wrong address?{' '}
          <Text style={styles.helpLink} onPress={() => router.back()}>
            Go back and edit your email.
          </Text>
        </Text>

        <View style={{ flex: 1 }} />

        <Button
          label="Verify"
          onPress={() => void verify(code)}
          disabled={code.length !== 6}
          loading={verifying}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  badge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: palette.mint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
  badgeGlyph: { fontSize: 38 },
  badgeCheck: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCheckGlyph: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', color: palette.ink, textAlign: 'center', letterSpacing: -0.6 },
  body: { fontSize: 14, color: palette.muted, textAlign: 'center', lineHeight: 20 },
  strong: { color: palette.ink, fontWeight: '700' },
  error: { color: palette.coralDeep, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  resendRow: { alignItems: 'center' },
  resendMuted: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  help: { textAlign: 'center', color: palette.muted, fontSize: 12 },
  helpLink: { color: palette.forest, fontWeight: '700' },
});
