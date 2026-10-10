/**
 * Plant care domain rules shared by the API and the Expo app.
 */

import { daysBetweenDateKeys, localDateKey } from './time';

export const LOCATION_KINDS = ['living_room', 'bedroom', 'kitchen', 'office', 'custom'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

/** Chip labels in the order they appear on screen 13. */
export const LOCATION_LABELS: Record<Exclude<LocationKind, 'custom'>, string> = {
  living_room: 'Living room',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  office: 'Office',
};

export const DEFAULT_LOCATION_KINDS: Exclude<LocationKind, 'custom'>[] = [
  'living_room',
  'bedroom',
  'kitchen',
  'office',
];

export const locationLabel = (
  kind: LocationKind | null | undefined,
  custom?: string | null,
): string => {
  if (kind === 'custom') return custom?.trim() ? custom : 'Custom';
  if (kind && kind in LOCATION_LABELS) return LOCATION_LABELS[kind as keyof typeof LOCATION_LABELS];
  return 'Home';
};

export type PlantStatus = 'overdue' | 'due_today' | 'upcoming';

export type DueInfo = {
  status: PlantStatus;
  overdueDays: number;
  dueInDays: number;
};

/**
 * Classifies a plant relative to "today" in the user's timezone.
 * Due today → 0, overdue → negative offset, upcoming → positive offset.
 */
export const dueInfoFor = (options: {
  nextDueAt: Date | string | null | undefined;
  now: Date;
  timeZone: string;
}): DueInfo => {
  const { nextDueAt, now, timeZone } = options;
  if (!nextDueAt) {
    return { status: 'upcoming', overdueDays: 0, dueInDays: 0 };
  }
  const due = typeof nextDueAt === 'string' ? new Date(nextDueAt) : nextDueAt;
  const offset = daysBetweenDateKeys(localDateKey(now, timeZone), localDateKey(due, timeZone));
  if (offset < 0) return { status: 'overdue', overdueDays: -offset, dueInDays: 0 };
  if (offset === 0) return { status: 'due_today', overdueDays: 0, dueInDays: 0 };
  return { status: 'upcoming', overdueDays: 0, dueInDays: offset };
};

/** `Due today` / `Overdue 2d` / `in 6 days` — the status pill copy. */
export const statusLabel = (info: DueInfo): string => {
  if (info.status === 'overdue') return `Overdue ${info.overdueDays}d`;
  if (info.status === 'due_today') return 'Due today';
  if (info.dueInDays === 0) return 'Scheduled soon';
  return `in ${info.dueInDays} day${info.dueInDays === 1 ? '' : 's'}`;
};

/** Ring caption on the plant detail card: `2 days`. */
export const dueCountdownLabel = (info: DueInfo): string => {
  if (info.status === 'overdue') {
    return `${info.overdueDays} day${info.overdueDays === 1 ? '' : 's'}`;
  }
  if (info.status === 'due_today') return 'Today';
  return `${info.dueInDays} day${info.dueInDays === 1 ? '' : 's'}`;
};

/**
 * Streaks count consecutive days with at least one on-time watering. Missing a
 * scheduled day (an overdue plant that is then watered) restarts the count at 1.
 */
export const nextStreak = (options: {
  currentStreakDays: number;
  lastCareDateKey: string | null;
  todayKey: string;
  wasOverdue: boolean;
}): number => {
  const { currentStreakDays, lastCareDateKey, todayKey, wasOverdue } = options;
  if (lastCareDateKey === todayKey) return Math.max(currentStreakDays, 1);
  if (wasOverdue) return 1;
  if (!lastCareDateKey) return 1;
  const gap = daysBetweenDateKeys(lastCareDateKey, todayKey);
  if (gap <= 1) return Math.max(1, currentStreakDays) + 1;
  return 1;
};

export const ACHIEVEMENT_KEYS = ['first_plant', 'streak_7', 'plants_10', 'streak_30'] as const;
export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

export const ACHIEVEMENT_META: Record<
  AchievementKey,
  { title: string; description: string }
> = {
  first_plant: { title: 'First plant', description: 'Add your first plant' },
  streak_7: { title: '7-day streak', description: 'On time all week' },
  plants_10: { title: '10 plants', description: 'Grow your collection' },
  streak_30: { title: '30-day streak', description: 'A month of care' },
};

/** Achievements are derived, never stored twice — unlocks are recorded on read. */
export const unlockedAchievements = (stats: {
  plants: number;
  streakDays: number;
}): AchievementKey[] =>
  ACHIEVEMENT_KEYS.filter((key) => {
    switch (key) {
      case 'first_plant':
        return stats.plants >= 1;
      case 'streak_7':
        return stats.streakDays >= 7;
      case 'plants_10':
        return stats.plants >= 10;
      case 'streak_30':
        return stats.streakDays >= 30;
      default:
        return false;
    }
  });

export type SpeciesCare = {
  scientificName: string;
  commonName: string;
  intervalDays: number;
  light: string;
  difficulty: string;
  careNotes: string;
};

export const DEFAULT_SPECIES_CARE: Omit<SpeciesCare, 'scientificName'> = {
  commonName: 'Houseplant',
  intervalDays: 7,
  light: 'Bright indirect',
  difficulty: 'Easy',
  careNotes:
    'Water when the top inch of soil feels dry. Bright indirect light keeps the leaves even.',
};

/**
 * Curated fallbacks for the species we ship in the demo + search UI. The API
 * fills gaps from Plant.id's own care data when it is available.
 */
export const SPECIES_CARE_FALLBACKS: SpeciesCare[] = [
  {
    scientificName: 'Monstera deliciosa',
    commonName: 'Swiss cheese plant',
    intervalDays: 7,
    light: 'Bright indirect',
    difficulty: 'Easy',
    careNotes:
      'Bright indirect light — 2 m from a south-facing window. Water when the top 3 cm of soil is dry, and mist weekly in dry rooms.',
  },
  {
    scientificName: 'Monstera adansonii',
    commonName: 'Swiss cheese vine',
    intervalDays: 7,
    light: 'Bright indirect',
    difficulty: 'Easy',
    careNotes: 'Loves humidity. Keep soil lightly moist in summer, drier in winter.',
  },
  {
    scientificName: 'Spathiphyllum wallisii',
    commonName: 'Peace Lily',
    intervalDays: 7,
    light: 'Medium indirect',
    difficulty: 'Easy',
    careNotes: 'Droops visibly when thirsty. Filtered water reduces brown leaf tips.',
  },
  {
    scientificName: 'Ficus lyrata',
    commonName: 'Fiddle Leaf Fig',
    intervalDays: 10,
    light: 'Bright, near window',
    difficulty: 'Fussy',
    careNotes: 'Hates being moved and cold draughts. Water thoroughly, then let it drain.',
  },
  {
    scientificName: 'Ficus elastica',
    commonName: 'Rubber plant',
    intervalDays: 7,
    light: 'Bright indirect',
    difficulty: 'Easy',
    careNotes: 'Wipe leaves monthly so they can breathe. Avoid waterlogged roots.',
  },
  {
    scientificName: 'Zamioculcas zamiifolia',
    commonName: 'ZZ Plant',
    intervalDays: 14,
    light: 'Low to medium',
    difficulty: 'Easy',
    careNotes: 'Stores water in its rhizomes — overwatering is the only real risk.',
  },
  {
    scientificName: 'Echeveria elegans',
    commonName: 'Mexican snowball',
    intervalDays: 14,
    light: 'Direct sun',
    difficulty: 'Medium',
    careNotes: 'Soak and dry. Keep water off the rosette to avoid rot.',
  },
  {
    scientificName: 'Sansevieria trifasciata',
    commonName: 'Snake plant',
    intervalDays: 14,
    light: 'Low to bright',
    difficulty: 'Easy',
    careNotes: 'Extremely forgiving. Let the soil dry completely between waterings.',
  },
  {
    scientificName: 'Epipremnum aureum',
    commonName: 'Golden pothos',
    intervalDays: 7,
    light: 'Low to bright',
    difficulty: 'Easy',
    careNotes: 'Trails beautifully. Trim leggy vines to encourage fullness.',
  },
  {
    scientificName: 'Philodendron birkin',
    commonName: 'Philodendron Birkin',
    intervalDays: 7,
    light: 'Medium indirect',
    difficulty: 'Easy',
    careNotes: 'Keep out of harsh afternoon sun to protect the white pinstripes.',
  },
];

export const findSpeciesCare = (scientificName: string): SpeciesCare | null => {
  const needle = scientificName.trim().toLowerCase();
  const match = SPECIES_CARE_FALLBACKS.find(
    (species) => species.scientificName.toLowerCase() === needle,
  );
  return match ?? null;
};

/** Confidence at or above this score is a "high confidence" result (screen 11). */
export const HIGH_CONFIDENCE_THRESHOLD = 0.8;

export type ConfidenceTier = 'high' | 'low';

export const confidenceTier = (score: number): ConfidenceTier =>
  score >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'low';

export type CareCard = {
  title: string;
  value: string;
  detail: string;
};

/** Light / humidity / difficulty cards rendered on the detail Care tab. */
export const careCardsFor = (plant: {
  speciesScientific: string | null;
  intervalDays: number;
  light?: string | null;
  difficulty?: string | null;
}): CareCard[] => {
  const species = plant.speciesScientific ? findSpeciesCare(plant.speciesScientific) : null;
  const light = plant.light ?? species?.light ?? DEFAULT_SPECIES_CARE.light;
  const difficulty = plant.difficulty ?? species?.difficulty ?? DEFAULT_SPECIES_CARE.difficulty;
  return [
    {
      title: 'Light',
      value: light,
      detail:
        species?.careNotes ??
        'Bright, indirect light suits most houseplants — a metre or two back from a sunny window.',
    },
    {
      title: 'Water',
      value: `Every ${plant.intervalDays} days`,
      detail: 'Check the top of the soil first: if it is still damp, wait another day or two.',
    },
    {
      title: 'Difficulty',
      value: difficulty,
      detail: 'How forgiving this plant is when a watering day slips.',
    },
  ];
};
