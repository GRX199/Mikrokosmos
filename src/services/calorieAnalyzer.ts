/**
 * AI-powered food recognition (spec section 13).
 *
 * With EXPO_PUBLIC_GEMINI_API_KEY: uses Gemini 2.0 Flash (vision for photos,
 * text for names) for real calorie estimation.
 * Without the key: falls back to an offline database of common foods so the
 * whole UI flow works end-to-end everywhere.
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
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-flash-latest';

// Groq for text-based estimation (much higher free quota)
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ---------- Gemini vision: photo → calorie estimate ----------

const PHOTO_PROMPT = `You are a nutrition assistant. Analyze the food in this photo and estimate calories.
Respond ONLY with valid JSON in this exact shape (no markdown, no commentary):
{"mealName": "short descriptive name", "totalCalories": 450, "components": [{"name": "Rice", "calories": 210}, {"name": "Chicken", "calories": 240}]}
Use typical portion sizes. Be positive — never mention dieting or judgment. Round calories to the nearest 10.`;

async function callGeminiVision(base64: string): Promise<FoodAnalysis | null> {
  if (!GEMINI_API_KEY || !base64) return null;
  
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
      if (res.status === 503 && attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      const parsed = JSON.parse(text);
      return normalizeAnalysis(parsed);
    } catch {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ---------- Groq text: food name → calorie estimate (primary) ----------

const NAME_PROMPT = (name: string) => `You are a nutrition assistant. Estimate the calories for this food: "${name}".
Respond ONLY with valid JSON (no markdown, no commentary):
{"mealName": "${name}", "totalCalories": 450, "components": [{"name": "Component", "calories": 200}]}
Use typical portion sizes. Be positive — never mention dieting or judgment. Round calories to the nearest 10.`;

async function callGroqText(name: string): Promise<FoodAnalysis | null> {
  if (!GROQ_API_KEY) {
    console.warn('[CalorieAnalyzer] No Groq API key');
    return null;
  }
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
          { role: 'system', content: 'You are a nutrition assistant. Always respond with valid JSON only, no markdown.' },
          { role: 'user', content: NAME_PROMPT(name) },
        ],
        temperature: 0.3,
        max_completion_tokens: 256,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[CalorieAnalyzer] Groq failed:', res.status, errorText);
      return null;
    }
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return normalizeAnalysis(parsed);
  } catch (err) {
    console.error('[CalorieAnalyzer] Groq error:', err);
    return null;
  }
}

// ---------- Gemini text: food name → calorie estimate (fallback) ----------

async function callGeminiText(name: string): Promise<FoodAnalysis | null> {
  if (!GEMINI_API_KEY) return null;
  
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
          contents: [{ parts: [{ text: NAME_PROMPT(name) }] }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.3 },
        }),
      });
      if (res.status === 503 && attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      const parsed = JSON.parse(text);
      return normalizeAnalysis(parsed);
    } catch {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

function normalizeAnalysis(raw: unknown): FoodAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const mealName = typeof r.mealName === 'string' ? r.mealName : 'Meal';
  const totalCalories = typeof r.totalCalories === 'number' ? Math.round(r.totalCalories / 10) * 10 : 0;
  const components: CalorieComponent[] = [];
  if (Array.isArray(r.components)) {
    for (const c of r.components) {
      if (c && typeof c === 'object' && typeof (c as any).name === 'string' && typeof (c as any).calories === 'number') {
        components.push({ name: (c as any).name, calories: Math.round((c as any).calories) });
      }
    }
  }
  if (!components.length) components.push({ name: 'Estimated', calories: totalCalories || 200 });
  return { mealName, totalCalories: totalCalories || components.reduce((s, c) => s + c.calories, 0), components, isEstimate: true };
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
  ['toast', 160, [['Toast', 120], ['Butter', 40]]],
  ['toast & egg', 300, [['Toast', 120], ['Egg', 140], ['Butter', 40]]],
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

function estimateFromLocalDB(name: string): FoodAnalysis | null {
  const input = name.toLowerCase().trim();
  if (!input) return null;

  // Exact match first, then longest-key-contained-in-input.
  let best: [string, number, [string, number][]] | null = null;
  let bestKeyLen = 0;
  for (const entry of FOOD_DB) {
    const key = entry[0];
    if (input === key || input.includes(key)) {
      if (key.length > bestKeyLen) {
        best = entry;
        bestKeyLen = key.length;
      }
    }
  }
  // Also check if input is contained in any key (e.g. "nasi" → "nasi goreng").
  if (!best) {
    for (const entry of FOOD_DB) {
      if (entry[0].includes(input) && input.length >= 3) {
        if (entry[0].length > bestKeyLen) {
          best = entry;
          bestKeyLen = entry[0].length;
        }
      }
    }
  }
  if (!best) return null;
  const [, kcal, parts] = best;
  return {
    mealName: parts.map(([n]) => n).join(' & '),
    totalCalories: kcal,
    components: parts.map(([n, c]) => ({ name: n, calories: c })),
    isEstimate: true,
  };
}

// ---------- Public API ----------

/**
 * Analyze a food photo using Gemini vision (20 req/day free).
 * When quota is exceeded, returns null.
 */
export async function analyzeFoodPhoto(
  _imageUri: string,
  base64?: string | null
): Promise<FoodAnalysis | null> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return callGeminiVision(base64 ?? '');
}

/**
 * Estimate calories from a food name.
 * Tries the local DB first (instant), then Gemini if available.
 * Returns null if nothing matches.
 */
export async function estimateFoodByName(name: string): Promise<FoodAnalysis | null> {
  // 1. Try local DB first (instant, no API cost)
  const local = estimateFromLocalDB(name);
  if (local) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return local;
  }
  // 2. Try Groq (fast, high quota)
  const groqResult = await callGroqText(name);
  if (groqResult) return groqResult;
  // 3. Fallback to Gemini
  return callGeminiText(name);
}
