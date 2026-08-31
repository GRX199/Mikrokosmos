import type { ActivityLevel, BodyInsights, BodyMetrics, WeightGoal } from '@/models';

/**
 * Smart body insights (Phase 2).
 *
 * Philosophy stays gentle: numbers are for guidance, never judgment.
 * - BMR: Mifflin-St Jeor (the most reliable common equation)
 * - TDEE: BMR × activity multiplier
 * - Weight-loss target: TDEE − deficit (7700 kcal ≈ 1 kg), but never below
 *   1200 kcal/day and never more than a 25% cut — slow and kind wins.
 */

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // desk life, little movement
  light: 1.375, // light exercise 1-3 days/week
  moderate: 1.55, // moderate exercise 3-5 days/week
  active: 1.725, // hard exercise 6-7 days/week
  very_active: 1.9, // athlete / physical job
};

const GOAL_RATES: Record<WeightGoal, number> = {
  maintain: 0,
  lose_025: 0.25, // kg per week
  lose_05: 0.5,
  lose_075: 0.75,
};

const KCAL_PER_KG = 7700; // ≈ energy in 1 kg of body mass
const MIN_CALORIES = 1200; // never go below this
const MAX_DEFICIT_RATIO = 0.25; // never cut more than 25% of TDEE
const HEALTHY_BMI_MAX = 24.9;

/** BMI label + emoji — worded kindly, no "obese" language on the happy UI. */
function bmiBand(bmi: number): { label: string; emoji: string } {
  if (bmi < 18.5) return { label: 'a bit under', emoji: '🌱' };
  if (bmi < 25) return { label: 'just right', emoji: '🌿' };
  if (bmi < 30) return { label: 'a little above', emoji: '🌷' };
  return { label: 'above range', emoji: '🌸' };
}

export function computeBodyInsights(m: BodyMetrics): BodyInsights {
  const height = m.height_cm ?? null;
  const weight = m.weight_kg ?? null;
  const age = m.age ?? null;

  // Without height+weight we can still compute a target from goal alone? No —
  // keep it honest: no data, no insights (the UI shows a friendly setup CTA).
  if (!height || !weight || !age) {
    return {
      bmi: null,
      bmiLabel: '',
      bmiEmoji: '✨',
      bmr: null,
      tdee: null,
      targetCalories: null,
      weeklyRateKg: GOAL_RATES[m.goal] ?? 0,
      isHealthyDeficit: true,
      estimatedDays: null,
    };
  }

  const h = height / 100; // meters
  const bmi = weight / (h * h);
  const band = bmiBand(bmi);

  // Mifflin-St Jeor
  const base =
    10 * weight + 6.25 * height - 5 * age + (m.sex === 'male' ? 5 : -161);
  const bmr = Math.round(base);
  const tdee = Math.round(base * (ACTIVITY_MULTIPLIERS[m.activity_level] ?? 1.375));

  const rate = GOAL_RATES[m.goal] ?? 0;
  let target = tdee;
  if (rate > 0) {
    const dailyDeficit = Math.round((rate * KCAL_PER_KG) / 7);
    const cappedDeficit = Math.min(dailyDeficit, Math.round(tdee * MAX_DEFICIT_RATIO));
    target = Math.max(MIN_CALORIES, tdee - cappedDeficit);
  }

  const isHealthyDeficit = target >= MIN_CALORIES && tdee - target <= tdee * MAX_DEFICIT_RATIO + 1;

  // If she's already in the healthy BMI range and still wants to lose,
  // we estimate days to the lower edge — gently encouraging maintenance.
  let estimatedDays: number | null = null;
  if (rate > 0 && bmi > HEALTHY_BMI_MAX) {
    const healthyWeight = HEALTHY_BMI_MAX * h * h;
    const kgToLose = weight - healthyWeight;
    if (kgToLose > 0.5 && rate > 0) {
      estimatedDays = Math.round((kgToLose / rate) * 7);
    }
  }

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmiLabel: band.label,
    bmiEmoji: band.emoji,
    bmr,
    tdee,
    targetCalories: target,
    weeklyRateKg: rate,
    isHealthyDeficit,
    estimatedDays,
  };
}
