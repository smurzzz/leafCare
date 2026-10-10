/**
 * The single HTTP client for the LeafCare API.
 *
 * Every call attaches the Clerk session token, parses responses through the
 * shared zod contracts, and normalises failures into `ApiError` so screens can
 * decide between an inline message and the full error state (screen 25).
 */

import {
  careLogResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  homeResponseSchema,
  identifyResponseSchema,
  meResponseSchema,
  plantDetailResponseSchema,
  plantListResponseSchema,
  reminderTabSchema,
  remindersResponseSchema,
  speciesSearchResponseSchema,
  unitSystemSchema,
  themeSchema,
  waterPlantResponseSchema,
  type CareLogResponse,
  type CreatePlantInput,
  type HomeResponse,
  type IdentifyResponse,
  type LocationKindValue,
  type MeResponse,
  type PlantDetail,
  type PlantSummary,
  type RemindersResponse,
  type SnoozePreset,
  type Species,
  type UnitSystemValue,
  type ThemeValue,
  type UpdateNotificationPrefsInput,
  type WaterPlantResponse,
} from '@leafcare/shared';
import type { z } from 'zod';

import { config } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isOffline(): boolean {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
}

export type UploadableImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

let tokenGetter: () => Promise<string | null> = async () => null;

/** Wired up once, inside the Clerk provider. */
export const setSessionTokenGetter = (getter: () => Promise<string | null>): void => {
  tokenGetter = getter;
};

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  form?: FormData;
  parse: (value: unknown) => T;
  signal?: AbortSignal;
  /** Identify calls carry a client-generated id so Cancel can target them. */
  requestId?: string;
};

