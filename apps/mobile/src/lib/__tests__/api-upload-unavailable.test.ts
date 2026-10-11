/**
 * Uploads in a build that has no `expo-file-system`.
 *
 * Not hypothetical: the package became a direct dependency with auto-capture, so a
 * development build made before that — or an APK from an older commit — has no
 * `ExpoFileSystem` native module, and `requireNativeModule` throws while the package
 * is being *imported*. `api.ts` loads it on first use for exactly that reason: a
 * static import would take every API call in that build down with it, not just the
 * uploads. The upload itself has no fallback on purpose — React Native's
 * `{ uri, name, type }` part is the shape that does not work — so it says so plainly
 * instead of failing as a network error.
 *
 * A separate file because the failure has to happen at module load: a mock factory
 * that throws is only meaningful on its own.
 */

import { ApiError, api } from '../api';

jest.mock('expo-file-system', () => {
  throw new Error("Cannot find native module 'ExpoFileSystem'");
});

describe('uploads without expo-file-system', () => {
  it('refuses to upload rather than reporting a network outage', async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    const error = await api
      .identify({ uri: 'file:///cache/leaf.jpg' }, {})
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('UPLOAD_UNAVAILABLE');
    expect((error as ApiError).message).toBe('This build can’t upload photos. Update the app and try again.');
    // Nothing was attempted, so nothing can be mistaken for a dead connection.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still serves the endpoints that carry no photo', async () => {
    const fetchMock = jest.fn(
      async () =>
        ({ ok: true, status: 200, text: async () => '{"ok":true}' }) as unknown as Response,
    );
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    // A read that needs no file handle keeps working, which is the point of loading
    // the module lazily instead of importing it at the top of the client.
    await api.home().catch(() => undefined);

    expect(fetchMock).toHaveBeenCalled();
  });
});
