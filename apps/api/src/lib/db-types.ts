/**
 * Row shapes for the tables in supabase/migrations/0001_init.sql.
 * Kept hand-written and narrow: the API reads these and serialises to the
 * shared contract types in @leafcare/shared.
 */

export type ProfileRow = {
  id: string;
  clerk_user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  theme: 'light' | 'system' | 'dark';
  units: 'metric' | 'imperial';
  timezone: string;
  current_streak_days: number;
  last_care_date: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationPrefsRow = {
  user_id: string;
  watering_reminders: boolean;
  daily_digest_time: string;
  snooze_preset: '1h' | '3h' | 'tomorrow';
  overdue_nudges: boolean;
  quiet_start: string;
  quiet_end: string;
  expo_push_token: string | null;
};

export type PlantRow = {
  id: string;
  clerk_user_id: string;
  nickname: string;
  species_scientific: string | null;
  species_common: string | null;
  location_kind: 'living_room' | 'bedroom' | 'kitchen' | 'office' | 'custom' | null;
  location_custom: string | null;
  photo_path: string | null;
  interval_days: number;
  recommended_interval_days: number | null;
  reminder_time: string;
  last_watered_at: string | null;
  next_due_at: string | null;
  snoozed_until: string | null;
  streak_weeks: number;
  light: string | null;
  difficulty: string | null;
  notes: string | null;
  identify_confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type IdentificationRow = {
  id: string;
  clerk_user_id: string;
  photo_path: string | null;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  provider: string;
  raw_response: unknown;
  suggestions: unknown;
  created_at: string;
};

export type CareEventRow = {
  id: string;
  plant_id: string;
  clerk_user_id: string;
  type: 'watered' | 'missed' | 'snoozed';
  amount_ml: number | null;
  occurred_at: string;
  source: string | null;
};

export type AchievementRow = {
  user_id: string;
  key: string;
  unlocked_at: string;
};

export type SpeciesRow = {
  id: string;
  scientific_name: string;
  common_name: string | null;
  default_interval_days: number | null;
  light: string | null;
  difficulty: string | null;
  care_notes: unknown;
};

export type ReminderLogRow = {
  id: string;
  clerk_user_id: string;
  plant_id: string;
  due_date: string;
  kind: 'due' | 'digest' | 'overdue';
  sent_at: string;
};
