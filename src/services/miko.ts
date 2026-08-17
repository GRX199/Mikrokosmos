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
// Only gemini-flash-latest is confirmed working with this key format
const GEMINI_MODEL = 'gemini-flash-latest';

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
  if (!GEMINI_API_KEY) {
    console.log('[Miko] No Gemini API key configured');
    return null;
  }
  
  const convo = history
    .slice(-8)
    .map((h) => `${h.who}: ${h.text}`)
    .join('\n');
  const prompt = `${MIKO_SYSTEM}\n\nRecent chat:\n${convo}\n\n${senderName} just said: "${message}"\n\nReply as Miko:`;

  // Try up to 2 times in case of high demand (503)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 120 },
        }),
      });
      
      if (res.status === 503 && attempt === 0) {
        console.warn('[Miko] High demand, retrying in 1s...');
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Miko] ${GEMINI_MODEL} failed:`, res.status, errorText);
        return null;
      }
      
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text?.trim()) {
        console.log(`[Miko] Success:`, text.trim());
        return text.trim();
      }
      return null;
    } catch (err) {
      console.error(`[Miko] error:`, err);
      return null;
    }
  }
  return null;
}

/** Fallback reply when Gemini is unavailable. */
export function mikoFallbackReply(): string {
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}
