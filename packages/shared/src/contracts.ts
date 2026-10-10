/**
 * The single source of truth for the LeafCare HTTP contract (docs/api.md).
 * The Next.js API validates inbound payloads with these schemas and the Expo app
 * parses responses with the same definitions, so drift is a type error.
 */

import { z } from 'zod';

import { LOCATION_KINDS } from './domain';

export const locationKindSchema = z.enum(LOCATION_KINDS);
export const unitSystemSchema = z.enum(['metric', 'imperial']);
export const themeSchema = z.enum(['light', 'system', 'dark']);
export const snoozePresetSchema = z.enum(['1h', '3h', 'tomorrow']);
export const plantStatusSchema = z.enum(['overdue', 'due_today', 'upcoming']);
export const careEventTypeSchema = z.enum(['watered', 'missed', 'snoozed']);
export const careSourceSchema = z.enum(['home', 'detail', 'reminders', 'scan']);
export const reminderTabSchema = z.enum(['upcoming', 'completed']);

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Present on VALIDATION_ERROR (zod issues) and some upstream failures. */
    details: z.unknown().optional(),
  }),
});

export const healthResponseSchema = z.object({ ok: z.boolean() });

export const identificationSuggestionSchema = z.object({
  scientificName: z.string(),
  commonName: z.string(),
  score: z.number().min(0).max(1),
  intervalDays: z.number().int().positive(),
  light: z.string(),
  difficulty: z.string(),
  careDetail: z.string(),
});

export const identifyResponseSchema = z.object({
  identificationId: z.string(),
  threshold: z.enum(['high', 'low']),
  photoUrl: z.string().nullable(),
  top: identificationSuggestionSchema,
  alternatives: z.array(identificationSuggestionSchema),
});

export const speciesSchema = z.object({
  scientificName: z.string(),
  commonName: z.string(),
  intervalDays: z.number().int().positive(),
  light: z.string(),
  difficulty: z.string(),
  careDetail: z.string(),
});

export const speciesSearchResponseSchema = z.object({ results: z.array(speciesSchema) });

export const plantSummarySchema = z.object({
  id: z.string(),
  nickname: z.string(),
  speciesScientific: z.string().nullable(),
  speciesCommon: z.string().nullable(),
  locationKind: locationKindSchema.nullable(),
  locationCustom: z.string().nullable(),
  locationLabel: z.string(),
  photoUrl: z.string().nullable(),
  intervalDays: z.number().int().positive(),
  reminderTime: z.string(),
  lastWateredAt: z.string().nullable(),
  nextDueAt: z.string().nullable(),
  status: plantStatusSchema,
  overdueDays: z.number().int().nonnegative(),
  dueInDays: z.number().int().nonnegative(),
  statusLabel: z.string(),
  streakWeeks: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  confidence: z.number().nullable(),
  createdAt: z.string(),
});

export const plantListResponseSchema = z.object({ plants: z.array(plantSummarySchema) });

export const plantDetailResponseSchema = z.object({
  plant: plantSummarySchema.extend({
    recommendedIntervalDays: z.number().int().positive().nullable(),
    careCards: z.array(z.object({ title: z.string(), value: z.string(), detail: z.string() })),
    nextWateringLabel: z.string(),
    scheduledForLabel: z.string().nullable(),
    history: z.array(
      z.object({
        id: z.string(),
        type: careEventTypeSchema,
        amountMl: z.number().int().nullable(),
        occurredAt: z.string(),
        source: z.string().nullable(),
      }),
    ),
  }),
});

export const createPlantSchema = z.object({
  identificationId: z.string().optional(),
  nickname: z.string().min(1).max(60),
  speciesScientific: z.string().max(120).nullable().optional(),
  speciesCommon: z.string().max(120).nullable().optional(),
  locationKind: locationKindSchema.nullable().optional(),
  locationCustom: z.string().max(60).nullable().optional(),
  intervalDays: z.number().int().min(1).max(60),
  lastWateredAt: z.string().datetime().nullable().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  photoPath: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  light: z.string().max(80).nullable().optional(),
  difficulty: z.string().max(40).nullable().optional(),
});

export const updatePlantSchema = createPlantSchema
  .omit({ identificationId: true })
  .partial()
  .extend({ nickname: z.string().min(1).max(60).optional() });

export const waterPlantSchema = z.object({
  amountMl: z.number().int().min(0).max(5000).optional(),
  source: careSourceSchema.default('home'),
  occurredAt: z.string().datetime().optional(),
});

export const waterPlantResponseSchema = z.object({
  message: z.string(),
  plant: plantSummarySchema,
  streakDays: z.number().int().nonnegative(),
});

export const homeRowSchema = z.object({
  plantId: z.string(),
  nickname: z.string(),
  species: z.string().nullable(),
  photoUrl: z.string().nullable(),
  status: plantStatusSchema,
  statusLabel: z.string(),
  dueInDays: z.number().int().nonnegative(),
  overdueDays: z.number().int().nonnegative(),
  reminderTime: z.string(),
});

