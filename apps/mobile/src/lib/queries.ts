/**
 * React Query hooks for every endpoint in docs/api.md.
 *
 * Reads cache to AsyncStorage so Home and My Plants stay readable offline
 * (XC-1). Marking watered is optimistic: the row updates immediately and the
 * toast fires; an offline tap is queued and flushed on reconnect.
 */

import type {
  CareLogResponse,
  CreatePlantInput,
  HomeResponse,
  MeResponse,
  PlantDetail,
  PlantSummary,
  RemindersResponse,
  SnoozePreset,
  UpdateNotificationPrefsInput,
  WaterPlantResponse,
} from '@leafcare/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { ApiError, api, type UploadableImage } from './api';
import {
  StorageKeys,
  clearWateringQueue,
  enqueueWatering,
  readWateringQueue,
  writeJson,
  writeWateringQueue,
} from './storage';
import { toastBus } from './toast-bus';

export const queryKeys = {
  health: ['health'] as const,
  me: ['me'] as const,
  home: ['home'] as const,
  plants: (filter = 'all', query = '') => ['plants', filter, query] as const,
  plant: (id: string) => ['plant', id] as const,
  reminders: (tab: 'upcoming' | 'completed') => ['reminders', tab] as const,
  careLog: (month: string, plantId?: string) => ['care-log', month, plantId ?? 'all'] as const,
  species: (query: string) => ['species', query] as const,
};

const cacheWriter = <T>(key: string) => (data: T) => {
  void writeJson(key, data);
};

export const useHealth = () =>
  useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    staleTime: 60_000,
    retry: 1,
  });

export const useMe = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    enabled,
    staleTime: 30_000,
  });

export const useHome = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.home,
    queryFn: async () => {
      const data = await api.home();
      cacheWriter(StorageKeys.homeCache)(data);
      return data;
    },
    enabled,
    staleTime: 30_000,
  });

export const usePlants = (params?: { filter?: string; q?: string }, enabled = true) =>
  useQuery({
    queryKey: queryKeys.plants(params?.filter, params?.q),
    queryFn: async () => {
      const data = await api.listPlants(params);
      if (!params?.q && (!params?.filter || params.filter === 'all')) {
        cacheWriter(StorageKeys.plantsCache)(data);
      }
      return data;
    },
    enabled,
    staleTime: 15_000,
  });

export const usePlant = (id: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.plant(id),
    queryFn: () => api.getPlant(id),
    enabled: enabled && id.length > 0,
    staleTime: 10_000,
  });

export const useReminders = (tab: 'upcoming' | 'completed' = 'upcoming', enabled = true) =>
  useQuery({
    queryKey: queryKeys.reminders(tab),
    queryFn: async () => {
      const data = await api.reminders(tab);
      if (tab === 'upcoming') cacheWriter(StorageKeys.remindersCache)(data);
      return data;
    },
    enabled,
    staleTime: 15_000,
  });

export const useCareLog = (month: string, plantId?: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.careLog(month, plantId),
    queryFn: () => api.careLog({ month, plantId }),
    enabled,
    staleTime: 30_000,
  });

export const useSpeciesSearch = (query: string) =>
  useQuery({
    queryKey: queryKeys.species(query),
    queryFn: () => api.searchSpecies(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

export const useNotificationPrefs = () =>
  useQuery({
    queryKey: ['notification-prefs'] as const,
    queryFn: api.notificationPrefs,
    staleTime: 30_000,
  });

/* ------------------------------------------------------------------ helpers */

const invalidatePlantData = async (client: QueryClient, plantId?: string): Promise<void> => {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.home }),
    client.invalidateQueries({ queryKey: ['plants'] }),
    client.invalidateQueries({ queryKey: queryKeys.reminders('upcoming') }),
    client.invalidateQueries({ queryKey: queryKeys.reminders('completed') }),
    client.invalidateQueries({ queryKey: ['care-log'] }),
    client.invalidateQueries({ queryKey: queryKeys.me }),
    plantId ? client.invalidateQueries({ queryKey: queryKeys.plant(plantId) }) : Promise.resolve(),
  ]);
};

