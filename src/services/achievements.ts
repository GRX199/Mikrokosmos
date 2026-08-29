/**
 * Achievements — gentle milestone badges (Phase 2).
 * Philosophy stays: no rankings, no competition. Every badge celebrates
 * showing up, not out-doing each other. Definitions are static + evaluated
 * client-side from data the app already loads.
 */

export interface AchievementDef {
  key: string;
  emoji: string;
  title: string;
  description: string;
  /** Positive-only wording, always. */
  hint: string;
}

/** Everything needed to evaluate one member's badges. */
export interface AchievementStats {
  streak: number;
  checkinDays: number;
  mealsLogged: number;
  photoMeals: number;
  trendsCreated: number;
  trendsDone: number;
  memoriesSaved: number;
  waterGoalDays: number;
  stepGoalDays: number;
  cosmicDays: number; // performance = 100
  mikoChats: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_checkin',
    emoji: '🌅',
    title: 'First Light',
    description: 'Checked in for the very first time',
    hint: 'Every universe starts with one small morning.',
  },
  {
    key: 'streak_3',
    emoji: '🔥',
    title: 'Warming Up',
    description: 'Checked in 3 days in a row',
    hint: 'Three gentle days in a row — lovely.',
  },
  {
    key: 'streak_7',
    emoji: '🌟',
    title: 'A Full Week',
    description: 'Checked in 7 days in a row',
    hint: 'A whole week of showing up for yourself.',
  },
  {
    key: 'streak_30',
    emoji: '🌠',
    title: 'Moon Cycle',
    description: 'Checked in 30 days in a row',
    hint: 'A full month of gentle days. Rare energy.',
  },
  {
    key: 'first_meal',
    emoji: '🍱',
    title: 'First Bite',
    description: 'Logged the first meal',
    hint: 'Food is fuel, never a fight.',
  },
  {
    key: 'meals_10',
    emoji: '🥗',
    title: 'Nourished',
    description: 'Logged 10 meals',
    hint: 'Ten little moments of care.',
  },
  {
    key: 'photo_meal',
    emoji: '📸',
    title: 'Food Photographer',
    description: 'Logged a meal with a photo',
    hint: 'Eat first or snap first — both are valid.',
  },
  {
    key: 'water_goal',
    emoji: '💧',
    title: 'Hydration Station',
    description: 'Reached the water goal in a day',
    hint: 'Little sips add up.',
  },
  {
    key: 'step_goal',
    emoji: '👟',
    title: 'Happy Feet',
    description: 'Reached the step goal in a day',
    hint: 'Wherever your feet took you — nice.',
  },
  {
    key: 'cosmic_day',
    emoji: '🌌',
    title: 'Cosmic Day',
    description: 'Scored a perfect 100 day',
    hint: 'Everything aligned. The universe noticed.',
  },
  {
    key: 'first_trend',
    emoji: '💡',
    title: 'Idea Spark',
    description: 'Created the first shared trend',
    hint: 'Every adventure starts with "what if".',
  },
  {
    key: 'trend_done',
    emoji: '✅',
    title: 'Trend Conqueror',
    description: 'Finished a trend together',
    hint: 'Doing things together is the whole point.',
  },
  {
    key: 'memory_keeper',
    emoji: '💌',
    title: 'Memory Keeper',
    description: 'Saved a memory to the scrapbook',
    hint: 'Moments kept are moments doubled.',
  },
  {
    key: 'miko_friend',
    emoji: '🤖',
    title: "Miko's Friend",
    description: 'Chatted with Miko',
    hint: 'She remembers every conversation fondly.',
  },
];

/** Which keys are unlocked for the given stats. */
export function evaluateAchievements(stats: AchievementStats): Set<string> {
  const unlocked = new Set<string>();
  if (stats.checkinDays >= 1) unlocked.add('first_checkin');
  if (stats.streak >= 3) unlocked.add('streak_3');
  if (stats.streak >= 7) unlocked.add('streak_7');
  if (stats.streak >= 30) unlocked.add('streak_30');
  if (stats.mealsLogged >= 1) unlocked.add('first_meal');
  if (stats.mealsLogged >= 10) unlocked.add('meals_10');
  if (stats.photoMeals >= 1) unlocked.add('photo_meal');
  if (stats.waterGoalDays >= 1) unlocked.add('water_goal');
  if (stats.stepGoalDays >= 1) unlocked.add('step_goal');
  if (stats.cosmicDays >= 1) unlocked.add('cosmic_day');
  if (stats.trendsCreated >= 1) unlocked.add('first_trend');
  if (stats.trendsDone >= 1) unlocked.add('trend_done');
  if (stats.memoriesSaved >= 1) unlocked.add('memory_keeper');
  if (stats.mikoChats >= 1) unlocked.add('miko_friend');
  return unlocked;
}

/** Pretty tier label for the collection progress ("3 of 14"). */
export function collectionProgress(unlocked: Set<string>): string {
  return `${unlocked.size} of ${ACHIEVEMENTS.length}`;
}
