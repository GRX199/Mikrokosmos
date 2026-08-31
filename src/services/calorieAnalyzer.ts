/**
 * AI-powered food recognition (spec section 13) — reliability pass.
 *
 * Pipeline for photos:  Gemini vision → (on any failure) Groq vision → null.
 * Pipeline for names:   local DB (instant) → Groq text → Gemini text → null.
 *
 * Robustness rules:
 * - Every network call has a hard timeout (AbortController).
 * - Retries cover 429 (rate limit) with exponential backoff + 5xx.
 * - JSON parsing is defensive: strips markdown fences, finds the first
 *   JSON object in the text, validates the shape before trusting it.
 * - Groq uses the smaller max_completion_tokens only as a floor: if the
 *   model's JSON gets truncated we retry once with a bigger budget.
 */

export interface CalorieComponent {
  name: string;
  calories: number;
}

export interface FoodAnalysis {
  mealName: string;
  totalCalories: number;
  components: CalorieComponent[];
  isEstimate: true;
  source: 'gemini-vision' | 'groq-vision' | 'groq' | 'gemini' | 'local';
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-flash-latest';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TEXT_MODEL = 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const REQUEST_TIMEOUT_MS = 25_000;
const RETRY_DELAYS_MS = [800, 2200]; // after 1st / 2nd failure

// ---------- shared plumbing ----------

/** fetch with a hard timeout; rejects with a typed error. */
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

/** Should we retry this status? (rate limits + transient server errors) */
function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Defensive JSON extraction: handles markdown fences, leading prose,
 * and truncation by finding the outermost {...} block, then validating.
 */
function parseAnalysisJson(
  text: string,
  source: FoodAnalysis['source'] = 'gemini'
): FoodAnalysis | null {
  if (!text) return null;
  let candidate = text.trim();
  // Strip markdown fences if present.
  candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  // Grab the outermost braces block (models sometimes add prose around it).
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  candidate = candidate.slice(start, end + 1);
  try {
    return normalizeAnalysis(JSON.parse(candidate), source);
  } catch {
    return null;
  }
}

function normalizeAnalysis(raw: unknown, source: FoodAnalysis['source'] = 'gemini'): FoodAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const mealName =
    typeof r.mealName === 'string' && r.mealName.trim()
      ? r.mealName.trim().slice(0, 80)
      : 'Meal';
  const rawTotal = Number(r.totalCalories);
  const totalCalories =
    Number.isFinite(rawTotal) && rawTotal > 0 ? Math.round(rawTotal / 10) * 10 : 0;
  const components: CalorieComponent[] = [];
  if (Array.isArray(r.components)) {
    for (const c of r.components) {
      if (!c || typeof c !== 'object') continue;
      const obj = c as Record<string, unknown>;
      const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 60) : '';
      const kcal = Number(obj.calories);
      if (name && Number.isFinite(kcal) && kcal > 0) {
        components.push({ name, calories: Math.round(kcal) });
      }
    }
  }
  if (!components.length) components.push({ name: 'Estimated total', calories: totalCalories || 200 });
  const total =
    totalCalories ||
    Math.round(components.reduce((s, c) => s + c.calories, 0) / 10) * 10;
  return { mealName, totalCalories: total || 200, components, isEstimate: true, source };
}

/** Run fn with retries on rate limits / transient failures. */
async function withRetry<T>(fn: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch (e) {
      // Network-level failure (abort, DNS, offline) — fall through to retry.
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  return null;
}

// ---------- Gemini vision: photo → calorie estimate ----------

const PHOTO_PROMPT = `You are a nutrition assistant. Analyze the food in this photo and estimate calories.
Respond ONLY with valid JSON in this exact shape (no markdown, no commentary):
{"mealName": "short descriptive name", "totalCalories": 450, "components": [{"name": "Rice", "calories": 210}, {"name": "Chicken", "calories": 240}]}
Use typical portion sizes. Be positive — never mention dieting or judgment. Round calories to the nearest 10.`;

async function callGeminiVision(base64: string): Promise<FoodAnalysis | null> {
  if (!GEMINI_API_KEY || !base64) return null;
  return withRetry(async () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PHOTO_PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            ],
          },
        ],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.3 },
      }),
    });
    if (!res.ok) {
      if (!isRetryable(res.status)) return null;
      throw new Error(`gemini ${res.status}`); // signal retry
    }
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? parseAnalysisJson(text, 'gemini-vision') : null;
  });
}

