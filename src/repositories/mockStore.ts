import type {
  Activity,
  ChatMessage,
  DailyCheckin,
  Goals,
  Meal,
  PrivacySettings,
  Profile,
  Trend,
  TrendTask,
} from '@/models';
import { todayKey } from '@/core/utils/date';

/**
 * In-memory development store used ONLY when Supabase is not configured,
 * so every screen stays usable without a backend (spec section 53.9).
 * Shapes mirror the Supabase tables exactly.
 */

export const MOCK_PROFILES: Profile[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    username: 'namnamxyi',
    display_name: 'Namy',
    emoji: '🪻',
    theme: 'lilac',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    username: 'kyraawr',
    display_name: 'Kyra',
    emoji: '☁️',
    theme: 'sky',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    username: 'xcjessyx',
    display_name: 'Jessy',
    emoji: '🌸',
    theme: 'pink',
  },
];

let idCounter = 100;
export function nextMockId(): string {
  idCounter += 1;
  return `mock-${idCounter}`;
}

const today = todayKey();
const yesterday = todayKey(-1);
const twoDaysAgo = todayKey(-2);

export const mockCheckins: DailyCheckin[] = [
  { id: 'c1', user_id: MOCK_PROFILES[1].id, date: today, wake_up_time: '08:14', mood: 'amazing' },
  { id: 'c2', user_id: MOCK_PROFILES[2].id, date: today, wake_up_time: '06:58', mood: 'good' },
  { id: 'c3', user_id: MOCK_PROFILES[0].id, date: yesterday, wake_up_time: '07:55', mood: 'okay' },
  { id: 'c4', user_id: MOCK_PROFILES[0].id, date: twoDaysAgo, wake_up_time: '08:20', mood: 'sleepy' },
  { id: 'c5', user_id: MOCK_PROFILES[1].id, date: yesterday, wake_up_time: '08:02', mood: 'good' },
  { id: 'c6', user_id: MOCK_PROFILES[2].id, date: yesterday, wake_up_time: '07:10', mood: 'sleepy' },
];

export const mockMeals: Meal[] = [
  {
    id: 'm1', user_id: MOCK_PROFILES[0].id, date: today, meal_type: 'breakfast',
    meal_name: 'Toast & Milk', calories: 390, meal_time: '08:21', notes: 'cozy morning',
  },
  {
    id: 'm2', user_id: MOCK_PROFILES[0].id, date: today, meal_type: 'lunch',
    meal_name: 'Chicken Rice', calories: 520, meal_time: '13:12',
  },
  {
    id: 'm3', user_id: MOCK_PROFILES[1].id, date: today, meal_type: 'breakfast',
    meal_name: 'Overnight Oats', calories: 340, meal_time: '07:50', notes: 'with berries 🍓',
  },
  {
    id: 'm4', user_id: MOCK_PROFILES[2].id, date: today, meal_type: 'snack',
    meal_name: 'Fruit Platter', calories: 150, meal_time: '10:40', notes: 'watermelon season',
  },
];

export const mockWater: Record<string, number> = {
  [`${MOCK_PROFILES[0].id}:${today}`]: 5,
  [`${MOCK_PROFILES[1].id}:${today}`]: 8,
  [`${MOCK_PROFILES[2].id}:${today}`]: 6,
};

export const mockSteps: Record<string, number> = {
  [`${MOCK_PROFILES[0].id}:${today}`]: 6421,
  [`${MOCK_PROFILES[1].id}:${today}`]: 7230,
  [`${MOCK_PROFILES[2].id}:${today}`]: 9102,
};

export const mockGoals: Record<string, Goals> = {
  [MOCK_PROFILES[0].id]: { user_id: MOCK_PROFILES[0].id, calorie_goal: 1600, water_goal: 8, step_goal: 8000 },
  [MOCK_PROFILES[1].id]: { user_id: MOCK_PROFILES[1].id, calorie_goal: 1500, water_goal: 8, step_goal: 7000 },
  [MOCK_PROFILES[2].id]: { user_id: MOCK_PROFILES[2].id, calorie_goal: 1600, water_goal: 8, step_goal: 8000 },
};