/** Optimistically removes a plant from today's care / due groups. */
const optimisticallyWater = (client: QueryClient, plantId: string): void => {
  client.setQueryData<HomeResponse>(queryKeys.home, (current) => {
    if (!current) return current;
    return {
      ...current,
      today: current.today.filter((row) => row.plantId !== plantId),
      dueCount: Math.max(0, current.dueCount - 1),
    };
  });

  client.setQueryData<RemindersResponse>(queryKeys.reminders('upcoming'), (current) => {
    if (!current) return current;
    const groups = current.groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.plantId !== plantId),
    }));
    return { ...current, groups: groups.filter((group) => group.items.length > 0) };
  });

  client.setQueryData<{ plants: PlantSummary[] }>(queryKeys.plants(), (current) => {
    if (!current) return current;
    return {
      plants: current.plants.map((plant) =>
        plant.id === plantId
          ? { ...plant, status: 'upcoming' as const, statusLabel: 'Watered just now' }
          : plant,
      ),
    };
  });
};

export type WaterVariables = {
  plantId: string;
  nickname: string;
  source?: 'home' | 'detail' | 'reminders' | 'scan';
  amountMl?: number;
};

/** Marks watered from any surface; queues the tap when the device is offline. */
export const useWaterPlant = (): UseMutationResult<WaterPlantResponse, ApiError, WaterVariables> => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: WaterVariables) =>
      api.waterPlant(variables.plantId, {
        amountMl: variables.amountMl,
        source: variables.source ?? 'home',
      }),
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: queryKeys.home });
      optimisticallyWater(client, variables.plantId);
    },
    onSuccess: async (data, variables) => {
      toastBus.show(data.message);
      await invalidatePlantData(client, variables.plantId);
    },
    onError: async (error, variables) => {
      if (error instanceof ApiError && error.isOffline) {
        await enqueueWatering({
          plantId: variables.plantId,
          nickname: variables.nickname,
          source: variables.source ?? 'home',
        });
        toastBus.show(`${variables.nickname} watered`);
        return;
      }
      await invalidatePlantData(client, variables.plantId);
      toastBus.error(error.message);
    },
  });
};

/** Sends any queued offline waterings, newest first. */
export const flushWateringQueue = async (client: QueryClient): Promise<number> => {
  const queue = await readWateringQueue();
  if (queue.length === 0) return 0;

  const remaining = [...queue];
  let synced = 0;
  for (const entry of queue) {
    try {
      await api.waterPlant(entry.plantId, { source: entry.source });
      remaining.splice(remaining.indexOf(entry), 1);
      synced += 1;
    } catch {
      // Still offline (or the plant was deleted): keep it queued.
      break;
    }
  }

  if (remaining.length === 0) await clearWateringQueue();
  else await writeWateringQueue(remaining);

  if (synced > 0) await invalidatePlantData(client);
  return synced;
};

export const useCreatePlant = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: { input: CreatePlantInput; image?: UploadableImage | null }) =>
      api.createPlant(variables.input, variables.image),
    onSuccess: async (data) => {
      toastBus.show(`${data.plant.nickname} added`);
      await invalidatePlantData(client, data.plant.id);
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export const useUpdatePlant = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      id: string;
      patch: Record<string, unknown>;
      image?: UploadableImage | null;
    }) => api.updatePlant(variables.id, variables.patch, variables.image),
    onSuccess: async (data, variables) => {
      client.setQueryData(queryKeys.plant(variables.id), data);
      await invalidatePlantData(client, variables.id);
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export const useDeletePlant = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; nickname: string }) => api.deletePlant(variables.id),
    onSuccess: async (_data, variables) => {
      toastBus.show(`${variables.nickname} removed`);
      await invalidatePlantData(client);
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export const useResetSchedule = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resetSchedule(id),
    onSuccess: async (data) => {
      client.setQueryData(queryKeys.plant(data.plant.id), data);
      await invalidatePlantData(client, data.plant.id);
      toastBus.show('Schedule reset to recommended');
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export const useSnoozeReminder = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: { plantId: string; preset: SnoozePreset }) =>
      api.snoozeReminder(variables.plantId, variables.preset),
    onSuccess: async () => {
      await invalidatePlantData(client);
      toastBus.show('Reminder snoozed');
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export const useUpdateMe = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: (data: MeResponse) => {
      client.setQueryData(queryKeys.me, data);
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export const useUpdateNotificationPrefs = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateNotificationPrefsInput) => api.updateNotificationPrefs(patch),
    onSuccess: (data) => {
      client.setQueryData(['notification-prefs'], data);
      void client.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export const useDeleteAccount = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      client.clear();
    },
    onError: (error: ApiError) => toastBus.error(error.message),
  });
};

export type { CareLogResponse, PlantDetail, RemindersResponse };
