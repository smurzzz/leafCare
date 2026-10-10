/**
 * Mutation side effects (src/lib/queries.ts).
 *
 * A plant's reminder lives in two places: the schedule the server computes and
 * the notification scheduled on the phone, which is the one that still fires when
 * the API is out of reach. The screens only call mutations, so staying in step is
 * this layer's job — and a drift here is invisible until a user is told to water a
 * plant they watered yesterday, or is nagged about one they deleted.
 *
 * `api` and `notifications` are mocked: what is under test is the wiring, and the
 * real API client already has its own coverage through the shared contracts.
 */

import { homeResponseSchema, type HomeResponse, type PlantSummary } from '@leafcare/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { asyncStorageControl } from '../../../test/async-storage';
import { ApiError, api } from '../api';
import { cancelPlantReminder, schedulePlantReminder } from '../notifications';
import { useDeletePlant, useWaterPlant } from '../queries';
import { readWateringQueue } from '../storage';

jest.mock('../notifications', () => ({
  __esModule: true,
  schedulePlantReminder: jest.fn(async () => undefined),
  cancelPlantReminder: jest.fn(async () => undefined),
}));

jest.mock('../api', () => {
  /*
   * Declared field by field rather than with TypeScript parameter properties:
   * `constructor(readonly status: number, …)` compiles to assignments that trip
   * babel-plugin-jest-hoist's "no out-of-scope variables in a mock factory" check.
   */
  class MockApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }

    get isOffline(): boolean {
      return this.status === 0 || this.code === 'NETWORK_ERROR';
    }
  }

  return {
    __esModule: true,
    ApiError: MockApiError,
    api: {
      waterPlant: jest.fn(),
      deletePlant: jest.fn(async () => undefined),
    },
  };
});

const mockApi = jest.mocked(api) as unknown as {
  waterPlant: jest.Mock;
  deletePlant: jest.Mock;
};
const mockSchedule = jest.mocked(schedulePlantReminder);
const mockCancel = jest.mocked(cancelPlantReminder);

const plant: PlantSummary = {
  id: 'plant_1',
  nickname: 'Ficus',
  speciesScientific: 'Ficus lyrata',
  speciesCommon: 'Fiddle-leaf fig',
  locationKind: 'living_room',
  locationCustom: null,
  locationLabel: 'Living room',
  photoUrl: null,
  intervalDays: 7,
  reminderTime: '08:15',
  lastWateredAt: '2026-03-08T00:15:00.000Z',
  nextDueAt: '2026-03-15T00:15:00.000Z',
  status: 'upcoming',
  overdueDays: 0,
  dueInDays: 7,
  statusLabel: 'in 7 days',
  streakWeeks: 3,
  notes: null,
  confidence: 0.9,
  createdAt: '2026-02-01T00:00:00.000Z',
};

const waterResponse = {
  message: 'Ficus watered',
  plant,
  streakDays: 8,
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  asyncStorageControl.reset();
  mockApi.waterPlant.mockReset();
  mockApi.deletePlant.mockReset();
  mockApi.deletePlant.mockResolvedValue(undefined);
});

describe('watering', () => {
  it('schedules the device reminder from the schedule the server returned', async () => {
    mockApi.waterPlant.mockResolvedValue(waterResponse);
    const { result } = await renderHook(() => useWaterPlant(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ plantId: 'plant_1', nickname: 'Ficus', source: 'home' });
    });

    expect(mockSchedule).toHaveBeenCalledWith({
      plantId: 'plant_1',
      nickname: 'Ficus',
      nextDueAt: plant.nextDueAt,
    });
  });

  it('queues an offline tap instead of scheduling a reminder that would be wrong', async () => {
    mockApi.waterPlant.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'No connection'));
    const { result } = await renderHook(() => useWaterPlant(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ plantId: 'plant_1', nickname: 'Ficus', source: 'home' })
        .catch(() => undefined);
    });

    await expect(readWateringQueue()).resolves.toEqual([
      expect.objectContaining({ plantId: 'plant_1', nickname: 'Ficus', source: 'home' }),
    ]);
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe('deleting a plant', () => {
  it('drops its scheduled reminder', async () => {
    const { result } = await renderHook(() => useDeletePlant(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'plant_1', nickname: 'Ficus' });
    });

    expect(mockCancel).toHaveBeenCalledWith('plant_1');
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe('hydration fixture', () => {
  it('matches the shared contract the app renders from', () => {
    // Guards the fixture above: if `@leafcare/shared` moves under it, this fails
    // here rather than quietly weakening the assertions in this file.
    expect(
      homeResponseSchema.safeParse({
        overline: '',
        greeting: '',
        firstName: '',
        dueCount: 0,
        progress: 0,
        headline: '',
        streakDays: 0,
        today: [],
        upcoming: [],
      } satisfies HomeResponse).success,
    ).toBe(true);
  });
});