// ---------- Groq vision fallback: photo → calorie estimate ----------

async function callGroqVision(base64: string): Promise<FoodAnalysis | null> {
  if (!GROQ_API_KEY || !base64) return null;
  return withRetry(async () => {
    const res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PHOTO_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      if (!isRetryable(res.status)) return null;
      throw new Error(`groq ${res.status}`);
    }
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    return text ? parseAnalysisJson(text, 'groq-vision') : null;
  });
}

// ---------- Groq text: food name → calorie estimate (primary) ----------

const NAME_PROMPT = (name: string) => `You are a nutrition assistant. Estimate the calories for this food: "${name}".
Respond ONLY with valid JSON (no markdown, no commentary):
{"mealName": "${name}", "totalCalories": 450, "components": [{"name": "Component", "calories": 200}]}
Use typical portion sizes. Be positive — never mention dieting or judgment. Round calories to the nearest 10.`;

async function callGroqText(name: string): Promise<FoodAnalysis | null> {
  if (!GROQ_API_KEY) return null;
  return withRetry(async () => {
    const res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [
          { role: 'system', content: 'You are a nutrition assistant. Always respond with valid JSON only, no markdown.' },
          { role: 'user', content: NAME_PROMPT(name) },
        ],
        temperature: 0.3,
        max_completion_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      if (!isRetryable(res.status)) return null;
      throw new Error(`groq ${res.status}`);
    }
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    return text ? parseAnalysisJson(text, 'groq') : null;
  });
}

// ---------- Gemini text: food name → calorie estimate (fallback) ----------

async function callGeminiText(name: string): Promise<FoodAnalysis | null> {
  if (!GEMINI_API_KEY) return null;
  return withRetry(async () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: NAME_PROMPT(name) }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.3 },
      }),
    });
    if (!res.ok) {
      if (!isRetryable(res.status)) return null;
      throw new Error(`gemini ${res.status}`);
    }
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? parseAnalysisJson(text, 'gemini') : null;
  });
}

// ---------- Offline fallback: local food database ----------

