# Mikrokosmos — Developer Guide

> Comprehensive development guide for AI agents and human developers.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Environment Setup](#2-environment-setup)
3. [Supabase Configuration](#3-supabase-configuration)
4. [AI Integration](#4-ai-integration)
5. [Core Features](#5-core-features)
6. [Deployment](#6-deployment)
7. [Common Pitfalls](#7-common-pitfalls)
8. [Development Workflow](#8-development-workflow)

---

## 1. Project Overview

### Description

Mikrokosmos is a **private friendship app** for 3 best friends (Namy, Kyra, Jessy). It provides gentle daily check-ins, self-love tracking with positive wording only, a cozy group chat with AI bot "Miko", and shared "trends" the trio wants to try together.

**Core Philosophy**: No rankings, no competition, no negative labels — ever.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Expo SDK 57 (React Native + TypeScript) |
| **Navigation** | Expo Router (file-based routing) |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| **AI Providers** | Groq (primary LLM), Gemini (vision fallback) |
| **Styling** | React Native StyleSheet + custom theme system |
| **State** | React hooks + Supabase Realtime subscriptions |
| **Deployment** | Vercel (web), EAS Build (Android/iOS) |

### Project Structure

```
mikrokosmos/
├── src/
│   ├── app/                    # Expo Router screens (file-based routing)
│   │   ├── _layout.tsx         # Root layout: providers + navigation
│   │   ├── index.tsx           # Auth-based redirect
│   │   ├── login.tsx           # Username+password login
│   │   ├── (tabs)/             # Tab navigation
│   │   │   ├── index.tsx       # Home screen
│   │   │   ├── self-love.tsx   # Food diary, water, steps
│   │   │   ├── mikrokosmos.tsx # Group chat
│   │   │   ├── trends.tsx      # Shared trends list
│   │   │   └── me.tsx          # Profile & settings
│   │   ├── friend/[id].tsx     # Friend profile (privacy-aware)
│   │   └── trend/[id].tsx      # Trend detail + checklist
│   ├── components/             # Reusable UI components
│   │   ├── RoundedCard.tsx
│   │   ├── ProgressRing.tsx
│   │   ├── CosmicTabBar.tsx    # Floating pill navigation
│   │   └── ui/                 # Base UI primitives
│   ├── core/
│   │   ├── theme/              # ThemeProvider, colors, tokens
│   │   ├── services/           # Supabase client initialization
│   │   ├── constants/          # App-wide constants
│   │   └── utils/              # Date helpers, formatters
│   ├── features/
│   │   ├── auth/               # SessionProvider (auth context)
│   │   ├── home/               # Home screen components
│   │   │   ├── useHomeData.ts
│   │   │   ├── MorningCheckinModal.tsx
│   │   │   └── MealDetailModal.tsx
│   │   └── selfLove/           # Self-love screen components
│   │       └── AddMealModal.tsx
│   ├── models/                 # TypeScript interfaces (snake_case)
│   │   └── index.ts            # Profile, Meal, Activity, Message, etc.
│   ├── repositories/           # Data access layer
│   │   ├── profiles.ts
│   │   ├── meals.ts
│   │   ├── chat.ts
│   │   ├── activities.ts
│   │   └── storage.ts          # Image upload/URL resolution
│   ├── services/               # Business logic
│   │   ├── miko.ts             # AI chat bot (Groq + Gemini)
│   │   ├── calorieAnalyzer.ts  # Food recognition + calorie estimation
│   │   └── performanceScore.ts # 0-100 positive scoring
│   └── stores/                 # Client-side state stores
│       └── unreadChatStore.ts  # Singleton for unread message badge
├── supabase/
│   ├── schema.sql              # Database schema + RLS + Realtime
│   ├── seed.sql                # Development seed data
│   └── migrations/             # Incremental migrations
├── scripts/
│   └── setup-users.mjs         # Create 3 demo accounts via Auth API
├── .env.local                  # Local environment variables (gitignored)
├── eas.json                    # EAS Build configuration
└── package.json
```

---

## 2. Environment Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI (via npx)
- Supabase account (free tier)
- Groq API key (free tier)
- Gemini API key (free tier, optional)

### Installation

```bash
# Clone repository
git clone https://github.com/GRX199/Mikrokosmos.git
cd mikrokosmos

# Install dependencies
npm install
```

### Environment Variables

Create `.env.local` in project root:

```env
# Supabase (REQUIRED)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Groq AI (RECOMMENDED — primary LLM for chat + calorie estimation)
EXPO_PUBLIC_GROQ_API_KEY=gsk_your_groq_api_key

# Gemini AI (OPTIONAL — fallback for vision/photo analysis)
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

**Important**: Variables prefixed with `EXPO_PUBLIC_` are embedded into the client bundle at build time. After changing `.env.local`, restart the dev server.

### Running Development Server

```bash
# Web (recommended for development)
npm run web
# Opens at http://localhost:8081

# Mobile (Expo Go)
npm start
# Scan QR code with Expo Go app

# Android emulator
npm run android

# iOS simulator (macOS only)
npm run ios
```

### Demo Accounts

| Username | Password | Theme |
|----------|----------|-------|
| `namnamxyi` | (see scripts/setup-users.mjs) | Lilac 🪻 |
| `kyraawr` | (see scripts/setup-users.mjs) | Sky blue ☁️ |
| `xcjessyx` | (see scripts/setup-users.mjs) | Soft pink 🌸 |

Run `node scripts/setup-users.mjs` to create accounts. In Supabase Auth settings, **disable email confirmation** (addresses are synthetic: `username@mikrokosmos.app`).

---

## 3. Supabase Configuration

### Initial Setup

1. Create new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run `supabase/schema.sql` (creates tables, RLS policies, Realtime, Storage)
4. Run `supabase/seed.sql` (development data for last 3 days)
5. Run `node scripts/setup-users.mjs` (creates auth accounts + profiles)

### Database Schema

#### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles linked to auth.users | id, username, display_name, emoji, theme |
| `daily_checkins` | Morning check-in (1 per user per day) | user_id, date, wake_up_time, mood |
| `meals` | Food diary entries | user_id, date, meal_type, meal_name, calories, image_url |
| `water_logs` | Daily water intake (1 per user per day) | user_id, date, glasses |
| `step_logs` | Daily step count (1 per user per day) | user_id, date, steps |
| `goals` | Per-user performance goals | user_id, calorie_goal, water_goal, step_goal |
| `messages` | Group chat messages | sender_id, message, is_bot, reply_to |
| `message_reactions` | Emoji reactions on messages | message_id, user_id, emoji |
| `trends` | Shared trend ideas | title, status, created_by |
| `trend_tasks` | Checklist items within trends | trend_id, title, completed, completed_by |
| `activities` | Activity feed entries | user_id, type, text, reference_id, is_bot |
| `privacy_settings` | Per-user visibility preferences | user_id, weight_visibility, meals_visibility |

#### Key Relationships

```
profiles.id → auth.users.id (1:1, cascade delete)
meals.user_id → profiles.id
messages.sender_id → profiles.id (nullable for bot messages)
activities.reference_id → meals.id (optional, for meal detail modal)
```

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- **profiles**: All authenticated users can read; users can only update/insert their own
- **meals**: Friends can read only if owner's `meals_visibility = 'friends'`
- **messages**: All authenticated users can read and insert
- **activities**: All authenticated users can read; users insert their own (or bot messages with `user_id IS NULL`)

### Realtime Subscriptions

Tables published to `supabase_realtime`:
- `messages` — chat updates
- `message_reactions` — reaction updates
- `trend_tasks` — checklist sync
- `trends` — trend status changes
- `activities` — activity feed updates

**Usage in code**:
```typescript
import { subscribeToMessages } from '@/repositories/chat';

const unsubscribe = subscribeToMessages((incoming) => {
  // Handle new message
});
// Later: unsubscribe()
```

### Storage

Bucket: `mikrokosmos-media` (private)

- Upload: `storage.uploadImage(userId, imageUri, 'meals')`
- Resolve URL: `storage.resolveMediaUrl(path)` → signed URL

### Migrations

For schema changes after initial setup:

1. Create migration file in `supabase/migrations/`
2. Run in Supabase SQL Editor
3. Example: `ALTER TABLE activities ADD COLUMN reference_id uuid;`

---

## 4. AI Integration

### Provider Strategy

| Feature | Primary | Fallback | Notes |
|---------|---------|----------|-------|
| **Miko Chat** | Groq | Gemini | Text generation |
| **Food Name → Calories** | Local DB → Groq → Gemini | — | Name-based estimation |
| **Food Photo → Calories** | Gemini Vision | — | Photo analysis (20 req/day limit) |

### Groq Configuration

```typescript
// src/services/miko.ts, src/services/calorieAnalyzer.ts
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_MODEL = 'llama3-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
```

**Request format** (OpenAI-compatible):
```typescript
const res = await fetch(GROQ_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GROQ_API_KEY}`,
  },
  body: JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.8,
    max_completion_tokens: 256,
    response_format: { type: 'json_object' }, // For structured output
  }),
});
```

**Free tier**: ~14,400 requests/day (30/minute). Very generous.

### Gemini Configuration

```typescript
// src/services/miko.ts, src/services/calorieAnalyzer.ts
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-flash-latest';
```

**Request format**:
```typescript
const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-goog-api-key': GEMINI_API_KEY,  // IMPORTANT: Use header, NOT query param
  },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 1024,  // Must include thinking tokens!
    },
  }),
});
```

**Free tier**: 20 requests/day (very limited). Used only for vision (photo analysis).

### Miko Chat Bot

**System prompt** (`src/services/miko.ts`):
```typescript
const MIKO_SYSTEM = `You are Miko, a warm and playful AI assistant for Mikrokosmos — a private app for 3 best friends.

ROLE: You are their supportive friend who gives helpful, practical advice.

STYLE:
- Reply in the same language as the user (Indonesian or English)
- Use casual, friendly tone (Indonesian slang OK: gengs, bestie, guys)
- Max 1-2 emojis per message
- Be body-positive: never shame food or weight

PRIORITY: Answer the question helpfully. Be useful first, cute second.

Never make up facts about the users.`;
```

**Trigger**: User mentions "miko" in chat message.

**Fallback chain**:
1. Groq (primary) → if fails or no key
2. Gemini (fallback) → if fails or quota exceeded
3. Random playful fallback message

### Calorie Analyzer

**Food photo analysis** (`analyzeFoodPhoto`):
1. Gemini Vision → returns JSON with meal name, calories, components
2. If quota exceeded → returns null (user sees "try typing food name instead")

**Food name estimation** (`estimateFoodByName`):
1. Local offline database (instant, no API cost) — 60+ common foods
2. Groq text → if not in local DB
3. Gemini text → if Groq fails

**Local DB example**:
```typescript
['nasi goreng', 480, [['Rice', 250], ['Egg & Oil', 150], ['Vegetables', 80]]],
['ayam geprek', 550, [['Fried Chicken', 380], ['Rice', 120], ['Sambal', 50]]],
```

### Quota Management

**Gemini 429 handling** (`src/services/miko.ts`):
```typescript
let quotaExceededUntil = 0;

export function isQuotaExceeded(): boolean {
  return Date.now() < quotaExceededUntil;
}

function setQuotaExceeded(seconds: number): void {
  quotaExceededUntil = Date.now() + seconds * 1000;
}

export function getQuotaExceededMessage(): string {
  const minutes = Math.ceil((quotaExceededUntil - Date.now()) / 60000);
  return `🌌 Miko is resting now (daily limit reached). Back in ~${minutes}min ✨`;
}
```

---

## 5. Core Features

### Home Screen (`src/app/(tabs)/index.tsx`)

- Time-of-day greeting with user's theme colors
- Daily streak counter
- Friend status cards (mood, last check-in)
- Recent Activity feed (clickable items)
- Morning check-in modal (dismissible, 1 per day)

**Morning Check-in Modal** (`src/features/home/MorningCheckinModal.tsx`):
- Wake-up time selector (±15 min steps)
- 5 mood options (amazing, good, okay, sleepy, meh)
- Can be closed without submitting (X button)
- Opens automatically if user hasn't checked in today

### Self-Love Screen (`src/app/(tabs)/self-love.tsx`)

- Performance rings (calories, water, steps)
- Food diary with photo thumbnails
- Water glass tracker
- Manual step entry
- Performance score (0-100) with positive tiers

**Add Meal Modal** (`src/features/selfLove/AddMealModal.tsx`):
- Photo upload + AI analysis (Gemini Vision)
- Manual food name entry + calorie estimation
- Meal type (breakfast, lunch, dinner, snack)
- Notes field

### Mikrokosmos Chat (`src/app/(tabs)/mikrokosmos.tsx`)

- Real-time group chat (Supabase Realtime)
- Themed bubbles per sender
- Reply threads
- Image messages
- Tap reactions (❤️ 😂 😭 🥹 ✨)
- Unread message badge on tab bar
- Auto-scroll on new messages

**Miko bot messages**: `sender_id = null, is_bot = true`

**Realtime subscription**:
```typescript
useEffect(() => {
  const unsubscribe = subscribeToMessages((incoming) => {
    setMessages((prev) =>
      prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
    );
    if (!isFocusedRef.current) {
      incrementUnread();
    }
  });
  return unsubscribe;
}, [loadReactions]);
```

### Trends (`src/app/(tabs)/trends.tsx`, `src/app/trend/[id].tsx`)

- Create shared trend ideas
- Status tabs: Idea → Planned → Doing → Done
- Shared checklist with realtime sync
- Social media link detection (TikTok, Instagram, YouTube)
- Celebration modal when trend is Done

### Activity Feed

- Shows recent actions across all users
- Types: checkin, meal, water_goal, step_goal, trend_added, trend_done, miko
- Clickable items (meal → detail modal, trend → trend page)
- `reference_id` links activity to source record (e.g., meal_id)

---

## 6. Deployment

### Vercel (Web)

**Setup**:
1. Import GitHub repository in Vercel
2. Configure build settings:
   - **Framework Preset**: Expo
   - **Root Directory**: `mikrokosmos` (if monorepo) or `./`
   - **Build Command**: `npx expo export --platform web`
   - **Output Directory**: `dist`
3. Add environment variables in Vercel dashboard:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GROQ_API_KEY`
   - `EXPO_PUBLIC_GEMINI_API_KEY`
4. Deploy

**vercel.json** (if needed):
```json
{
  "buildCommand": "npx expo export --platform web",
  "outputDirectory": "dist",
  "framework": "expo"
}
```

### EAS Build (Android/iOS)

**Install EAS CLI**:
```bash
npm install -g eas-cli
```

**Configure**:
```bash
eas build:configure
```

**Build APK** (Android):
```bash
eas build --platform android --profile preview
```

**Build IPA** (iOS — requires Apple Developer account):
```bash
eas build --platform ios --profile preview
```

**eas.json** example:
```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "preview": {
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "simulator": false }
    }
  }
}
```

**Environment variables in EAS**:
```bash
eas secret:create --name EXPO_PUBLIC_GROQ_API_KEY --value "gsk_..."
```

---

## 7. Common Pitfalls

### Gemini API Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `401 ACCESS_TOKEN_TYPE_UNSUPPORTED` | Using `?key=` query param | Use `X-goog-api-key` header instead |
| `404 model not found` | Wrong model name | Use `gemini-flash-latest` only |
| `429 quota exceeded` | Free tier limit (20/day) | Wait 24h or upgrade to paid plan |
| `MAX_TOKENS` finish reason | Thinking tokens consumed budget | Set `maxOutputTokens: 1024` (not 120) |
| `503 high demand` | Model overloaded | Retry with 1s delay |

### Groq API Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `404 model_not_found` | Model name wrong or decommissioned | Use `llama3-8b-instant` (stable) |
| `400 model_decommissioned` | Model retired | Check [Groq docs](https://console.groq.com/docs/deprecations) |
| `401 unauthorized` | Invalid API key | Verify key in Groq dashboard |

### Build Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `identifier 'useRef' has already been declared` | Duplicate import | Check imports, remove duplicates |
| `Unable to resolve module @react-navigation/native` | Wrong import | Use `expo-router` hooks instead |
| `Failed to resolve module` | Missing dependency | Run `npm install` |

### Supabase Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `new row violates row-level security` | RLS policy missing | Add policy in schema.sql |
| `permission denied for table` | Grants missing | Run GRANT statements in schema.sql |
| Auth signup fails | Email confirmation enabled | Disable in Supabase Auth settings |
| Realtime not working | Table not published | Add to `supabase_realtime` publication |

### GitHub Push Protection

| Error | Cause | Solution |
|-------|-------|----------|
| `push blocked due to secret scanning` | API key in committed file | Remove file from git history, use `.env.local` |

---

## 8. Development Workflow

### Git Branching

- `main` — production-ready code
- Feature branches: `feature/xxx`, `fix/xxx`, `chore/xxx`
- Commit messages: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)

### Testing

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Manual testing
npm run web  # Test in browser
```

### Adding New Features

1. **Database changes**: Update `supabase/schema.sql` or create migration
2. **Models**: Add TypeScript interface in `src/models/index.ts`
3. **Repository**: Add data access function in `src/repositories/`
4. **Service**: Add business logic in `src/services/`
5. **Component**: Add UI in `src/features/` or `src/app/`
6. **Test**: Verify with `npx tsc --noEmit`

### Code Conventions

- **TypeScript**: Strict mode, no `any`
- **Naming**: snake_case for DB columns, camelCase for TS variables
- **Imports**: Use `@/` alias for `src/` paths
- **Hooks**: Use `useRef` for values that shouldn't trigger re-renders
- **Realtime**: Use `useRef` for focus state to avoid subscription recreation

### Environment Reload

After changing `.env.local`:
```bash
# Stop dev server (Ctrl+C)
npm run web  # Restart
```

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/services/miko.ts` | AI chat bot (Groq + Gemini) |
| `src/services/calorieAnalyzer.ts` | Food recognition + calorie estimation |
| `src/repositories/chat.ts` | Chat data access + realtime |
| `src/app/(tabs)/mikrokosmos.tsx` | Chat screen |
| `src/app/(tabs)/self-love.tsx` | Food diary screen |
| `supabase/schema.sql` | Database schema + RLS |

### API Keys

| Provider | Key | Quota | Purpose |
|----------|-----|-------|---------|
| Groq | `EXPO_PUBLIC_GROQ_API_KEY` | 14,400/day | Chat + calorie estimation |
| Gemini | `EXPO_PUBLIC_GEMINI_API_KEY` | 20/day | Photo analysis (vision) |

### Demo Accounts

| Username | Theme | Emoji |
|----------|-------|-------|
| `namnamxyi` | Lilac | 🪻 |
| `kyraawr` | Sky blue | ☁️ |
| `xcjessyx` | Soft pink | 🌸 |

---

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Groq Documentation](https://console.groq.com/docs)
- [Gemini API Documentation](https://ai.google.dev/docs)

---

*Last updated: August 2026*
*Made with 💗 for the trio.*