const buildUrl = (path: string, query?: RequestOptions<unknown>['query']): string => {
  const url = new URL(`${config.apiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
};

const request = async <T>(options: RequestOptions<T>): Promise<T> => {
  const token = await tokenGetter();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.requestId) headers['X-Request-Id'] = options.requestId;

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(options.path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', "We couldn't reach LeafCare. Check your connection.");
  }

  if (response.status === 204) {
    return options.parse(undefined);
  }

  const text = await response.text();
  const payload: unknown = text.length > 0 ? safeJson(text) : undefined;

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(payload);
    throw new ApiError(
      response.status,
      parsedError.success ? parsedError.data.error.code : 'SERVER_ERROR',
      parsedError.success ? parsedError.data.error.message : 'Something went wrong',
      parsedError.success ? parsedError.data.error.details : payload,
    );
  }

  return options.parse(payload);
};

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const parseWith =
  <T>(schema: z.ZodType<T>) =>
  (value: unknown): T =>
    schema.parse(value);

/** Uploads a local file from expo-camera / expo-image-picker. */
const imageFormData = (field: string, image: UploadableImage, extra?: Record<string, string>) => {
  const form = new FormData();
  const fileName = image.fileName ?? `upload-${Date.now()}.jpg`;
  const type = image.mimeType ?? 'image/jpeg';
  form.append(field, { uri: image.uri, name: fileName, type } as unknown as Blob);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value !== undefined && value !== null) form.append(key, value);
  }
  return form;
};

/** Serialises a create/update payload for the multipart plant endpoints. */
const plantFormData = (payload: Record<string, unknown>, image?: UploadableImage | null) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    form.append(key, value === null ? 'null' : String(value));
  }
  if (image) {
    form.append('image', {
      uri: image.uri,
      name: image.fileName ?? `plant-${Date.now()}.jpg`,
      type: image.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
  }
  return form;
};

export const api = {
  health: () =>
    request({ path: '/api/health', parse: parseWith(healthResponseSchema) }),

  identify: (image: UploadableImage, options: { signal?: AbortSignal; requestId?: string }) =>
    request<IdentifyResponse>({
      method: 'POST',
      path: '/api/identify',
      form: imageFormData('image', image),
      parse: parseWith(identifyResponseSchema),
      signal: options.signal,
      requestId: options.requestId,
    }),

  cancelIdentify: (identificationId: string) =>
    request({ method: 'DELETE', path: `/api/identify/${identificationId}`, parse: () => undefined }),

  searchSpecies: (query: string) =>
    request<{ results: Species[] }>({
      path: '/api/species',
      query: { q: query },
      parse: parseWith(speciesSearchResponseSchema),
    }),

  listPlants: (params?: { filter?: string; q?: string }) =>
    request<{ plants: PlantSummary[] }>({
      path: '/api/plants',
      query: params,
      parse: parseWith(plantListResponseSchema),
    }),

  getPlant: (id: string) =>
    request<{ plant: PlantDetail }>({
      path: `/api/plants/${id}`,
      parse: parseWith(plantDetailResponseSchema),
    }),

  createPlant: (input: CreatePlantInput, image?: UploadableImage | null) =>
    request<{ plant: PlantDetail }>({
      method: 'POST',
      path: '/api/plants',
      form: plantFormData(
        {
          identificationId: input.identificationId,
          nickname: input.nickname,
          speciesScientific: input.speciesScientific,
          speciesCommon: input.speciesCommon,
          locationKind: input.locationKind,
          locationCustom: input.locationCustom,
          intervalDays: input.intervalDays,
          lastWateredAt: input.lastWateredAt,
          reminderTime: input.reminderTime,
          notes: input.notes,
          confidence: input.confidence,
          light: input.light,
          difficulty: input.difficulty,
        },
        image,
      ),
      parse: parseWith(plantDetailResponseSchema),
    }),

  updatePlant: (id: string, patch: Record<string, unknown>, image?: UploadableImage | null) =>
    request<{ plant: PlantDetail }>({
      method: 'PATCH',
      path: `/api/plants/${id}`,
      form: plantFormData(patch, image),
      parse: parseWith(plantDetailResponseSchema),
    }),

  deletePlant: (id: string) =>
    request({ method: 'DELETE', path: `/api/plants/${id}`, parse: () => undefined }),

  waterPlant: (
    id: string,
    body: { amountMl?: number; source?: 'home' | 'detail' | 'reminders' | 'scan' } = {},
  ) =>
    request<WaterPlantResponse>({
      method: 'POST',
      path: `/api/plants/${id}/water`,
      body,
      parse: parseWith(waterPlantResponseSchema),
    }),

  resetSchedule: (id: string) =>
    request<{ plant: PlantDetail }>({
      method: 'POST',
      path: `/api/plants/${id}/schedule/reset`,
      parse: parseWith(plantDetailResponseSchema),
    }),

  home: () => request<HomeResponse>({ path: '/api/home', parse: parseWith(homeResponseSchema) }),

  reminders: (tab: 'upcoming' | 'completed' = 'upcoming') =>
    request<RemindersResponse>({
      path: '/api/reminders',
      query: { tab: reminderTabSchema.parse(tab) },
      parse: parseWith(remindersResponseSchema),
    }),

  snoozeReminder: (plantId: string, preset: SnoozePreset) =>
    request<{ snoozedUntil: string; preset: SnoozePreset; plant: PlantSummary }>({
      method: 'POST',
      path: `/api/reminders/${plantId}/snooze`,
      body: { preset },
      parse: (value) => {
        const payload = value as { snoozedUntil: string; preset: SnoozePreset; plant: PlantSummary };
        return payload;
      },
    }),

  completeReminder: (plantId: string) =>
    request<WaterPlantResponse>({
      method: 'POST',
      path: `/api/reminders/${plantId}/done`,
      parse: parseWith(waterPlantResponseSchema),
    }),

  careLog: (params?: { month?: string; plantId?: string }) =>
    request<CareLogResponse>({
      path: '/api/care-log',
      query: params,
      parse: parseWith(careLogResponseSchema),
    }),

  me: () => request<MeResponse>({ path: '/api/me', parse: parseWith(meResponseSchema) }),

  updateMe: (patch: {
    fullName?: string;
    theme?: ThemeValue;
    units?: UnitSystemValue;
    avatarUrl?: string | null;
    timezone?: string;
  }) =>
    request<MeResponse>({
      method: 'PATCH',
      path: '/api/me',
      body: {
        ...patch,
        theme: patch.theme ? themeSchema.parse(patch.theme) : undefined,
        units: patch.units ? unitSystemSchema.parse(patch.units) : undefined,
      },
      parse: parseWith(meResponseSchema),
    }),

  deleteAccount: () =>
    request({ method: 'DELETE', path: '/api/me', parse: () => undefined }),

  notificationPrefs: () =>
    request<UpdateNotificationPrefsInput>({
      path: '/api/me/notifications',
      parse: (value) => value as UpdateNotificationPrefsInput,
    }),

  updateNotificationPrefs: (patch: UpdateNotificationPrefsInput) =>
    request<UpdateNotificationPrefsInput>({
      method: 'PUT',
      path: '/api/me/notifications',
      body: patch,
      parse: (value) => value as UpdateNotificationPrefsInput,
    }),

  registerPushToken: (token: string) =>
    request({ method: 'POST', path: '/api/me/push-token', body: { token }, parse: () => undefined }),
};

export type { LocationKindValue };
