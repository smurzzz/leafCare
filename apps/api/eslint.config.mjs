import tseslint from 'typescript-eslint';

/**
 * ESLint for the API. `eslint-config-expo` covers the app and the React Native rules that go
 * with it; the server is plain TypeScript, so the recommended set is enough.
 *
 * `argsIgnorePattern: '^_'` marks parameters that are intentionally unused — the check stays
 * on, but a leading underscore is the documented way to say "accepted, deliberately unused"
 * (for example the `?tab=` on the reminders payload, which returns both segments at once).
 */
export default tseslint.config(
  { ignores: ['.next/**', 'supabase/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
);