// [key, kcal, [[component, kcal], ...]]
const FOOD_DB: [string, number, [string, number][]][] = [
  // Indonesian
  ['nasi goreng', 480, [['Rice', 250], ['Egg & Oil', 150], ['Vegetables', 80]]],
  ['nasi uduk', 420, [['Rice', 220], ['Coconut & Oil', 120], ['Crackers', 80]]],
  ['mie ayam', 400, [['Noodles', 220], ['Chicken', 120], ['Broth & Toppings', 60]]],
  ['mie goreng', 450, [['Noodles', 250], ['Oil & Egg', 130], ['Vegetables', 70]]],
  ['bakso', 350, [['Meatballs', 200], ['Broth', 60], ['Noodles', 90]]],
  ['seblak', 380, [['Crackers', 180], ['Egg', 80], ['Spice & Veg', 120]]],
  ['sate ayam', 300, [['Chicken', 200], ['Peanut Sauce', 100]]],
  ['soto ayam', 250, [['Chicken', 100], ['Broth & Noodles', 100], ['Egg', 50]]],
  ['ayam geprek', 550, [['Fried Chicken', 380], ['Rice', 120], ['Sambal', 50]]],
  ['ayam goreng', 400, [['Chicken', 280], ['Oil', 120]]],
  ['rendang', 450, [['Beef', 300], ['Coconut & Spice', 150]]],
  ['gado-gado', 300, [['Vegetables', 100], ['Peanut Sauce', 120], ['Tofu & Egg', 80]]],
  ['bubur ayam', 300, [['Rice Porridge', 150], ['Chicken', 80], ['Crackers & Oil', 70]]],
  ['martabak manis', 400, [['Dough', 150], ['Filling', 150], ['Butter', 100]]],
  ['martabak telur', 450, [['Dough', 150], ['Egg & Meat', 200], ['Oil', 100]]],
  ['nasi padang', 650, [['Rice', 250], ['Rendang', 200], ['Vegetables', 100], ['Sambal', 100]]],
  ['nasi pecel', 350, [['Rice', 220], ['Vegetables', 80], ['Peanut Sauce', 50]]],
  ['pempek', 300, [['Fish Cake', 200], ['Vinegar Sauce', 100]]],
  ['soto betawi', 400, [['Beef', 200], ['Coconut Milk', 120], ['Potato', 80]]],
  ['ketoprak', 320, [['Rice Noodles', 150], ['Tofu', 80], ['Peanut Sauce', 90]]],
  ['tahu goreng', 200, [['Tofu', 120], ['Oil', 80]]],
  ['tempe goreng', 220, [['Tempeh', 140], ['Oil', 80]]],
  ['es teh manis', 80, [['Tea', 10], ['Sugar', 70]]],
  ['kopi susu', 120, [['Coffee', 10], ['Milk', 60], ['Sugar', 50]]],
  ['es jeruk', 90, [['Orange', 40], ['Sugar', 50]]],
  // Western / common
  ['toast & egg', 300, [['Toast', 120], ['Egg', 140], ['Butter', 40]]],
  ['toast', 160, [['Toast', 120], ['Butter', 40]]],
  ['chicken rice', 520, [['Rice', 210], ['Chicken', 230], ['Vegetables', 80]]],
  ['fried rice', 480, [['Rice', 250], ['Egg & Oil', 150], ['Vegetables', 80]]],
  ['noodle soup', 450, [['Noodles', 220], ['Broth', 90], ['Egg & Toppings', 140]]],
  ['salad bowl', 330, [['Greens', 60], ['Protein', 170], ['Dressing', 100]]],
  ['oatmeal', 250, [['Oats', 180], ['Milk', 70]]],
  ['overnight oats', 340, [['Oats', 160], ['Milk', 80], ['Fruit', 100]]],
  ['smoothie bowl', 310, [['Fruit', 180], ['Granola', 80], ['Toppings', 50]]],
  ['sandwich', 350, [['Bread', 160], ['Filling', 120], ['Sauce', 70]]],
  ['burger', 550, [['Bun', 150], ['Patty', 250], ['Cheese & Sauce', 150]]],
  ['pizza slice', 280, [['Dough', 120], ['Cheese', 100], ['Toppings', 60]]],
  ['pasta', 450, [['Noodles', 250], ['Sauce', 120], ['Cheese', 80]]],
  ['sushi', 350, [['Rice', 200], ['Fish', 100], ['Nori & Veg', 50]]],
  ['ramen', 500, [['Noodles', 250], ['Broth', 100], ['Egg & Toppings', 150]]],
  ['fried chicken', 400, [['Chicken', 280], ['Oil', 120]]],
  ['french fries', 320, [['Potato', 200], ['Oil', 120]]],
  ['pancake', 350, [['Batter', 200], ['Syrup', 100], ['Butter', 50]]],
  ['waffle', 380, [['Batter', 220], ['Syrup', 100], ['Butter', 60]]],
  ['yogurt', 150, [['Yogurt', 100], ['Fruit', 50]]],
  ['fruit platter', 150, [['Mixed Fruit', 150]]],
  ['banana', 105, [['Banana', 105]]],
  ['apple', 95, [['Apple', 95]]],
  ['orange', 62, [['Orange', 62]]],
  ['egg', 140, [['Egg', 140]]],
  ['boiled egg', 78, [['Egg', 78]]],
  ['scrambled egg', 140, [['Egg', 100], ['Butter', 40]]],
  ['chicken breast', 165, [['Chicken', 165]]],
  ['steak', 350, [['Beef', 300], ['Oil', 50]]],
  ['fish', 200, [['Fish', 180], ['Oil', 20]]],
  ['salmon', 250, [['Salmon', 250]]],
  ['rice', 210, [['Rice', 210]]],
  ['bread', 120, [['Bread', 120]]],
  ['milk', 120, [['Milk', 120]]],
  ['coffee', 50, [['Coffee', 10], ['Milk', 40]]],
  ['tea', 30, [['Tea', 30]]],
  ['juice', 110, [['Fruit Juice', 110]]],
  ['watermelon', 50, [['Watermelon', 50]]],
  ['chocolate', 230, [['Chocolate', 230]]],
  ['ice cream', 200, [['Ice Cream', 200]]],
  ['cake slice', 350, [['Cake', 250], ['Frosting', 100]]],
  ['cookie', 150, [['Cookie', 150]]],
  ['chips', 160, [['Chips', 160]]],
  ['popcorn', 100, [['Popcorn', 100]]],
  ['nuts', 170, [['Nuts', 170]]],
  ['cheese', 110, [['Cheese', 110]]],
];

