/**
 * Global Jest setup.
 *
 * AsyncStorage is backed by a real process, so the native module cannot run in
 * Jest. It is replaced here — once, for every test file — by the in-memory
 * stand-in in `test/async-storage.ts`, which also lets a test force reads or
 * writes to fail so the "storage must never break a screen" paths are covered.
 *
 * Nothing else is mocked globally: anything a test needs to control (NetInfo,
 * the OS colour scheme) is mocked in that test, so the mock is visible next to
 * the assertion that depends on it.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  // `require` inside the factory is the documented way to reach a module from a
  // jest.mock factory without tripping the out-of-scope-variable check.
  const { asyncStorage } = require('./test/async-storage');
  return { __esModule: true, default: asyncStorage };
});
