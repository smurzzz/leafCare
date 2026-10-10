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

// One React per run, resolved from this app rather than assumed to sit in
// `<rootDir>/node_modules`. The root `package.json` pins the whole workspace to the
// version Expo SDK 57 ships (19.2.3), so npm hoists a single copy and this path *is*
// the copy Metro bundles — which is the point: a test run on a different React than
// the APK's would let a duplicate-dispatcher bug through.
const path = require('path');
const reactPath = path.dirname(require.resolve('react/package.json', { paths: [__dirname] }));

/** @type {import('jest').Config} */
const shared = {
  rootDir: __dirname,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // `@/…` is the Metro alias from tsconfig.json; Jest needs telling separately.
  //
  // Pinning `react` explicitly is what keeps the renderer and the component under
  // test on the same dispatcher: with two copies in one run, every hook fails with
  // "Cannot read properties of null (reading 'useState')".
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react$': reactPath,
    '^react/(.*)$': `${reactPath}/$1`,
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
