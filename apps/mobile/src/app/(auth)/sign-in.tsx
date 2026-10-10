/**
 * 06 — Log in. Hero leaf, forgot password, Google SSO and the sign-up link.
 */

import { useClerk, useSignIn, useSSO } from '@clerk/expo';
import { palette, spacing } from '@leafcare/shared';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleMark } from '@/components/illustrations';
import { TextField } from '@/components/ui/inputs';
import { Button, Card, Divider, TextButton } from '@/components/ui/primitives';
import { emailIssue } from '@/lib/validation';

export default function LogInRoute() {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const { setActive } = useClerk();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = fetchStatus === 'fetching';
  const canSubmit = emailIssue(email) === null && password.length > 0;

  const onLogIn = async () => {
    setError(null);
    const result = await signIn.create({ identifier: email.trim(), password });
    if (result?.error) {
      setError(result.error.message ?? 'Those details did not match an account.');
      return;
    }

    if (signIn.status === 'complete' && signIn.createdSessionId) {
      await setActive({ session: signIn.createdSessionId });
      router.replace('/(tabs)/home');
      return;
    }

    // New device / second factor: Clerk asks for an emailed code.
    if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
      await signIn.mfa.sendEmailCode();
      router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim(), mode: 'signin' } });
      return;
    }

    setError('We could not finish signing you in. Please try again.');
  };

  const onGoogle = async () => {
    setError(null);
    const { createdSessionId, setActive: activate } = await startSSOFlow({
      strategy: 'oauth_google',
      redirectUrl: Linking.createURL('/(tabs)/home'),
    });
    if (createdSessionId && activate) {
      await activate({ session: createdSessionId });
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroGlyph}>🌿</Text>
          </View>

          <View style={{ gap: 6, marginTop: spacing.lg }}>
            <Text style={styles.overline}>Welcome back</Text>
            <Text style={styles.title}>Good to see you again</Text>
          </View>

          <View style={{ gap: spacing.lg }}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secure={!showPassword}
              autoComplete="password"
              textContentType="password"
              trailing={
                <TextButton
                  label={showPassword ? 'Hide' : 'Show'}
                  onPress={() => setShowPassword((value) => !value)}
                  tone="muted"
                />
              }
            />
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <TextButton label="Forgot password?" onPress={() => router.push('/(auth)/forgot-password')} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Log In" onPress={() => void onLogIn()} loading={busy} disabled={!canSubmit} />

          <Divider label="or continue with" />

          <Button
            label="Continue with Google"
            variant="secondary"
            icon={<GoogleMark size={18} />}
            onPress={() => void onGoogle()}
          />

          <Card tone="mint" style={{ gap: 4 }}>
            <Text style={styles.cardTitle}>New to LeafCare?</Text>
            <Text style={styles.cardBody}>
              Photograph a leaf, get the species, and let us schedule the watering.
            </Text>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New here? </Text>
            <TextButton label="Sign up" onPress={() => router.replace('/(auth)/sign-up')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  hero: {
    height: 180,
    borderRadius: 24,
    backgroundColor: palette.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlyph: { fontSize: 72 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: palette.muted, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '800', color: palette.ink, letterSpacing: -0.8 },
  error: { color: palette.coralDeep, fontSize: 13, fontWeight: '600' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: palette.forestDeep },
  cardBody: { fontSize: 12, color: palette.forestDeep, opacity: 0.8, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: palette.muted, fontSize: 13 },
});
