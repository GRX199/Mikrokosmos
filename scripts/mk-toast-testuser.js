// Create a throwaway member for the jsdom toast test, print the password.
// Cleanup happens in verify-web-toast.js teardown (and this script is
// idempotent — deletes any leftover 'toast-test' member first).
const fs = require('fs');
const SUPA_URL = 'https://pcgqcquoogombkvnjacp.supabase.co';
const SVC_KEY = fs.readFileSync(process.env.LOCALAPPDATA + '\\Temp\\svc_role.txt', 'utf8').trim();

const HEADERS = { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' };
const USERNAME = 'toasttest';
const EMAIL = `${USERNAME}@mikrokosmos.app`;
const PASS = process.env.TOAST_TEST_PASS || 'ToastTest-2026!';

async function main() {
  // leftover cleanup (auth user + profile)
  const oldUsers = await (await fetch(`${SUPA_URL}/auth/v1/admin/users`, { headers: HEADERS })).json();
  const old = (oldUsers.users || []).find(u => u.email === EMAIL);
  if (old) {
    const del = await fetch(`${SUPA_URL}/auth/v1/admin/users/${old.id}`, { method: 'DELETE', headers: HEADERS });
    console.log('old auth user deleted:', del.status);
  }
  const oldProfile = await fetch(`${SUPA_URL}/rest/v1/profiles?username=eq.${USERNAME}`, { headers: HEADERS });
  const oldRows = await oldProfile.json();
  if (oldRows && oldRows.length) {
    const dp = await fetch(`${SUPA_URL}/rest/v1/profiles?username=eq.${USERNAME}`, { method: 'DELETE', headers: HEADERS });
    console.log('old profile deleted:', dp.status);
  }

  // create auth user
  const mk = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: { ...HEADERS, 'X-Supabase-Auth-Id': SVC_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASS, email_confirm: true }),
  });
  const mkBody = await mk.json();
  console.log('auth user created:', mk.status, mkBody.user ? mkBody.user.id : JSON.stringify(mkBody).slice(0, 200));

  // create profile row
  if (mkBody.user) {
    const pr = await fetch(`${SUPA_URL}/rest/v1/profiles`, {
      method: 'POST', headers: { ...HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify({ id: mkBody.user.id, username: USERNAME, display_name: 'Toast Test', theme: 'default' }),
    });
    console.log('profile created:', pr.status);
  }
  console.log('PASS:', PASS);
}
main().catch(e => { console.error(e); process.exit(1); });
