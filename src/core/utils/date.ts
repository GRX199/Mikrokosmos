/** Date + formatting helpers. All dates are handled as local YYYY-MM-DD. */
import type { AppLanguage } from '@/core/i18n/I18nProvider';

/** Local date as YYYY-MM-DD (what the database `date` columns expect). */
export function todayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Local time as HH:mm. */
export function nowTime(date = new Date()): string {
  const h = `${date.getHours()}`.padStart(2, '0');
  const m = `${date.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

export type DayPhase = 'morning' | 'afternoon' | 'evening' | 'night';

export function dayPhase(date = new Date()): DayPhase {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export function greetingFor(phase: DayPhase): string {
  switch (phase) {
    case 'morning':
      return 'Good Morning';
    case 'afternoon':
      return 'Good Afternoon';
    case 'evening':
      return 'Good Evening';
    default:
      return 'Good Night';
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WEEKDAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** "Sunday, 16 August" style label (locale-aware). */
export function friendlyDate(date = new Date(), lang: AppLanguage = 'en'): string {
  if (lang === 'id') {
    return `${WEEKDAYS_ID[date.getDay()]}, ${date.getDate()} ${MONTHS_ID[date.getMonth()]}`;
  }
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "August 2026" from a Date (locale-aware). */
export function monthYear(date = new Date(), lang: AppLanguage = 'en'): string {
  const months = lang === 'id' ? MONTHS_ID : MONTHS;
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Parse a YYYY-MM-DD string into a local Date (avoids UTC off-by-one). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Compact relative timestamp for chat + activity feed (locale-aware). */
export function relativeTime(iso: string, lang: AppLanguage = 'en'): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return lang === 'id' ? 'baru saja' : 'now';
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return lang === 'id' ? 'kemarin' : 'yesterday';
  if (days < 7) return `${days}d`;
  const date = new Date(iso);
  const months = lang === 'id' ? MONTHS_ID : MONTHS;
  return `${date.getDate()} ${months[date.getMonth()].slice(0, 3)}`;
}

/** "07:32" display for HH:mm(:ss) values coming from Postgres `time`. */
export function shortTime(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 5);
}

/** "1,320" grouping for friendly numbers. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Rough time-of-day label used in the food diary. */
export function timeAgoShort(iso: string, lang: AppLanguage = 'en'): string {
  return relativeTime(iso, lang);
}
