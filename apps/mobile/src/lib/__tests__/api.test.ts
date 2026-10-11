/**
 * The HTTP client itself (src/lib/api.ts).
 *
 * This file exists because the client had no coverage of its own, and the gap cost
 * a real bug: every upload built its photo part as React Native's
 * `{ uri, name, type }` object, while the global `fetch` in this app is Expo's —
 * which serialises the body itself and understands only strings, `Blob`s and
 * objects with a `bytes()` method. The throw happened inside `fetch`, so no request
 * left the device and the failure was reported as a dead connection: "We couldn't
 * reach LeafCare" with the API running perfectly.
 *
 * The stub below therefore enforces that same rule rather than accepting anything,
 * so a regression to the old part shape fails here instead of on a phone.
 */

import {
  identificationSuggestionSchema,
  type CreatePlantInput,
  type IdentifyResponse,
} from '@leafcare/shared';

import { ApiError, api, setSessionTokenGetter } from '../api';

jest.mock('expo-file-system', () => ({
  __esModule: true,
  // Stands in for the real `File`: a photo handle that can read its own bytes and
  // knows its name and type. Fields rather than accessors, so a part survives the
  // spread React Native's `FormData.getParts()` does.
  File: class {
    uri: string;
    name: string;
    type: string;
    bytes = async () => new Uint8Array([1, 2, 3, 4]);
    constructor(uri: string) {
      this.uri = uri;
      this.name = uri.split('/').pop() ?? 'photo.jpg';
      this.type = 'image/jpeg';
    }
  },
}));

/** Records parts instead of serialising them, so the test can inspect the shape. */
class RecordingFormData {
  parts: [string, unknown][] = [];
  append(name: string, value: unknown): void {
    this.parts.push([name, value]);
  }
}

const globalWithFormData = globalThis as { FormData: unknown; fetch: unknown };
const realFormData = globalWithFormData.FormData;
const realFetch = globalWithFormData.fetch;

/**
 * Expo's rule, from `expo/src/winter/fetch/convertFormData.ts`: a string, an
 * `instanceof Blob`, or `'bytes' in part`. Anything else throws there.
 */
const isSerialisableByExpoFetch = (value: unknown): boolean =>
  typeof value === 'string' ||
  (typeof Blob !== 'undefined' && value instanceof Blob) ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as { bytes?: unknown }).bytes === 'function');

const partsOf = (body: unknown): [string, unknown][] => (body as RecordingFormData).parts;

const jsonResponse = (payload: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  }) as unknown as Response;

/** A fetch that answers with `payload`, but refuses a body Expo's fetch could not build. */
const fetchAnswering = (payload: unknown, status = 200) =>
  jest.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body;
    if (body instanceof RecordingFormData) {
      for (const [, value] of partsOf(body)) {
        if (!isSerialisableByExpoFetch(value)) {
          throw new Error('Unsupported FormDataPart implementation');
        }
      }
    }
    return jsonResponse(payload, status);
  });

const suggestion = identificationSuggestionSchema.parse({
  scientificName: 'Ficus lyrata',
  commonName: 'lyrata',
  score: 0.92,
  intervalDays: 7,
  light: 'Bright indirect light',
  difficulty: 'Easy',
  careDetail: 'Water when the topsoil is dry.',
});

const identifyPayload: IdentifyResponse = {
  identificationId: 'ident_1',
  threshold: 'high',
  photoUrl: null,
  top: suggestion,
  alternatives: [],
};

beforeEach(() => {
  globalWithFormData.FormData = RecordingFormData;
  setSessionTokenGetter(async () => null);
});

afterAll(() => {
  globalWithFormData.FormData = realFormData;
  globalWithFormData.fetch = realFetch;
});

