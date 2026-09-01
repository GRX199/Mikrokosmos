import type { Profile } from '@/models';
import type { AppLanguage } from '@/core/i18n/I18nProvider';

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
  lines: Partial<Record<AppLanguage, ((name: string) => string)[]>> & { en: ((name: string) => string)[] };
}

const RULES: MikoRule[] = [
  {
    event: 'goal_completed',
    lines: {
      en: [
        (n) => `BREAKING NEWS 🚨 ${n} completed a daily goal. Historic moment for Mikrokosmos.`,
        (n) => `${n} just crushed a goal. The universe is impressed ✨`,
      ],
      id: [
        (n) => `BERITA TERBARU 🚨 ${n} menyelesaikan satu tujuan hari ini. Momen bersejarah untuk Mikrokosmos.`,
        (n) => `${n} baru saja menuntaskan satu target. Semesta terkesan ✨`,
      ],
    },
  },
  {
    event: 'new_streak',
    lines: {
      en: [
        (n) => `${n} is on a streak 🔥 Someone stop them (don't).`,
        (n) => `Streak unlocked by ${n}. Consistency queen behavior 👑`,
      ],
      id: [
        (n) => `${n} sedang on fire 🔥 Jangan dihentikan (purapura saja).`,
        (n) => `Streak terbuka oleh ${n}. Ratu konsisten sejati 👑`,
      ],
    },
  },
  {
    event: 'meal_added',
    lines: {
      en: [
        (n) => `${n} logged a meal. Fueling the friendship 🍱`,
        (n) => `${n} ate something and told us about it. We approve 🥹`,
      ],
      id: [
        (n) => `${n} mencatat makanannya. Mengisi energi persahabatan 🍱`,
        (n) => `${n} makan lalu bercerita. Kami setujui 🥹`,
      ],
    },
  },
  {
    event: 'trend_completed',
    lines: {
      en: [
        (n) => `${n} finished a trend! This is what peak performance looks like 💅`,
        () => `A trend has been conquered. Mikrokosmos celebrates 🎉`,
      ],
      id: [
        (n) => `${n} menyelesaikan sebuah tren! Inilah wujud performa terbaik 💅`,
        () => `Satu tren telah ditaklukkan. Mikrokosmos ikut merayakan 🎉`,
      ],
    },
  },
  {
    event: 'all_checked_in',
    lines: {
      en: [
        () => `All three of you checked in today. The trio is COMPLETE 🌌`,
        () => `Full house! Everyone started their day together 🥹✨`,
      ],
      id: [
        () => `Kalian bertiga sudah check-in hari ini. Trio itu LENGKAP 🌌`,
        () => `Rumah penuh! Semua memulai hari bersama-sama 🥹✨`,
      ],
    },
  },
  {
    event: 'group_progress',
    lines: {
      en: [
        () => `Group progress is soaring today. I'm proud 😭`,
        () => `This universe is thriving. Keep glowing ✨`,
      ],
      id: [
        () => `Progres grup melonjak hari ini. Aku bangga 😭`,
        () => `Semesta ini tumbuh subur. Tetap bersinar ✨`,
      ],
    },
  },
  {
    event: 'checkin_early',
    lines: {
      en: [(n) => `${n} checked in bright and early. Rise and shine behavior ☀️`],
      id: [(n) => `${n} check-in dari pagi buta. Semangat pagi sejati ☀️`],
    },
  },
];

/** Pick a playful Miko line for an event (locale-aware). */
export function mikoLine(event: MikoEvent, profile?: Profile | null, lang: AppLanguage = 'en'): string {
  const rule = RULES.find((r) => r.event === event);
  if (!rule) return '✨';
  const name = profile?.display_name ?? 'Someone';
  const pool = rule.lines[lang] ?? rule.lines.en;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return line(name);
}

// ---------- AI-powered chat reply (spec section 20) ----------

// Groq (primary) — free tier, super fast LPU inference.
// Model chain: providers deprecate models without notice (llama-3.1-8b was
// removed Aug 2026), so we try in order and cache the first that answers.
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'groq/compound-mini'];
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
let groqModelCache: string | null = null;
// Gemini (fallback for vision only — food photo analysis)
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'];
let geminiModelCache: string | null = null;

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

/** Extra directive appended when the app language is Indonesian. */
const MIKO_INDONESIAN_DIRECTIVE = `\nLANGUAGE: The app language is Indonesian. ALWAYS reply in casual Bahasa Indonesia (boleh slang: gengs, bestie, guys). Keep the same warm playful tone.`;

const FALLBACK_REPLIES: Record<AppLanguage, string[]> = {
  en: [
    '✨ The universe heard you!',
    'Sending good vibes to the trio 🌌',
    'Miko approves this message 💫',
    'Keep glowing, Mikrokosmos ✨',
    'The universe is proud of you all 🥹',
  ],
  id: [
    '✨ Semesta mendengarmu!',
    'Mengirim vibes baik ke trio 🌌',
    'Miko menyetujui pesan ini 💫',
    'Tetap bersinar, Mikrokosmos ✨',
    'Semesta bangga pada kalian 🥹',
  ],
};

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

