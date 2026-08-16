# Mikrokosmos 🌌

> A little universe shared by three best friends — **Namy**, **Kyra** & **Jessy**.

Mikrokosmos is a private, friendship-first app: gentle daily check-ins, self-love
tracking with only positive wording, a cozy group chat with **Miko** the bot, and
shared "trends" the trio wants to try together. No rankings, no competition, no
negative labels — ever.

Built as **Phase 1 MVP** with **Expo (React Native + TypeScript)** and **Supabase**,
running on Web, Android and iOS from one codebase.

---

## The three members

| Member | Username   | Theme            | Emoji |
| ------ | ---------- | ---------------- | ----- |
| Namy   | `namnamxyi`| Lilac `#B79CED`  | 🪻    |
| Kyra   | `kyraawr`  | Sky blue `#8FD3F4`| ☁️   |
| Jessy  | `xcjessyx` | Soft pink `#F3A6C8`| 🌸  |

The **whole app re-skins itself** to the logged-in member's theme — buttons, nav,
cards, progress rings and chat bubbles all follow their colors.

---

## Features (Phase 1)

- **Home** — time-of-day greeting, daily streak, friend status cards, activity feed,
  morning check-in modal (wake time + 5 moods, once per day).
- **Self Love** — calorie / water / step rings, food diary with photos, water glass
  tracker, manual steps, performance score (0–100) with positive tiers
  (Starting → Growing → Doing Great → Amazing → Cosmic Day), group progress without
  ranking. AI calorie analysis is stubbed with a realistic mock (Phase 3 seam).
- **Mikrokosmos chat** — Supabase Realtime, themed bubbles per sender, replies,
  image messages, tap reactions (❤️ 😂 😭 🥹 ✨). Miko posts celebration messages
  on events (`sender_id = null, is_bot = true`).
- **Trends** — create/track shared ideas with TikTok/Instagram/YouTube link
  detection, status tabs (Idea / Planned / Doing / Done), a shared checklist with
  realtime sync, and a Done-status celebration ("Save Memory / Maybe Later").
- **Me** — stats (streak, self-love days, meals logged, trends done), edit profile,
  privacy toggles (weight / calories / meals → Friends or Only Me), change password,
  logout. Friend profiles respect privacy settings.

---

## Run it

### 0. Install

```bash
npm install
```

### 1. Configure the backend (optional but recommended)

The app runs **without any backend in mock mode** (any password works for the three
usernames). For the real experience:

1. Create a `.env.local` in the project root:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. In the Supabase dashboard → SQL editor, run [`supabase/schema.sql`](supabase/schema.sql)
   (tables + RLS + realtime + storage bucket), then
   [`supabase/seed.sql`](supabase/seed.sql) (demo data for the last week).

3. Create the three auth accounts + profiles:

   ```bash
   node scripts/setup-users.mjs
   ```

   Temporary dev passwords live in `scripts/setup-users.mjs` — never committed
   anywhere else, and meant to be changed. In Supabase Auth settings,
   **disable email confirmation** (the `@mikrokosmos.app` addresses are synthetic).

### 2. Start

```bash
npm run web        # browser at http://localhost:8081
npm start          # Expo dev server → Android (Expo Go) / iOS (Expo Go or simulator)
```

Log in with one of the three usernames. Open two browser sessions with different
users to watch chat, reactions and trend checklists sync in realtime.

---

## Architecture

```
src/
  app/                    Expo Router screens
    _layout.tsx           Root stack: providers + navigation
    index.tsx             Redirect by auth state
    login.tsx             Username+password login (username → @mikrokosmos.app email)
    (tabs)/               Home · Self Love · Mikrokosmos · Trends · Me
    friend/[id].tsx       Friend profile (privacy-aware)
    trend/[id].tsx        Trend detail + shared checklist + celebration
  core/                   theme tokens + ThemeProvider, Supabase client, constants, date utils
  models/                 TypeScript models matching Supabase tables (snake_case)
  repositories/           data layer — every function checks isSupabaseConfigured
                          and falls back to the in-memory mockStore (spec §53.9)
  services/               performance score, streaks, Miko rules, mock calorie analyzer
  features/               SessionProvider (auth), home + self-love feature components
  components/             RoundedCard, ProgressRing, EmptyState, LoadingView/ErrorState,
                          SoftInput, Avatar, CosmicTabBar (floating pill nav)
supabase/                 schema.sql (RLS) + seed.sql
scripts/setup-users.mjs   creates the 3 accounts via Supabase signup API + profiles
```

### Design decisions

- **Dual-mode repositories**: every repo function works against Supabase when
  configured, otherwise an in-memory mock store — the app is always runnable.
- **RLS everywhere**: only the 3 authenticated members can read/write; meals and
  calories visibility for friends is enforced server-side via `privacy_settings`.
- **Miko without a bot account**: bot messages ride the triggering member's token
  with `sender_id IS NULL AND is_bot = true` (allowed by a dedicated insert policy).
- **Responsive web**: content is centered at `MAX_CONTENT_WIDTH = 560px`.
- **Phase seams left open**: real AI food vision, health-kit sync, memories,
  achievements and notifications are stubbed where they plug in (Phases 2–3).

---

## Verify

```bash
npx tsc --noEmit   # strict type-check across the whole app
npm run web        # smoke test in the browser
```

---

Made with 💗 for the trio. *Small acts of care, one day at a time.*
