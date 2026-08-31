/**
 * Mikrokosmos domain models.
 * Field names match the Supabase tables (snake_case) so repository mapping
 * stays trivial; UI layers can format as needed.
 */

export type UserThemeKey = 'lilac' | 'sky' | 'pink';

export type Mood = 'sleepy' | 'okay' | 'good' | 'amazing' | 'not_my_day';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type TrendStatus = 'idea' | 'planned' | 'doing' | 'done';

export type Visibility = 'only_me' | 'friends';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  emoji: string;
  theme: UserThemeKey;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  wake_up_time?: string | null; // HH:mm
  mood: Mood;
  created_at?: string;
}

export interface Meal {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  meal_name: string;
  calories?: number | null;
  image_url?: string | null;
  notes?: string | null;
  meal_time: string; // HH:mm
  created_at?: string;
}

export interface WaterLog {
  user_id: string;
  date: string;
  glasses: number;
}

export interface StepLog {
  user_id: string;
  date: string;
  steps: number;
}

export interface Goals {
  user_id: string;
  calorie_goal: number;
  water_goal: number;
  step_goal: number;
}

export type MessageType = 'text' | 'image';

export interface ChatMessage {
  id: string;
  sender_id?: string | null; // null when Miko (bot) speaks
  message: string;
  message_type: MessageType;
  media_url?: string | null;
  reply_to?: string | null;
  is_bot: boolean;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface Trend {
  id: string;
  title: string;
  description?: string | null;
  url?: string | null;
  created_by?: string | null;
  status: TrendStatus;
  target_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TrendTask {
  id: string;
  trend_id: string;
  title: string;
  completed: boolean;
  completed_by?: string | null;
}

export interface Memory {
  id: string;
  title: string;
  caption: string;
  image_url?: string | null;
  trend_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type ActivityType =
  | 'checkin'
  | 'meal'
  | 'water_goal'
  | 'step_goal'
  | 'trend_added'
  | 'trend_done'
  | 'memory'
  | 'achievement'
  | 'streak'
  | 'miko';

export interface Activity {
  id: string;
  user_id?: string | null;
  type: ActivityType;
  text: string;
  reference_id?: string | null; // optional reference to related record (e.g., meal_id)
  is_bot: boolean;
  created_at: string;
}

export interface PrivacySettings {
  user_id: string;
  weight_visibility: Visibility;
  calories_visibility: Visibility;
  meals_visibility: Visibility;
}

// ---------- Body metrics (smart calorie targets, Phase 2) ----------

export type Sex = 'female' | 'male';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WeightGoal = 'maintain' | 'lose_025' | 'lose_05' | 'lose_075';

export interface BodyMetrics {
  user_id: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  age?: number | null;
  sex: Sex;
  activity_level: ActivityLevel;
  goal: WeightGoal;
  updated_at?: string;
}

/** Derived, client-side: BMI, BMR, TDEE and the gentle calorie target. */
export interface BodyInsights {
  bmi: number | null;
  bmiLabel: string;
  bmiEmoji: string;
  bmr: number | null;
  tdee: number | null;
  targetCalories: number | null;
  weeklyRateKg: number; // 0 for maintain
  isHealthyDeficit: boolean;
  estimatedDays: number | null; // days to reach a healthy BMI range at current rate
}

/** Everything the Home screen needs about one friend, for today. */
export interface FriendDayStatus {
  profile: Profile;
  checkin?: DailyCheckin | null;
  performance: number; // 0-100
}