/** Get a user-friendly message when quota is exceeded (locale-aware). */
export function getQuotaExceededMessage(lang: AppLanguage = 'en'): string {
  const remainingSeconds = Math.ceil((quotaExceededUntil - Date.now()) / 1000);
  const minutes = Math.ceil(remainingSeconds / 60);
  if (lang === 'id') {
    if (minutes >= 60) {
      const hours = Math.ceil(minutes / 60);
      return `🌌 Miko sedang istirahat (batas harian tercapai). Dia kembali dalam ${hours} jam! Coba lagi nanti ✨`;
    }
    return `🌌 Miko rehat sebentar (batas tercapai). Kembali dalam ~${minutes} menit ✨`;
  }
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
  history: { who: string; text: string }[],
  lang: AppLanguage = 'en'
): Promise<string | null> {
  const convo = history
    .slice(-8)
    .map((h) => `${h.who}: ${h.text}`)
    .join('\n');

  // Try Groq first (much higher quota, faster)
  if (GROQ_API_KEY) {
    const groqReply = await askGroq(message, senderName, convo, lang);
    if (groqReply) return groqReply;
  }

  // Fallback to Gemini if Groq fails or no key
  if (GEMINI_API_KEY) {
    return askGemini(message, senderName, convo, lang);
  }

  if (!GROQ_API_KEY && !GEMINI_API_KEY) {
    console.log('[Miko] No API key configured (need EXPO_PUBLIC_GROQ_API_KEY or EXPO_PUBLIC_GEMINI_API_KEY)');
  }
  return null;
}

// ---------- Groq (OpenAI-compatible) ----------

// Shared fetch plumbing: hard timeout so a hung provider can never freeze Miko.
const REQUEST_TIMEOUT_MS = 20_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

async function askGroq(
  message: string,
  senderName: string,
  convo: string,
  lang: AppLanguage = 'en'
): Promise<string | null> {
  const systemPrompt = lang === 'id' ? MIKO_SYSTEM + MIKO_INDONESIAN_DIRECTIVE : MIKO_SYSTEM;
  const call = async (
    model: string
  ): Promise<{ text: string | null; retryable: boolean; modelDead: boolean }> => {
    try {
      const res = await fetchWithTimeout(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Recent chat:\n${convo}\n\n${senderName} just said: "${message}"\n\nReply as Miko:` },
          ],
          temperature: 0.8,
          max_completion_tokens: 512,
        }),
      });
      if (!res.ok) {
        // 404 = model decommissioned -> try the next model in the chain.
        if (res.status === 404) return { text: null, retryable: false, modelDead: true };
        if (isRetryable(res.status)) return { text: null, retryable: true, modelDead: false };
        console.error('[Miko] Groq rejected:', res.status, await res.text().catch(() => ''));
        return { text: null, retryable: false, modelDead: false };
      }
      const data = await res.json();
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      return {
        text: text?.trim() ? text.trim().slice(0, 600) : null,
        retryable: false,
        modelDead: false,
      };
    } catch (err) {
      console.warn('[Miko] Groq network error:', err instanceof Error ? err.message : err);
      return { text: null, retryable: true, modelDead: false };
    }
  };

  // Cached working model first, then the rest of the chain.
  const chain = groqModelCache
    ? [groqModelCache, ...GROQ_MODELS.filter((m) => m !== groqModelCache)]
    : GROQ_MODELS;
  for (const model of chain) {
    let result = await call(model);
    if (!result.text && result.retryable) {
      await sleep(1200);
      result = await call(model);
    }
    if (result.text) {
      groqModelCache = model;
      return result.text;
    }
    if (!result.modelDead && !result.retryable) return null; // hard failure (auth etc.)
    // modelDead or still retryable-failed: fall through to the next model
  }
  return null;
}

// ---------- Gemini (fallback) ----------

async function askGemini(
  message: string,
  senderName: string,
  convo: string,
  lang: AppLanguage = 'en'
): Promise<string | null> {
  if (isQuotaExceeded()) {
    console.warn('[Miko] Gemini quota cooldown active');
    return null;
  }

  const systemPrompt = lang === 'id' ? MIKO_SYSTEM + MIKO_INDONESIAN_DIRECTIVE : MIKO_SYSTEM;
  const prompt = `${systemPrompt}\n\nRecent chat:\n${convo}\n\n${senderName} just said: "${message}"\n\nReply as Miko:`;

  // Chain: gemini-3.6-flash (current) -> gemini-flash-latest (alias).
  const chain = geminiModelCache
    ? [geminiModelCache, ...GEMINI_MODELS.filter((m) => m !== geminiModelCache)]
    : GEMINI_MODELS;
  for (const model of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetchWithTimeout(url, {
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

        // 404 = decommissioned model -> next in chain; 503 overload -> retry.
        if (res.status === 404) break;
        if (isRetryable(res.status) && attempt === 0) {
          await sleep(1200);
          continue;
        }

        if (!res.ok) return null;
        const data = await res.json();
        const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const clean = text?.trim();
        if (clean) {
          geminiModelCache = model;
          return clean.slice(0, 600);
        }
        break;
      } catch {
        if (attempt === 0) continue;
        break;
      }
    }
  }
  return null;
}

/** Fallback reply when both providers are unavailable (locale-aware). */
export function mikoFallbackReply(lang: AppLanguage = 'en'): string {
  const pool = FALLBACK_REPLIES[lang] ?? FALLBACK_REPLIES.en;
  return pool[Math.floor(Math.random() * pool.length)];
}
