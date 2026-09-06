// Verify realtime chat toast on web — jsdom harness v2.
// Boots the ACTUAL metro bundle (expo-router entry) in jsdom, stubs
// websockets + RN-web primitives, logs in as a member, then a second
// HTTP client inserts a chat message via Supabase REST (service role)
// and we assert the SocialHub toast appears in the DOM.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');

const APP = 'http://localhost:8421/';
const SUPA_URL = process.env.SUPA_URL || 'https://pcgqcquoogombkvnjacp.supabase.co';
const SVC_KEY = fs.readFileSync(process.env.LOCALAPPDATA + '\\Temp\\svc_role.txt', 'utf8').trim();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // 1. Fetch entry HTML + the metro bundle it references.
  const entryHtml = await (await fetch(APP)).text();
  const srcMatch = entryHtml.match(/<script[^>]+src="([^"]+)"/);
  const bundleUrl = new URL(srcMatch[1], APP).href;
  console.log('fetching bundle…');
  const t0 = Date.now();
  const bundleJs = await (await fetch(bundleUrl)).text();
  console.log('bundle fetched:', (bundleJs.length / 1024 / 1024).toFixed(1), 'MB in', Date.now() - t0, 'ms');

  // 2. jsdom with script execution + console capture.
  const vc = new VirtualConsole();
  const seenErrors = [];
  const appLogs = [];
  vc.on('error', (...a) => { const s = a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch { return String(x); } }).join(' '); seenErrors.push(s.slice(0, 300)); });
  vc.on('jsdomError', e => seenErrors.push('jsdomError: ' + String(e).slice(0, 300)));
  vc.on('warn', (...a) => appLogs.push('WARN ' + a.map(String).join(' ').slice(0, 200)));
  vc.on('log', (...a) => appLogs.push(a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch { return String(x); } }).join(' ').slice(0, 300)));

  const dom = new JSDOM(entryHtml.replace(srcMatch[0], ''), {
    url: APP, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;
  const { document } = window;

  // 3. Stub what RN-web/Expo needs that jsdom lacks.
  window.matchMedia = window.matchMedia || (q => ({ matches: /prefers-color-scheme: dark/.test(q), media: q,
    addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){},
    onchange: null, dispatchEvent(){ return false; } }));
  window.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function(){};
  window.scrollTo = () => {};
  if (!window.speechSynthesis) window.speechSynthesis = { speak(){}, cancel(){}, getVoices: () => [] };
  // RN-web onLayout needs ResizeObserver; jsdom lacks it.
  window.ResizeObserver = window.ResizeObserver || class {
    observe(){} unobserve(){} disconnect(){}
  };
  window.IntersectionObserver = window.IntersectionObserver || class {
    observe(){} unobserve(){} disconnect(){} takeRecords(){ return []; }
    get root(){ return null; } get rootMargin(){ return '0px'; } get thresholds(){ return [0]; }
  };
  // jsdom (v27) has no fetch on window — bridge Node's global fetch.
  if (!window.fetch) window.fetch = (...a) => fetch(...a);
  console.log('window.fetch present?', typeof window.fetch);
  // Warm check: can the window reach supabase REST at all?
  try {
    const probe = await window.fetch('https://pcgqcquoogombkvnjacp.supabase.co/rest/v1/', { method: 'GET' });
    console.log('probe supabase REST from window.fetch:', probe.status);
  } catch (e) { console.log('probe supabase REST FAIL:', String(e).slice(0, 150)); }
  // Real WebSocket (ws pkg) for supabase-realtime, but NEVER let the app
  // connect back to the Metro HMR server — that killed the dev server
  // ("empty path / JSC-safe" crash). jsdom v27 HAS a native WebSocket, so
  // we must OVERRIDE it unconditionally, not just fill it in.
  try {
    const WS = require('ws');
    const RealWS = WS.WebSocket || WS;
    class GuardedWebSocket extends RealWS {
      constructor(url, protocols, options) {
        const u = String(url);
        if (/:(8421)\b/.test(u) && /\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(u)) {
          // Swallow HMR connections: dead port, never reaches metro,
          // and swallow the resulting connection error (else node exits).
          super('ws://127.0.0.1:1', protocols, options);
          this.on('error', () => {});
          this._hmrBlocked = true;
        } else {
          super(url, protocols, options);
        }
      }
    }
    window.WebSocket = GuardedWebSocket;
  } catch { /* realtime will fail gracefully */ }

  // expo Router may need history patches — jsdom has them since v20.

  // 4. BEFORE eval: ensure the throwaway member exists and inject its
  //    session into localStorage — supabase-js reads it during client boot
  //    (inside the bundle), so it must be present before the eval runs.
  const EMAIL = 'toasttest@mikrokosmos.app';
  const PASS = process.env.TOAST_TEST_PASS || 'ToastTest-2026!';
  const { execSync } = require('child_process');
  let authUserId = null;
  try {
    const mkUsers = await (await fetch(`${SUPA_URL}/auth/v1/admin/users`, { headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } })).json();
    const existing = (mkUsers.users || []).find(u => u.email === EMAIL);
    if (existing) {
      authUserId = existing.id;
      console.log('test member exists:', authUserId);
    } else {
      const mk = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
        method: 'POST', headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASS, email_confirm: true }),
      });
      const body = await mk.json();
      authUserId = body.id || (body.user && body.user.id);
      console.log('test member created:', mk.status, authUserId);
    }
    // profile row (REST insert lacks grants — go through SQL).
    if (authUserId) {
      fs.writeFileSync(process.env.LOCALAPPDATA + '/Temp/toast-profile.sql',
        `insert into public.profiles (id, username, display_name, emoji, theme)\nvalues ('${authUserId}', 'toasttest', 'Toast Test', '✨', 'lilac')\non conflict (id) do nothing;`);
      execSync('supabase db query --linked --file "' + process.env.LOCALAPPDATA + '\\Temp\\toast-profile.sql"',
        { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
      console.log('profile row ensured');
    }
  } catch (e) { console.log('member ensure FAIL:', String(e).slice(0, 300)); }

  let session = null;
  try {
    const tk = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: SVC_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
    session = await tk.json();
    console.log('password grant:', tk.status, session.access_token ? 'token OK' : JSON.stringify(session).slice(0, 120));
  } catch (e) { console.log('token FAIL:', String(e).slice(0, 200)); }

  if (session && session.access_token) {
    window.localStorage.setItem('sb-pcgqcquoogombkvnjacp-auth-token', JSON.stringify(session));
    console.log('session injected into localStorage');
  }

  // 5. Run the real bundle.
  console.log('eval bundle…');
  // jsdom can't load web fonts, and the webfontloader poller throws an
  // uncaught "12000ms timeout exceeded" after 12s which kills the harness.
  // Neutralize just that branch — the app renders with fallback fonts.
  const patchedBundle = bundleJs.replace(
    'if (new Date().getTime() - J >= q)',
    'if (false)'
  );
  console.log('font-timeout branch patched:', patchedBundle !== bundleJs);
  try { window.eval(patchedBundle); } catch (e) { console.log('EVAL THREW:', String(e).slice(0, 500)); }
  await sleep(1000);

  // Diagnose mount: print app console logs so far.
  console.log('--- appLogs (first 12) ---');
  appLogs.slice(0, 12).forEach(l => console.log('  ', l));
  console.log('--- seenErrors (first 12) ---');
  seenErrors.slice(0, 12).forEach(l => console.log('  ', l));
  console.log('--- end diagnostics ---');

  // Wait for the signed-in app to mount (supabase session + home data).
  // NOTE: jsdom does NOT implement innerText (always undefined) — use
  // textContent for every text assertion.
  let bodyText = '';
  for (let i = 0; i < 24; i++) {
    await sleep(1000);
    bodyText = (document.body.textContent || '').trim();
    if (bodyText.length > 40) break;
  }
  console.log('body text length:', bodyText.length);
  console.log('body head:', bodyText.slice(0, 250).replace(/\s+/g, ' | '));

  console.log('--- appLogs during login (last 10) ---');
  appLogs.slice(-10).forEach(l => console.log('  ', l));
  console.log('--- seenErrors during login (last 10) ---');
  seenErrors.slice(-10).forEach(l => console.log('  ', l));
  console.log('after login, body head:', bodyText.slice(0, 200).replace(/\n/g, ' | '));

  // 7. Insert a chat message as ANOTHER member via SQL (service_role REST
  //    lacks INSERT grants on this project).
  const senders = await (await fetch(`${SUPA_URL}/rest/v1/profiles?select=id,username`, {
    headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } })).json();
  const sender = senders.find(p => p.username === 'namnamxyi') || senders[0];
  console.log('sender:', sender.username);

  // Mark the body BEFORE the insert so we can diff what's new.
  const bodyBefore = (document.body.textContent || '');

  const insSql = `insert into public.messages (sender_id, message, is_bot) values ('${sender.id}', 'jsdom toast test 💜 — abaikan', false) returning id;`;
  let msgId = null;
  try {
    fs.writeFileSync(process.env.LOCALAPPDATA + '/Temp/toast-ins.sql', insSql);
    const out = execSync('supabase db query --linked --file "' + process.env.LOCALAPPDATA + '\\Temp\\toast-ins.sql"', {
      cwd: process.cwd(), encoding: 'utf8', timeout: 60000,
    }).toString();
    const m = out.match(/"id":\s*"([a-f0-9-]{36})"/);
    msgId = m && m[1];
    console.log('message inserted:', msgId ? msgId.slice(0, 8) + '…' : 'PARSE FAIL', '| pg output head:', out.slice(0, 80).replace(/\n/g, ' '));
  } catch (e) {
    console.log('SQL INSERT FAIL:', String(e).slice(0, 200));
  }

  // 8. Watch the DOM for the toast (SocialHub renders it over the tabs).
  // STRICT: the test message text is unique — it only enters the DOM via
  // the realtime toast (or the chat screen, which is not open here).
  let toastText = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const txt = (document.body.textContent || '');
    const idx = txt.indexOf('jsdom toast test');
    if (idx >= 0) {
      toastText = txt.slice(Math.max(0, idx - 60), idx + 120).trim();
      break;
    }
  }
  console.log('TOAST SEEN:', toastText ? 'YES' : 'NO');
  if (toastText) console.log('toast context: …' + toastText.replace(/\s+/g, ' | ') + '…');
  console.log('app errors during run:', seenErrors.length ? seenErrors.slice(0, 5) : '(none)');

  // 9. Cleanup: delete the test message + the throwaway member.
  if (msgId) {
    try {
      fs.writeFileSync(process.env.LOCALAPPDATA + '/Temp/toast-del.sql',
        `delete from public.messages where id = '${msgId}';`);
      const rc = execSync('supabase db query --linked --file "' + process.env.LOCALAPPDATA + '\\Temp\\toast-del.sql"',
        { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 });
      console.log('cleanup message delete:', 'OK');
    } catch (e) { console.log('cleanup message delete FAIL:', String(e).slice(0, 150)); }
  }
  // Delete throwaway profile (SQL — REST lacks DELETE grants) + auth user.
  try {
    fs.writeFileSync(process.env.LOCALAPPDATA + '/Temp/toast-del-profile.sql',
      `delete from public.profiles where username = 'toasttest';`);
    execSync('supabase db query --linked --file "' + process.env.LOCALAPPDATA + '\\Temp\\toast-del-profile.sql"',
      { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
    console.log('cleanup profile delete: OK');
    const users = await (await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } })).json();
    const tu = (users.users || []).find(x => x.email === 'toasttest@mikrokosmos.app');
    if (tu) {
      const du = await fetch(`${SUPA_URL}/auth/v1/admin/users/${tu.id}`, {
        method: 'DELETE', headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } });
      console.log('cleanup auth user delete:', du.status);
    }
  } catch (e) { console.log('cleanup member FAIL:', String(e).slice(0, 150)); }
  process.exit(0);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
