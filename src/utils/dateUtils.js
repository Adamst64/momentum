export function toDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  const now = new Date();
  // Day ends at 4 AM — before 4 AM still counts as previous day
  if (now.getHours() < 4) now.setDate(now.getDate() - 1);
  return toDateStr(now);
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const getDOW = (dateStr) => parseDate(dateStr).getDay(); // 0=Sun

export const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

export const getFirstDOW = (y, m) => new Date(y, m, 1).getDay();

export function formatMonthYear(y, m) {
  return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatLongDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export const getYM = (dateStr) => dateStr.slice(0, 7); // 'YYYY-MM'

export const todayYM = () => getYM(todayStr());

export const isPast = (dateStr) => dateStr < todayStr();

export const isFuture = (dateStr) => dateStr > todayStr();

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const DAYS_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
