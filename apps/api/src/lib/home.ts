/**
 * Home / Today payload (screen 08).
 */

import {
  formatClockTime,
  formatHomeOverline,
  greetingForDate,
  type HomeResponse,
  type HomeRow,
  type PlantSummary,
} from '@leafcare/shared';

import { colorStatusFor, listPlantRows, serializePlants, type RequestContext } from './plants';

const firstNameOf = (fullName: string | null, email: string | null): string => {
  const name = fullName?.trim();
  if (name) {
    const [first] = name.split(/\s+/);
    if (first) return first;
  }
  const emailName = email?.split('@')[0];
  if (emailName) return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  return 'there';
};

const listNames = (names: string[]): string => {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** `Monty and Pearl are due · Ficus is 2 days late` */
export const headlineFor = (plants: PlantSummary[]): string => {
  const dueToday = plants.filter((plant) => plant.status === 'due_today');
  const overdue = plants.filter((plant) => plant.status === 'overdue');
  const parts: string[] = [];

  if (dueToday.length > 0) {
    parts.push(
      `${listNames(dueToday.map((plant) => plant.nickname))} ${dueToday.length === 1 ? 'is' : 'are'} due`,
    );
  }
  for (const plant of overdue) {
    parts.push(
      `${plant.nickname} is ${plant.overdueDays} day${plant.overdueDays === 1 ? '' : 's'} late`,
    );
  }
  if (parts.length === 0) return 'Every plant is on schedule. Nice work.';
  return parts.join(' · ');
};

const toRow = (plant: PlantSummary): HomeRow => ({
  plantId: plant.id,
  nickname: plant.nickname,
  species: plant.speciesCommon ?? plant.speciesScientific,
  photoUrl: plant.photoUrl,
  status: plant.status,
  statusLabel: plant.statusLabel,
  dueInDays: plant.dueInDays,
  overdueDays: plant.overdueDays,
  reminderTime: formatClockTime(plant.reminderTime),
});

export const buildHomePayload = async (context: RequestContext): Promise<HomeResponse> => {
  const rows = await listPlantRows(context.profile.clerk_user_id);
  const plants = await serializePlants(rows, context);

  const due = plants
    .filter((plant) => plant.status !== 'upcoming')
    .sort((a, b) => b.overdueDays - a.overdueDays || a.nickname.localeCompare(b.nickname));
  const upcoming = plants
    .filter((plant) => plant.status === 'upcoming')
    .sort((a, b) => a.dueInDays - b.dueInDays || a.nickname.localeCompare(b.nickname));

  const total = plants.length;
  const onTrack = plants.filter((plant) => plant.status === 'upcoming').length;

  return {
    overline: formatHomeOverline(context.now, context.timeZone),
    greeting: `${greetingForDate(context.now, context.timeZone)}, ${firstNameOf(
      context.profile.full_name,
      context.profile.email,
    )}`,
    firstName: firstNameOf(context.profile.full_name, context.profile.email),
    dueCount: due.length,
    // Ring value: how much of the collection is on schedule (0–1).
    progress: total === 0 ? 0 : onTrack / total,
    headline: headlineFor(plants),
    streakDays: context.profile.current_streak_days,
    today: due.map(toRow),
    upcoming: upcoming.slice(0, 5).map(toRow),
  };
};

export const isDueOrOverdue = (plant: PlantSummary): boolean =>
  colorStatusFor(plant) !== 'ok';
