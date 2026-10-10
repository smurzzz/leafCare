/**
 * Scan session (src/lib/scan-session.ts).
 *
 * This store carries the captured photo and the provider response from the camera
 * to the result, uncertain and add-plant screens (screens 09–13). The interesting
 * cases are the low-confidence ones: `top` is null when the provider matched
 * nothing, and the uncertain screen must still show whatever alternatives came
 * back rather than crashing on a missing suggestion.
 *
 * Fixtures are parsed through the shared contracts, so the session can only be
 * built with the shape the API really returns.
 */

import {
  identificationSuggestionSchema,
  type IdentificationSuggestion,
  type IdentifyResponse,
} from '@leafcare/shared';

import {
  allSuggestions,
  clearScanSession,
  getScanSession,
  selectSuggestion,
  selectedSuggestion,
  setScanIdentificationId,
  setScanResult,
  startScanSession,
} from '../scan-session';

const suggestion = (scientificName: string, score: number): IdentificationSuggestion =>
  identificationSuggestionSchema.parse({
    scientificName,
    commonName: scientificName.split(' ')[1] ?? scientificName,
    score,
    intervalDays: 7,
    light: 'Bright indirect light',
    difficulty: 'Easy',
    careDetail: 'Water when the topsoil is dry.',
  });

const response = (
  top: IdentificationSuggestion | null,
  alternatives: IdentificationSuggestion[],
): IdentifyResponse => ({
  identificationId: 'ident_1',
  threshold: top && top.score >= 0.8 ? 'high' : 'low',
  photoUrl: null,
  top,
  alternatives,
});

const ficus = suggestion('Ficus lyrata', 0.92);
const monstera = suggestion('Monstera deliciosa', 0.61);
const pothos = suggestion('Epipremnum aureum', 0.44);

beforeEach(() => {
  clearScanSession();
});

describe('startScanSession', () => {
  it('keeps the local photo and waits for the provider', () => {
    const session = startScanSession('file:///tmp/leaf.jpg');

    expect(session.photoUri).toBe('file:///tmp/leaf.jpg');
    expect(session.identificationId).toBeNull();
    expect(session.result).toBeNull();
    expect(session.selectedIndex).toBe(0);
    expect(Date.now() - session.createdAt).toBeLessThan(1000);
    expect(getScanSession()).toEqual(session);
  });

  it('replaces a previous scan', () => {
    startScanSession('file:///tmp/first.jpg');
    startScanSession('file:///tmp/second.jpg');

    expect(getScanSession()?.photoUri).toBe('file:///tmp/second.jpg');
  });
});

describe('setScanResult', () => {
  it('ranks the top match ahead of the alternatives', () => {
    startScanSession('file:///tmp/leaf.jpg');
    setScanResult('ident_1', response(ficus, [monstera, pothos]));

    expect(allSuggestions()).toEqual([ficus, monstera, pothos]);
    expect(selectedSuggestion()).toEqual(ficus);
    expect(getScanSession()?.identificationId).toBe('ident_1');
  });

  it('falls back to the alternatives when nothing passed the threshold', () => {
    startScanSession('file:///tmp/leaf.jpg');
    setScanResult('ident_1', response(null, [monstera, pothos]));

    expect(allSuggestions()).toEqual([monstera, pothos]);
    expect(selectedSuggestion()).toEqual(monstera);
  });

  it('handles a provider that matched nothing at all', () => {
    startScanSession('file:///tmp/leaf.jpg');
    setScanResult('ident_1', response(null, []));

    expect(allSuggestions()).toEqual([]);
    expect(selectedSuggestion()).toBeNull();
  });

  it('ignores a result that arrives after the session was cleared', () => {
    startScanSession('file:///tmp/leaf.jpg');
    clearScanSession();
    setScanResult('ident_1', response(ficus, []));

    expect(getScanSession()).toBeNull();
    expect(allSuggestions()).toEqual([]);
  });
});

describe('selectSuggestion', () => {
  beforeEach(() => {
    startScanSession('file:///tmp/leaf.jpg');
    setScanResult('ident_1', response(ficus, [monstera, pothos]));
  });

  it('selects by index', () => {
    selectSuggestion(2);

    expect(selectedSuggestion()).toEqual(pothos);
    expect(getScanSession()?.selectedIndex).toBe(2);
  });

  it('clamps an out-of-range index back to the first suggestion', () => {
    selectSuggestion(9);

    expect(selectedSuggestion()).toEqual(ficus);
  });

  it('ignores selection before a result exists', () => {
    clearScanSession();
    startScanSession('file:///tmp/leaf.jpg');
    selectSuggestion(2);

    expect(selectedSuggestion()).toBeNull();
    expect(getScanSession()?.selectedIndex).toBe(0);
  });
});

describe('setScanIdentificationId', () => {
  it('records the id when Cancel targets an in-flight identify call', () => {
    startScanSession('file:///tmp/leaf.jpg');
    setScanIdentificationId('ident_pending');

    expect(getScanSession()?.identificationId).toBe('ident_pending');
    // The photo must survive: Cancel still has to offer a retry with it.
    expect(getScanSession()?.photoUri).toBe('file:///tmp/leaf.jpg');
  });

  it('does nothing without a session', () => {
    setScanIdentificationId('ident_pending');

    expect(getScanSession()).toBeNull();
  });
});

describe('clearScanSession', () => {
  it('drops everything, including the device photo uri', () => {
    startScanSession('file:///tmp/leaf.jpg');
    setScanResult('ident_1', response(ficus, []));

    clearScanSession();

    expect(getScanSession()).toBeNull();
    expect(allSuggestions()).toEqual([]);
    expect(selectedSuggestion()).toBeNull();
  });
});
