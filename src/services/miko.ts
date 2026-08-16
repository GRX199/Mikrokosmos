import type { Profile } from '@/models';

/**
 * Miko — the group's biggest fan (spec section 20).
 *
 * MVP uses event-based rules: each app event maps to a playful line.
 * The `MikoRule` shape is deliberately small so Phase 3 can replace
 * `pickLine` with an LLM call without touching callers.
 */

export type MikoEvent =
  | 'goal_completed'
  | 'new_streak'
  | 'meal_added'
  | 'trend_completed'
  | 'all_checked_in'
  | 'group_progress'
  | 'checkin_early';

interface MikoRule {
  event: MikoEvent;
  lines: ((name: string) => string)[];
}

const RULES: MikoRule[] = [
  {
    event: 'goal_completed',
    lines: [
      (n) => `BREAKING NEWS 🚨 ${n} completed a daily goal. Historic moment for Mikrokosmos.`,
      (n) => `${n} just crushed a goal. The universe is impressed ✨`,
    ],
  },
  {
    event: 'new_streak',
    lines: [
      (n) => `${n} is on a streak 🔥 Someone stop them (don't).`,
      (n) => `Streak unlocked by ${n}. Consistency queen behavior 👑`,
    ],
  },
  {
    event: 'meal_added',
    lines: [
      (n) => `${n} logged a meal. Fueling the friendship 🍱`,
      (n) => `${n} ate something and told us about it. We approve 🥹`,
    ],
  },
  {
    event: 'trend_completed',
    lines: [
      (n) => `${n} finished a trend! This is what peak performance looks like 💅`,
      () => `A trend has been conquered. Mikrokosmos celebrates 🎉`,
    ],
  },
  {
    event: 'all_checked_in',
    lines: [
      () => `All three of you checked in today. The trio is COMPLETE 🌌`,
      () => `Full house! Everyone started their day together 🥹✨`,
    ],
  },
  {
    event: 'group_progress',
    lines: [
      () => `Group progress is soaring today. I'm proud 😭`,
      () => `This universe is thriving. Keep glowing ✨`,
    ],
  },
  {
    event: 'checkin_early',
    lines: [
      (n) => `${n} checked in bright and early. Rise and shine behavior ☀️`,
    ],
  },
];

/** Pick a playful Miko line for an event. */
export function mikoLine(event: MikoEvent, profile?: Profile | null): string {
  const rule = RULES.find((r) => r.event === event);
  if (!rule) return '✨';
  const name = profile?.display_name ?? 'Someone';
  const line = rule.lines[Math.floor(Math.random() * rule.lines.length)];
  return line(name);
}

// ---------- AI-powered chat reply (spec section 20) ----------

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const MIKO_SYSTEM = `You are Miko, the warm and playful mascot of Mikrokosmos — a private app for 3 best friends (Namy, Kyra, Jessy). You are their biggest fan. Reply in the same language as the user (Indonesian slang is welcome). Keep replies to 1-2 short sentences max, playful, with at most 1 emoji. Always body-positive: never shame food, weight, or calories — food is fuel and joy. Never invent facts about the friends you don't know.`;

const FALLBACK_REPLIES = [
  '✨ The universe heard you!',
  'Sending good vibes to the trio 🌌',
  'Miko approves this message 💫',
  'Keep glowing, Mikrokosmos ✨',
  'The universe is proud of you all 🥹',
];

/** AI reply when Miko is mentioned in chat. Returns null without a Gemini key. */
export async function askMiko(
  message: string,
  senderName: string,
  history: { who: string; text: string }[]
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const convo = history
      .slice(-8)
      .map((h) => `${h.who}: ${h.text}`)
      .join('\n');
    const prompt = `${MIKO_SYSTEM}\n\nRecent chat:\n${convo}\n\n${senderName} just said: "${message}"\n\nReply as Miko:`;
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 120 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

/** Fallback reply when Gemini is unavailable. */
export function mikoFallbackReply(): string {
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}
