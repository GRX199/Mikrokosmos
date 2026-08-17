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

// Groq (primary) — free tier: ~14,400 req/day, super fast LPU inference
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_MODEL = 'mixtral-8x7b-32768';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Gemini (fallback for vision only — food photo analysis)
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-flash-latest';

const MIKO_SYSTEM = `You are Miko, a warm and playful AI assistant for Mikrokosmos — a private app for 3 best friends.

ROLE: You are their supportive friend who gives helpful, practical advice.

STYLE:
- Reply in the same language as the user (Indonesian or English)
- Use casual, friendly tone (Indonesian slang OK: gengs, bestie, guys)
- Max 1-2 emojis per message
- Be body-positive: never shame food or weight

PRIORITY: Answer the question helpfully. Be useful first, cute second.

EXAMPLES:
User: "miko, saranin makan siang"
You: "Coba ayam geprek sama nasi hangat, gengs! Proteinnya bikin kenyang lebih lama 🍗"

User: "rekomendasi makanan sehat dong"
You: "Salad bowl dengan quinoa, ayam grilled, dan alpukat itu enak dan balanced, bestie! 🥗"

Never make up facts about the users. Focus on giving real, actionable answers.`;

const FALLBACK_REPLIES = [
  '✨ The universe heard you!',
  'Sending good vibes to the trio 🌌',
  'Miko approves this message 💫',
  'Keep glowing, Mikrokosmos ✨',
  'The universe is proud of you all 🥹',
];

// Track quota exceeded to avoid spamming retries
let quotaExceededUntil = 0;

/** Check if we're currently in a quota cooldown period. */
export function isQuotaExceeded(): boolean {
  return Date.now() < quotaExceededUntil;
}

/** Mark quota as exceeded for the given duration in seconds. */
function setQuotaExceeded(seconds: number): void {
  quotaExceededUntil = Date.now() + seconds * 1000;
  console.warn(`[Miko] Quota exceeded, cooldown for ${seconds}s`);
}

/** Get a user-friendly message when quota is exceeded. */
export function getQuotaExceededMessage(): string {
  const remainingSeconds = Math.ceil((quotaExceededUntil - Date.now()) / 1000);
  const minutes = Math.ceil(remainingSeconds / 60);
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60);
    return `🌌 Miko is resting now (daily limit reached). She'll be back in ${hours}h! Try again later ✨`;
  }
  return `🌌 Miko is taking a short break (limit reached). Back in ~${minutes}min ✨`;
}

/** AI reply when Miko is mentioned in chat. Uses Groq (primary) or Gemini (fallback). */
export async function askMiko(
  message: string,
  senderName: string,
  history: { who: string; text: string }[]
): Promise<string | null> {
  const convo = history
    .slice(-8)
    .map((h) => `${h.who}: ${h.text}`)
    .join('\n');

  // Try Groq first (much higher quota, faster)
  if (GROQ_API_KEY) {
    const groqReply = await askGroq(message, senderName, convo);
    if (groqReply) return groqReply;
  }

  // Fallback to Gemini if Groq fails or no key
  if (GEMINI_API_KEY) {
    return askGemini(message, senderName, convo);
  }

  if (!GROQ_API_KEY && !GEMINI_API_KEY) {
    console.log('[Miko] No API key configured (need EXPO_PUBLIC_GROQ_API_KEY or EXPO_PUBLIC_GEMINI_API_KEY)');
  }
  return null;
}

// ---------- Groq (OpenAI-compatible) ----------

async function askGroq(
  message: string,
  senderName: string,
  convo: string
): Promise<string | null> {
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: MIKO_SYSTEM },
          { role: 'user', content: `Recent chat:\n${convo}\n\n${senderName} just said: "${message}"\n\nReply as Miko:` },
        ],
        temperature: 0.8,
        max_completion_tokens: 256,
      }),
    });

    if (res.status === 429) {
      console.warn('[Miko] Groq rate limited');
      return null;
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Miko] Groq failed:', res.status, errorText);
      return null;
    }

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (text?.trim()) {
      console.log('[Miko] Groq reply:', text.trim());
      return text.trim();
    }
    return null;
  } catch (err) {
    console.error('[Miko] Groq error:', err);
    return null;
  }
}

// ---------- Gemini (fallback) ----------

async function askGemini(
  message: string,
  senderName: string,
  convo: string
): Promise<string | null> {
  if (isQuotaExceeded()) {
    console.warn('[Miko] Gemini quota cooldown active');
    return null;
  }

  const prompt = `${MIKO_SYSTEM}\n\nRecent chat:\n${convo}\n\n${senderName} just said: "${message}"\n\nReply as Miko:`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
        }),
      });

      if (res.status === 429) {
        const errorData = await res.json().catch(() => null);
        const retryInfo = errorData?.error?.details?.find(
          (d: any) => d['@type']?.includes('RetryInfo')
        );
        const retrySeconds = retryInfo?.retryDelay
          ? parseInt(retryInfo.retryDelay)
          : 60;
        setQuotaExceeded(retrySeconds || 60);
        return null;
      }

      if (res.status === 503 && attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (!res.ok) return null;
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text?.trim() ?? null;
    } catch {
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

/** Fallback reply when Gemini is unavailable. */
export function mikoFallbackReply(): string {
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}
