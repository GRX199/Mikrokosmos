/**
 * Fan bot — generates the fans who write letters to the members.
 * Uses Groq (same pool as Miko) to write the fan's question; falls back
 * to a curated list of handwritten letters when offline / no key.
 */

import type { Profile } from '@/models';
import type { AppLanguage } from '@/core/i18n/I18nProvider';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS = ['openai/gpt-oss-20b', 'groq/compound-mini'];

/** Handwritten fallback letters (used when no API key / offline). */
const FALLBACK_FANS: { name: string; emoji: string; question: Record<AppLanguage, string> }[] = [
  {
    name: 'Luna',
    emoji: '🌙',
    question: {
      en: "Namy! Your morning check-ins always make my day. What's the first thing you do after waking up?",
      id: 'Namy! Check-in pagimu selalu bikin hariku. Apa hal pertama yang kamu lakukan setelah bangun?',
    },
  },
  {
    name: 'Bintang',
    emoji: '⭐',
    question: {
      en: 'Kyra, you always seem so calm. What do you do when a day feels heavy?',
      id: 'Kyra, kamu kelihatannya selalu tenang. Kamu ngapain aja kalau harinya terasa berat?',
    },
  },
  {
    name: 'Awan',
    emoji: '☁️',
    question: {
      en: 'Jessy! Any song stuck in your head lately? I need new music 🎶',
      id: 'Jessy! Ada lagu yang nyangkut di kepalamu belakangan ini? Aku butuh musik baru 🎶',
    },
  },
  {
    name: 'Citra',
    emoji: '🪻',
    question: {
      en: 'What made you smile today? I want to smile along 🌷',
      id: 'Ada yang bikinmu tersenyum hari ini? Aku ikut senyum dong 🌷',
    },
  },
  {
    name: 'Rara',
    emoji: '🍓',
    question: {
      en: 'Do you have a small habit that changed your life? Tell me your secret!',
      id: 'Kamu punya kebiasaan kecil yang mengubah hidupmu? Kasih tahu rahasianya!',
    },
  },
  {
    name: 'Kirana',
    emoji: '✨',
    question: {
      en: "I've been having rough mornings lately. What helps you start the day gently?",
      id: 'Belakangan pagiku berantakan. Ada yang bikinmu mulai hari dengan lembut?',
    },
  },
  {
    name: 'Salsa',
    emoji: '🫧',
    question: {
      en: 'If your week had a color, what would it be? Mine is soft peach 🍑',
      id: 'Kalau minggumu punya warna, warna apa itu? Punyaku peach lembut 🍑',
    },
  },
  {
    name: 'Momo',
    emoji: '🐾',
    question: {
      en: 'What are you grateful for right now, this very moment?',
      id: 'Untuk apa kamu bersyukur sekarang, di momen ini?',
    },
  },
];

const FAN_SYSTEM = `You are a friendly fan writing a short letter to a member of "Mikrokosmos", a small three-member friend-group app (like a tiny idol group). The members are Namy (🪻, calm & dreamy), Kyra (☁️, cool & chill), and Jessy (🌸, bubbly & bright).

Write ONE short, warm fan letter (1-3 sentences) asking the member something about her day, her habits, self-care, food, mood, or friendship. Be cute and supportive, like a fan letter. Use a name common for the fan's language. Output STRICT JSON only: {"name": "<fan name>", "emoji": "<one emoji>", "question": "<letter text>"} . No markdown, no extra text.`;

const FAN_SYSTEM_ID = `\nLANGUAGE: Write the question in casual Bahasa Indonesia. Use an Indonesian fan name.`;

async function fetchWithTimeout(url: string, init: RequestInit, ms = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface FanLetterDraft {
  name: string;
  emoji: string;
  question: string;
}

/** Ask Groq for a fresh fan letter addressed to this member. */
export async function generateFanLetter(
  member: Profile,
  lang: AppLanguage = 'id',
  recentQuestions: string[] = []
): Promise<FanLetterDraft> {
  if (!GROQ_API_KEY) return fallbackLetter(lang);

  const context =
    recentQuestions.length > 0
      ? `\nRecent letters already sent (do NOT repeat them):\n${recentQuestions.slice(0, 6).map((q) => `- ${q}`).join('\n')}`
      : '';

  try {
    const res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODELS[0],
        temperature: 0.9,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              FAN_SYSTEM +
              (lang === 'id' ? FAN_SYSTEM_ID : '') +
              `\nThe member receiving this letter is ${member.display_name}.` +
              context,
          },
          { role: 'user', content: 'Write the fan letter now.' },
        ],
      }),
    });
    if (!res.ok) return fallbackLetter(lang);
    const json = await res.json();
    let raw = String(json.choices?.[0]?.message?.content ?? '').trim();
    // strip markdown fences if the model wraps JSON
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const draft = JSON.parse(raw) as FanLetterDraft;
    if (!draft.question || !draft.name) return fallbackLetter(lang);
    return {
      name: String(draft.name).slice(0, 24),
      emoji: String(draft.emoji || '💌').slice(0, 4),
      question: String(draft.question).slice(0, 400),
    };
  } catch {
    return fallbackLetter(lang);
  }
}

function fallbackLetter(lang: AppLanguage): FanLetterDraft {
  const fan = FALLBACK_FANS[Math.floor(Math.random() * FALLBACK_FANS.length)];
  return { name: fan.name, emoji: fan.emoji, question: fan.question[lang] ?? fan.question.id };
}
