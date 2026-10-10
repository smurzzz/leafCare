/**
 * Jest for the Expo app.
 *
 * `jest-expo` supplies the React Native transform, the native module mocks and
 * the asset stubbers, so no hand-written `transformIgnorePatterns` is needed.
 * Run it from this folder (`npm test`), which is what the workspace script does.
 *
 * Two projects, iOS and Android, so every suite runs on both. That matters more
 * than it sounds: `Platform.OS` branches (the Android notification channel, the
 * reminder permission flow) would otherwise only ever be exercised on whichever
 * platform the runner happened to pick, and a bug on the other one would reach the
 * store. Both projects start from the same preset and only differ in the default
 * platform the Resolver picks, which is what jest-expo's own per-platform presets
 * do — without them, a suite run on iOS never sees Android's code paths.
 *
 * Coverage is reported for the logic we can unit test — the pure modules under
 * `src/lib` and the theme provider. Screens are verified by hand against the
 * PNGs; a shallow render of them would only assert that they render.
 */

// The single-platform preset: transform, babel options, mocks and asset stubs.
const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
const shared = {
  rootDir: __dirname,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // `@/…` is the Metro alias from tsconfig.json; Jest needs telling separately.
  //
  // React is pinned to *this* app's copy. The monorepo hoists a different React
  // for the API workspace, and two copies in one test run means the renderer and
  // the component under test hold different dispatchers — every hook then fails
  // with "Cannot read properties of null (reading 'useState')". Metro resolves
  // React the same way, from the app folder, so testing this copy is also the
  // faithful choice.
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  // Mock call history is per test; the in-memory store is cleared in the tests
  // that care, via `asyncStorageControl.reset()`.
  clearMocks: true,
  collectCoverageFrom: ['src/lib/**/*.ts', 'src/theme/**/*.{ts,tsx}', '!src/**/__tests__/**'],
};

/** @type {(platform: 'ios' | 'android', label: string) => import('jest').Config} */
const forPlatform = (platform, label) => ({
  ...expoPreset,
  ...shared,
  displayName: label,
  haste: {
    ...expoPreset.haste,
    defaultPlatform: platform,
    platforms: ['android', 'ios', 'native'],
  },
  // Platform files are tried in this order, so the platform under test wins over
  // a stray `.native.js`.
  moduleFileExtensions: [platform, 'native', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json'],
});

module.exports = {
  projects: [forPlatform('ios', 'ios'), forPlatform('android', 'android')],
};