export const homeResponseSchema = z.object({
  overline: z.string(),
  greeting: z.string(),
  firstName: z.string(),
  dueCount: z.number().int().nonnegative(),
  progress: z.number().min(0).max(1),
  headline: z.string(),
  streakDays: z.number().int().nonnegative(),
  today: z.array(homeRowSchema),
  upcoming: z.array(homeRowSchema),
});

export const reminderItemSchema = z.object({
  plantId: z.string(),
  title: z.string(),
  nickname: z.string(),
  time: z.string(),
  photoUrl: z.string().nullable(),
  overdue: z.boolean(),
});

export const remindersResponseSchema = z.object({
  groups: z.array(
    z.object({
      key: z.enum(['today', 'tomorrow', 'this_week']),
      label: z.string(),
      items: z.array(reminderItemSchema),
    }),
  ),
  completed: z.array(reminderItemSchema),
  empty: z.boolean(),
});

export const careLogResponseSchema = z.object({
  month: z.string(),
  monthLabel: z.string(),
  days: z.record(z.string(), z.enum(['watered', 'missed', 'empty'])),
  wateringsThisMonth: z.number().int().nonnegative(),
  deltaVsPrevMonth: z.number().int(),
  missedDays: z.number().int().nonnegative(),
  recent: z.array(
    z.object({
      id: z.string(),
      type: careEventTypeSchema,
      amountMl: z.number().int().nullable(),
      plantId: z.string(),
      plantNickname: z.string(),
      occurredAt: z.string(),
      photoUrl: z.string().nullable(),
    }),
  ),
});

export const achievementsResponseSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  unlocked: z.boolean(),
  unlockedAt: z.string().nullable(),
});

export const notificationPrefsSchema = z.object({
  wateringReminders: z.boolean(),
  dailyDigestTime: z.string(),
  snoozePreset: snoozePresetSchema,
  overdueNudges: z.boolean(),
  quietStart: z.string(),
  quietEnd: z.string(),
});

export const meResponseSchema = z.object({
  profile: z.object({
    id: z.string(),
    fullName: z.string().nullable(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    theme: themeSchema,
    units: unitSystemSchema,
    timezone: z.string(),
    createdAt: z.string(),
  }),
  stats: z.object({
    plants: z.number().int().nonnegative(),
    streakDays: z.number().int().nonnegative(),
    waterings: z.number().int().nonnegative(),
    achievementsUnlocked: z.number().int().nonnegative(),
    achievementsTotal: z.number().int().nonnegative(),
  }),
  achievements: z.array(achievementsResponseSchema),
  prefs: notificationPrefsSchema,
});

export const updateMeSchema = z
  .object({
    fullName: z.string().min(1).max(80),
    theme: themeSchema,
    units: unitSystemSchema,
    timezone: z.string().max(64),
    avatarUrl: z.string().max(400).nullable(),
  })
  .partial();

export const updateNotificationPrefsSchema = notificationPrefsSchema.partial();

export const pushTokenSchema = z.object({ token: z.string().min(1).max(200) });

export const seedRequestSchema = z.object({
  clerkUserId: z.string().min(1),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type IdentifyResponse = z.infer<typeof identifyResponseSchema>;
export type IdentificationSuggestion = z.infer<typeof identificationSuggestionSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type PlantSummary = z.infer<typeof plantSummarySchema>;
export type PlantDetail = z.infer<typeof plantDetailResponseSchema>['plant'];
export type CreatePlantInput = z.infer<typeof createPlantSchema>;
export type UpdatePlantInput = z.infer<typeof updatePlantSchema>;
export type WaterPlantInput = z.infer<typeof waterPlantSchema>;
export type WaterPlantResponse = z.infer<typeof waterPlantResponseSchema>;
export type HomeResponse = z.infer<typeof homeResponseSchema>;
export type HomeRow = z.infer<typeof homeRowSchema>;
export type RemindersResponse = z.infer<typeof remindersResponseSchema>;
export type ReminderItem = z.infer<typeof reminderItemSchema>;
export type CareLogResponse = z.infer<typeof careLogResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export type LocationKindValue = z.infer<typeof locationKindSchema>;
export type UnitSystemValue = z.infer<typeof unitSystemSchema>;
export type ThemeValue = z.infer<typeof themeSchema>;
export type SnoozePreset = z.infer<typeof snoozePresetSchema>;
export type PlantStatusValue = z.infer<typeof plantStatusSchema>;
export type CareEventType = z.infer<typeof careEventTypeSchema>;
export type PlantColorStatus = 'overdue' | 'due-today' | 'ok';

/** Maps the wire status onto the design-system status used by the UI chips. */
export const toColorStatus = (status: PlantStatusValue): PlantColorStatus => {
  if (status === 'overdue') return 'overdue';
  if (status === 'due_today') return 'due-today';
  return 'ok';
};
