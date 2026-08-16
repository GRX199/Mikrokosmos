#!/usr/bin/env node
/**
 * Mikrokosmos — development user setup.
 *
 * Creates the three founding members through the Supabase Auth signup API
 * (never manual auth.users inserts — modern GoTrue rejects those) and then
 * writes each member's profile row using their own session token, which
 * satisfies Row Level Security.
 *
 * Prerequisites:
 *   1. supabase/schema.sql applied in the Supabase SQL editor.
 *   2. "Confirm email" disabled in Supabase Auth -> Providers -> Email.
 *
 * Usage: node scripts/setup-users.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---- Load .env.local -------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

const env = {};
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2];
  }
} catch {
  console.error('Missing .env.local — create it with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('.env.local must define EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

// ---- The three founding members (temporary dev passwords only) -------------
const EMAIL_DOMAIN = 'mikrokosmos.app';
const MEMBERS = [
  { username: 'namnamxyi', displayName: 'Namy', emoji: '🪻', theme: 'lilac', tempPassword: 'JungkookWifey' },
  { username: 'kyraawr', displayName: 'Kyra', emoji: '☁️', theme: 'sky', tempPassword: 'kyraaa' },
  { username: 'xcjessyx', displayName: 'Jessy', emoji: '🌸', theme: 'pink', tempPassword: 'taehyungluvmeinda' },
];

async function signup(member) {
  const email = `${member.username}@${EMAIL_DOMAIN}`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: member.tempPassword,
      data: { username: member.username, display_name: member.displayName },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`signup failed for ${member.username}: ${res.status} ${JSON.stringify(body)}`);
  }
  // If the account already exists, GoTrue may return the user without a session.
  if (!body.access_token) {
    console.log(`  ${member.username}: already exists (no session returned). Profile step skipped — login once to sync.`);
    return null;
  }
  return body;
}

async function upsertProfile(member, auth) {
  const profile = {
    id: auth.user.id,
    username: member.username,
    display_name: member.displayName,
    emoji: member.emoji,
    theme: member.theme,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`profile upsert failed for ${member.username}: ${res.status} ${text}`);
  }
}

console.log(`Setting up Mikrokosmos members on ${SUPABASE_URL}\n`);
for (const member of MEMBERS) {
  try {
    const auth = await signup(member);
    if (auth) {
      await upsertProfile(member, auth);
      console.log(`  ✔ ${member.displayName} (@${member.username}) ready — theme: ${member.theme}`);
    }
  } catch (err) {
    console.error(`  ✘ ${member.username}: ${err.message}`);
    process.exitCode = 1;
  }
}
console.log('\nDone. Next: run supabase/seed.sql in the SQL editor for sample data.');
