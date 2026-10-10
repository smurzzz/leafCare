/**
 * Forgot password. Reuses the verify-email layout for the reset code, then sets
 * the new password through Clerk's resetPasswordEmailCode API.
 */

import { useSignIn } from '@clerk/expo';
import { palette, spacing } from '@leafcare/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpBoxes, TextField } from '@/components/ui/inputs';
import { Button, ScreenHeader, TextButton } from '@/components/ui/primitives';
import { emailIssue, passwordIssue } from '@/lib/validation';

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const { signIn } = useSignIn();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setError(null);
    const issue = emailIssue(email);
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    await signIn.create({ identifier: email.trim() });
    const result = await signIn.resetPasswordEmailCode.sendCode();
    setBusy(false);
    if (result?.error) {
      setError(result.error.message ?? 'We could not send a reset code.');
      return;
    }
    setStep('code');
  };

  const verifyCode = async (value: string) => {
    setError(null);
    setBusy(true);
    const result = await signIn.resetPasswordEmailCode.verifyCode({ code: value });
    setBusy(false);
    if (result?.error) {
      setError(result.error.message ?? 'That code did not work.');
      return;
    }
    setStep('password');
  };

  const submitPassword = async () => {
    setError(null);
    const issue = passwordIssue(password);
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    const result = await signIn.resetPasswordEmailCode.submitPassword({ password });
    setBusy(false);
    if (result?.error) {
      setError(result.error.message ?? 'We could not update your password.');
      return;
    }
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <ScreenHeader title="Reset password" subtitle="We will email you a 6-digit code" onBack={() => router.back()} />

        {step === 'email' ? (
          <View style={{ gap: spacing.lg }}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Button label="Send reset code" onPress={() => void sendCode()} loading={busy} />
          </View>
        ) : null}

        {step === 'code' ? (
          <View style={{ gap: spacing.lg }}>
            <Text style={styles.body}>
              Enter the 6-digit code we sent to <Text style={styles.strong}>{email}</Text>
            </Text>
            <OtpBoxes value={code} onChange={setCode} onComplete={(value) => void verifyCode(value)} autoFocus />
            <Button label="Continue" onPress={() => void verifyCode(code)} disabled={code.length !== 6} loading={busy} />
            <View style={{ alignItems: 'center' }}>
              <TextButton
                label="Send a new code"
                tone="muted"
                onPress={() => void signIn.resetPasswordEmailCode.sendCode()}
              />
            </View>
          </View>
        ) : null}

        {step === 'password' ? (
          <View style={{ gap: spacing.lg }}>
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secure
              autoComplete="password-new"
            />
            <Button label="Save password" onPress={() => void submitPassword()} loading={busy} />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.xl },
  body: { fontSize: 14, color: palette.muted, lineHeight: 20 },
  strong: { color: palette.ink, fontWeight: '700' },
  error: { color: palette.coralDeep, fontSize: 13, fontWeight: '600' },
});