describe('api.identify', () => {
  it('sends the photo as a part Expo’s fetch can serialise, not a `{ uri }` object', async () => {
    const fetchMock = fetchAnswering(identifyPayload);
    globalWithFormData.fetch = fetchMock;

    const result = await api.identify({ uri: 'file:///cache/leaf.jpg' }, {});

    expect(result.identificationId).toBe('ident_1');
    const [request] = fetchMock.mock.calls;
    const body = (request?.[1] as RequestInit | undefined)?.body;
    const parts = partsOf(body);

    expect(parts.map(([name]) => name)).toEqual(['image']);
    const photo = parts[0]?.[1] as { uri: string; name: string; type: string; bytes?: unknown };
    // The whole point: a readable handle, which is what makes the request leave the
    // device at all. The old `{ uri, name, type }` part had no `bytes`.
    expect(isSerialisableByExpoFetch(photo)).toBe(true);
    expect(typeof photo.bytes).toBe('function');
    expect(photo.uri).toBe('file:///cache/leaf.jpg');
    expect(photo.name).toBe('leaf.jpg');
    expect(photo.type).toBe('image/jpeg');
  });

  it('posts to /api/identify with the Clerk token and the request id', async () => {
    const fetchMock = fetchAnswering(identifyPayload);
    globalWithFormData.fetch = fetchMock;
    setSessionTokenGetter(async () => 'session-token');

    await api.identify({ uri: 'file:///cache/leaf.jpg' }, { requestId: 'req-1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/identify$/);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer session-token');
    expect((init.headers as Record<string, string>)['X-Request-Id']).toBe('req-1');
  });
});

describe('api.createPlant', () => {
  it('carries the fields as strings and the photo as a readable part', async () => {
    const fetchMock = fetchAnswering({
      plant: { id: 'plant_1' },
    });
    globalWithFormData.fetch = fetchMock;

    await api
      .createPlant(
        // Only the multipart body is under test here, so the response is allowed to
        // fail its own contract parse — the request is already on the wire by then.
        {
          nickname: 'Ficus',
          intervalDays: 7,
          locationKind: 'living_room',
          lastWateredAt: '2026-10-10T09:00:00.000Z',
          reminderTime: '09:00',
        } as unknown as CreatePlantInput,
        { uri: 'file:///cache/plant.jpg' },
      )
      .catch(() => undefined);

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body;
    const parts = partsOf(body);
    const photo = parts.find(([name]) => name === 'image')?.[1];

    expect(isSerialisableByExpoFetch(photo)).toBe(true);
    expect(parts.find(([name]) => name === 'nickname')?.[1]).toBe('Ficus');
    expect(parts.find(([name]) => name === 'intervalDays')?.[1]).toBe('7');
  });
});

describe('failures', () => {
  it('reports a genuinely unreachable API as an offline error', async () => {
    globalWithFormData.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });

    const error = await api.home().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect((error as ApiError).isOffline).toBe(true);
    expect((error as ApiError).message).toBe('We couldn’t reach LeafCare. Check your connection.');
  });

  it('rethrows a cancelled request instead of blaming the connection', async () => {
    // Expo's fetch cancels with its own `FetchError`, not an `AbortError`, so the
    // signal is the only reliable test. Screen 10 turns anything that is not an
    // ApiError into its "took too long" copy, which is the intended story for the
    // 20-second timeout — the old mapping told users their network was down instead.
    const controller = new AbortController();
    const cancellation = Object.assign(new Error('fetch failed: Fetch request has been canceled'), {
      name: 'FetchError',
    });
    globalWithFormData.fetch = jest.fn(async () => {
      controller.abort();
      throw cancellation;
    });

    const error = await api.identify({ uri: 'file:///cache/leaf.jpg' }, { signal: controller.signal }).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBe(cancellation);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it('uses the server’s own code and message when the API answers with an error', async () => {
    globalWithFormData.fetch = fetchAnswering(
      { error: { code: 'RATE_LIMITED', message: 'You have identified a lot of plants.' } },
      429,
    );

    const error = await api.home().catch((thrown: unknown) => thrown);

    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).code).toBe('RATE_LIMITED');
    expect((error as ApiError).message).toBe('You have identified a lot of plants.');
    expect((error as ApiError).isOffline).toBe(false);
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    globalWithFormData.fetch = jest.fn(
      async () =>
        ({ ok: false, status: 500, text: async () => '<html>oops</html>' }) as unknown as Response,
    );

    const error = await api.home().catch((thrown: unknown) => thrown);

    expect((error as ApiError).code).toBe('SERVER_ERROR');
    expect((error as ApiError).message).toBe('Something went wrong');
  });
});