export const mockTrends: Trend[] = [
  {
    id: 't1', title: 'Picnic Day 🧺',
    description: 'Matching outfits + park picnic + way too many photos.',
    url: 'https://www.tiktok.com/tag/picnicaesthetic',
    created_by: MOCK_PROFILES[2].id, status: 'planned', target_date: todayKey(6),
  },
  {
    id: 't2', title: 'Viral Cloud Bread',
    description: 'Try the 3-ingredient cloud bread from TikTok.',
    url: 'https://www.youtube.com/results?search_query=cloud+bread',
    created_by: MOCK_PROFILES[1].id, status: 'idea',
  },
  {
    id: 't3', title: 'Matching Photo Dump',
    description: 'Same pose, three cities, one grid.',
    url: 'https://www.instagram.com/explore/tags/photodump/',
    created_by: MOCK_PROFILES[0].id, status: 'done', target_date: todayKey(-3),
  },
];

export const mockTrendParticipants: Record<string, string[]> = {
  t1: MOCK_PROFILES.map((p) => p.id),
  t2: MOCK_PROFILES.map((p) => p.id),
  t3: MOCK_PROFILES.map((p) => p.id),
};

export const mockTrendTasks: TrendTask[] = [
  { id: 'tt1', trend_id: 't1', title: 'Choose location', completed: true, completed_by: MOCK_PROFILES[0].id },
  { id: 'tt2', trend_id: 't1', title: 'Choose outfits', completed: true, completed_by: MOCK_PROFILES[2].id },
  { id: 'tt3', trend_id: 't1', title: 'Buy snacks', completed: false },
  { id: 'tt4', trend_id: 't1', title: 'Take photos', completed: false },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const mockMessages: ChatMessage[] = [
  {
    id: 'msg1', sender_id: null, is_bot: true, message_type: 'text',
    message: 'Welcome to Mikrokosmos 🌌 Your little universe is ready.',
    created_at: hoursAgo(3),
  },
  {
    id: 'msg2', sender_id: MOCK_PROFILES[0].id, is_bot: false, message_type: 'text',
    message: 'guys aku pengen makan seblak 😭', created_at: hoursAgo(2),
  },
  {
    id: 'msg3', sender_id: MOCK_PROFILES[2].id, is_bot: false, message_type: 'text',
    message: 'MAKAN AJA 😭', created_at: hoursAgo(1.9),
  },
  {
    id: 'msg4', sender_id: MOCK_PROFILES[1].id, is_bot: false, message_type: 'text',
    message: 'asal jangan satu panci 😭😭', created_at: hoursAgo(1.8),
  },
];

export const mockActivities: Activity[] = [
  {
    id: 'a1', user_id: MOCK_PROFILES[1].id, type: 'water_goal', is_bot: false,
    text: 'Kyra completed today\'s water goal 💧', created_at: hoursAgo(0.7),
  },
  {
    id: 'a2', user_id: MOCK_PROFILES[2].id, type: 'meal', is_bot: false,
    text: 'Jessy added a snack 🍉', created_at: hoursAgo(2),
  },
  {
    id: 'a3', user_id: MOCK_PROFILES[0].id, type: 'checkin', is_bot: false,
    text: 'Namy started her day ☀️', created_at: hoursAgo(3),
  },
];

export const mockPrivacy: Record<string, PrivacySettings> = {
  [MOCK_PROFILES[0].id]: {
    user_id: MOCK_PROFILES[0].id,
    weight_visibility: 'only_me', calories_visibility: 'friends', meals_visibility: 'friends',
  },
  [MOCK_PROFILES[1].id]: {
    user_id: MOCK_PROFILES[1].id,
    weight_visibility: 'only_me', calories_visibility: 'friends', meals_visibility: 'friends',
  },
  [MOCK_PROFILES[2].id]: {
    user_id: MOCK_PROFILES[2].id,
    weight_visibility: 'only_me', calories_visibility: 'friends', meals_visibility: 'friends',
  },
};
