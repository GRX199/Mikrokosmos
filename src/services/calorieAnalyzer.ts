/**
 * AI food recognition seam (spec section 13).
 *
 * Phase 1 ships a mock implementation that returns realistic estimates so the
 * whole UI flow works end-to-end. Later, swap `analyzeFoodPhoto` for a real
 * vision API call — the signature and output shape stay identical.
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

const SAMPLE_ANALYSES: FoodAnalysis[] = [
  {
    mealName: 'Chicken Rice',
    totalCalories: 520,
    components: [
      { name: 'Rice', calories: 210 },
      { name: 'Chicken', calories: 230 },
      { name: 'Vegetables', calories: 80 },
    ],
    isEstimate: true,
  },
  {
    mealName: 'Noodle Soup',
    totalCalories: 450,
    components: [
      { name: 'Noodles', calories: 220 },
      { name: 'Broth', calories: 90 },
      { name: 'Egg & Toppings', calories: 140 },
    ],
    isEstimate: true,
  },
  {
    mealName: 'Salad Bowl',
    totalCalories: 330,
    components: [
      { name: 'Greens', calories: 60 },
      { name: 'Protein', calories: 170 },
      { name: 'Dressing', calories: 100 },
    ],
    isEstimate: true,
  },
  {
    mealName: 'Toast & Egg',
    totalCalories: 380,
    components: [
      { name: 'Toast', calories: 160 },
      { name: 'Egg', calories: 140 },
      { name: 'Butter / Spread', calories: 80 },
    ],
    isEstimate: true,
  },
];

/**
 * Pretend to analyze a photo. The `imageUri` is accepted so the real API can
 * use it later; today we return a varied realistic sample.
 */
export async function analyzeFoodPhoto(imageUri: string): Promise<FoodAnalysis> {
  // Simulate network/model latency so the UI shows its analyzing state.
  await new Promise((resolve) => setTimeout(resolve, 900));
  const pick = SAMPLE_ANALYSES[Math.floor(Math.random() * SAMPLE_ANALYSES.length)];
  // Avoid an unused-parameter lint once a real API replaces this mock.
  void imageUri;
  return pick;
}
