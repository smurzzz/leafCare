/**
 * Expo public config (src/lib/config.ts).
 *
 * `releaseConfigIssue()` is the check that stops a *built* app from starting with
 * a configuration that can only work on a developer's machine — the failure mode
 * where every request goes to the phone itself and the user sees empty screens.
 * It is exercised here for the exact values an EAS build has to carry.
 *
 * `config` reads `process.env` once at import time, so each case resets the module
 * registry and evaluates it again with its own environment.
 */

type ConfigModule = typeof import('../config');

const ENV_KEYS = [
  'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_APP_VERSION',
  'EXPO_PUBLIC_PROJECT_ID',
  'EXPO_PUBLIC_SUPABASE_URL',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const savedEnv = { ...process.env };

const loadConfig = (env: Partial<Record<EnvKey, string>>): ConfigModule => {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  jest.resetModules();
  // A dynamic `import()` here would need --experimental-vm-modules; requireActual
  // re-evaluates the module after resetModules and takes the type argument.
  return jest.requireActual<ConfigModule>('../config');
};

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('releaseConfigIssue', () => {
  it('is happy with the values an EAS build carries', () => {
    const { isClerkConfigured, releaseConfigIssue } = loadConfig({
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
      EXPO_PUBLIC_API_BASE_URL: 'http://192.168.100.133:3000',
    });

    expect(isClerkConfigured()).toBe(true);
    expect(releaseConfigIssue()).toBeNull();
  });

  it('reports a missing Clerk key', () => {
    const { isClerkConfigured, releaseConfigIssue } = loadConfig({
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example',
    });

    expect(isClerkConfigured()).toBe(false);
    expect(releaseConfigIssue()).toContain('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  });

  it('reports a blank Clerk key as missing', () => {
    const { isClerkConfigured } = loadConfig({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: '   ' });

    expect(isClerkConfigured()).toBe(false);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000'])(
    'rejects the loopback API url %s, which on a phone is the phone itself',
    (url) => {
      const { releaseConfigIssue } = loadConfig({
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
        EXPO_PUBLIC_API_BASE_URL: url,
      });

      expect(releaseConfigIssue()).toContain(url);
    },
  );

  it('names the Clerk key first, so the message points at the root cause', () => {
    const { releaseConfigIssue } = loadConfig({});

    expect(releaseConfigIssue()).toContain('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  });
});

describe('config values', () => {
  it('strips trailing slashes from the API base url', () => {
    const { config } = loadConfig({ EXPO_PUBLIC_API_BASE_URL: 'https://api.leafcare.app//' });

    expect(config.apiBaseUrl).toBe('https://api.leafcare.app');
  });

  it('falls back to sensible defaults when nothing is set', () => {
    const module = loadConfig({});

    expect(module.config.apiBaseUrl).toBe('http://localhost:3000');
    expect(module.config.supportEmail).toBe('support@leafcare.app');
    expect(module.config.clerkPublishableKey).toBe('');
    expect(module.config.appVersion).toMatch(/^\S+$/);
    expect(module.versionLabel()).toMatch(/\(\d+\)$/);
  });

  it('uses the configured support email', () => {
    const { config } = loadConfig({ EXPO_PUBLIC_SUPPORT_EMAIL: 'help@leafcare.app' });

    expect(config.supportEmail).toBe('help@leafcare.app');
  });
});