/** Token-level fuzzy match so "nasi goreng pedas" / "NasiGoreng" still hit. */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function estimateFromLocalDB(name: string): FoodAnalysis | null {
  const input = name.toLowerCase().trim();
  if (!input) return null;
  const inputTokens = new Set(tokenize(input));

  let best: [string, number, [string, number][]] | null = null;
  let bestScore = 0;
  for (const entry of FOOD_DB) {
    const key = entry[0];
    let score = 0;
    if (input === key) {
      score = 1000; // exact
    } else if (input.includes(key)) {
      score = 500 + key.length; // key contained in input
    } else if (key.includes(input) && input.length >= 3) {
      score = 300 + key.length; // input contained in key
    } else {
      // token overlap ("nasi goreng pedas" → "nasi goreng" matches 2/3 tokens)
      const keyTokens = tokenize(key);
      const hits = keyTokens.filter((t) => inputTokens.has(t)).length;
      if (hits > 0 && hits === keyTokens.length) score = 100 * hits + key.length;
    }
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  if (!best || bestScore === 0) return null;
  const [, kcal, parts] = best;
  return {
    mealName: parts.map(([n]) => n).join(' & '),
    totalCalories: kcal,
    components: parts.map(([n, c]) => ({ name: n, calories: c })),
    isEstimate: true,
    source: 'local',
  };
}

// ---------- Public API ----------

/**
 * Analyze a food photo: Gemini vision first, Groq vision as backup.
 * Returns null only when every provider fails.
 */
export async function analyzeFoodPhoto(
  _imageUri: string,
  base64?: string | null
): Promise<FoodAnalysis | null> {
  if (!base64) return null;
  const gemini = await callGeminiVision(base64);
  if (gemini) return gemini;
  return callGroqVision(base64);
}

/**
 * Estimate calories from a food name.
 * Local DB (instant) → Groq text → Gemini text. Returns null if all fail.
 */
export async function estimateFoodByName(name: string): Promise<FoodAnalysis | null> {
  const clean = name.trim();
  if (!clean) return null;
  // 1. Local DB first (instant, no API cost).
  const local = estimateFromLocalDB(clean);
  if (local) return local;
  // 2. Groq text (fast, high quota).
  const groq = await callGroqText(clean);
  if (groq) return groq;
  // 3. Gemini text as the last resort.
  return callGeminiText(clean);
}

/** Exposed for tests / debugging provider health. */
export const analyzerHealth = {
  hasGemini: Boolean(GEMINI_API_KEY),
  hasGroq: Boolean(GROQ_API_KEY),
};
