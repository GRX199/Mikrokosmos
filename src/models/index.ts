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

/** Everything the Home screen needs about one friend, for today. */
export interface FriendDayStatus {
  profile: Profile;
  checkin?: DailyCheckin | null;
  performance: number; // 0-100
}
