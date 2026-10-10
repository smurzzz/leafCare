/**
 * 05 — Sign up. Email/password with a live strength meter, Google SSO and the
 * locked legal copy, wired to Clerk Core 3 (`signUp.create` +
 * `signUp.verifications.sendEmailCode`).
 */

import { useSSO, useSignUp } from '@clerk/expo';
import { palette, spacing } from '@leafcare/shared';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleMark, SplashMark } from '@/components/illustrations';
import { PasswordMeter, TextField, scorePassword } from '@/components/ui/inputs';
import { Button, Divider, TextButton } from '@/components/ui/primitives';
import { emailIssue } from '@/lib/validation';

export default function SignUpRoute() {
  const router = useRouter();
  const { signUp, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = fetchStatus === 'fetching';
  const strength = scorePassword(password);
  const canSubmit = fullName.trim().length > 0 && emailIssue(email) === null && password.length >= 8;

  const onSignUp = async () => {
    setError(null);
    const issue = emailIssue(email);
    if (issue) {
      setError(issue);
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const result = await signUp.create({
      emailAddress: email.trim(),
      password,
      firstName: firstName ?? undefined,
      lastName: rest.join(' ') || undefined,
    });
    if (result?.error) {
      setError(result.error.message ?? 'We could not create your account.');
      return;
    }

    const sent = await signUp.verifications.sendEmailCode();
    if (sent?.error) {
      setError(sent.error.message ?? 'We could not send the verification code.');
      return;
    }
    router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
  };

  const onGoogle = async () => {
    setError(null);
    const { createdSessionId, setActive } = await startSSOFlow({
      strategy: 'oauth_google',
      redirectUrl: Linking.createURL('/(tabs)/home'),
    });
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <SplashMark size={54} />
            <Text style={styles.brand}>LeafCare</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start identifying plants and never miss a watering day.</Text>
          </View>

          <View style={{ gap: spacing.lg }}>
            <TextField
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Alex Morgan"
              autoCapitalize="words"
              autoComplete="name"
            />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <View style={{ gap: spacing.md }}>
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secure={!showPassword}
                autoComplete="password-new"
                textContentType="newPassword"
                trailing={
                  <TextButton
                    label={showPassword ? 'Hide' : 'Show'}
                    onPress={() => setShowPassword((value) => !value)}
                    tone="muted"
                  />
                }
              />
              {password.length > 0 ? <PasswordMeter password={password} /> : null}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="Sign Up"
            onPress={() => void onSignUp()}
            loading={busy}
            disabled={!canSubmit}
          />
          <Text style={styles.hint}>Password strength: {strength.label}</Text>

          <Divider label="or continue with" />

          <Button
            label="Continue with Google"
            variant="secondary"
            icon={<GoogleMark size={18} />}
            onPress={() => void onGoogle()}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TextButton label="Log in" onPress={() => router.replace('/(auth)/sign-in')} />
          </View>

          <Text style={styles.fineprint}>
            By signing up you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { fontSize: 20, fontWeight: '800', color: palette.forest, letterSpacing: -0.4 },
  title: { fontSize: 28, fontWeight: '800', color: palette.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 14, color: palette.muted, lineHeight: 20 },
  error: { color: palette.coralDeep, fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 11, color: palette.muted, textAlign: 'center', marginTop: -spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: palette.muted, fontSize: 13 },
  fineprint: { fontSize: 11, color: palette.muted, textAlign: 'center', lineHeight: 16 },
});
