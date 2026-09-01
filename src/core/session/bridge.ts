/**
 * Tiny module-level bridge so device-level providers (I18n, Appearance),
 * which are mounted ABOVE SessionProvider, can key their storage
 * per-account. SessionProvider mirrors profile.username in here;
 * the settings providers subscribe and reload that account's choice.
 */

type Listener = (username: string | null) => void;

let current: string | null = null;
const listeners = new Set<Listener>();

export function setSessionUsername(username: string | null): void {
  if (current === username) return;
  current = username;
  listeners.forEach((l) => l(username));
}

export function getSessionUsername(): string | null {
  return current;
}

export function onSessionUsernameChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Storage key namespaced to the active account ('' suffix when signed out). */
export function accountKey(base: string): string {
  return current ? `${base}.${current}` : base;
}
