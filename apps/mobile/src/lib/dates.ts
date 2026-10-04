import { getCalendars } from 'expo-localization';

// Dates and times as people read them, e.g. "4 Oct 2026, 2:29 pm".
//
// Why not toLocaleString? On Android, the JavaScript engine (Hermes) doesn't know the phone's
// time zone, so toLocaleString showed times in the wrong zone (a 2:29 pm follow appeared as
// 1:59 am). A Date's own getHours/getDate/... do follow the phone's clock, so we build the
// text from those.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toDate = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value);

// "2:29 pm", "12:05 am"
export function formatTime(value: string | Date): string {
  const d = toDate(value);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// "4 Oct 2026"
export function formatDate(value: string | Date): string {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

// "4 Oct 2026, 2:29 pm"
export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

// "4 October 2026 at 2:29 pm"
export function formatLongDateTime(value: string | Date): string {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} at ${formatTime(d)}`;
}

// "Sunday, 4 October 2026 at 2:29 pm"
export function formatFullDateTime(value: string | Date): string {
  return `${WEEKDAYS[toDate(value).getDay()]}, ${formatLongDateTime(value)}`;
}

// "Sun 2:29 pm", for chat messages.
export function formatWeekdayTime(value: string | Date): string {
  return `${weekdayShort(value)} ${formatTime(value)}`;
}

// "Sun"
export function weekdayShort(value: string | Date): string {
  return WEEKDAYS[toDate(value).getDay()].slice(0, 3);
}

// "12 Sep"
export function formatDayMonth(value: string | Date): string {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

// "October"
export function monthName(value: string | Date): string {
  return MONTHS[toDate(value).getMonth()];
}

// The phone's time zone, e.g. "Asia/Kolkata", read from the phone itself (not from Hermes'
// Intl, which gets it wrong on Android). The server uses it for "this week" and challenge dates.
export function deviceTimeZone(): string {
  try {
    const fromPhone = getCalendars()[0]?.timeZone;
    if (fromPhone) return fromPhone;
  } catch {
    // Not available (e.g. tests): fall back below.
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
