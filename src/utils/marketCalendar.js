// US stock market (NYSE/Nasdaq) calendar: weekends and full-day holidays.
// Holidays follow NYSE rules: a Saturday holiday closes the Friday before, a
// Sunday holiday closes the Monday after — except New Year's Day on a Saturday,
// which isn't made up. Early-close days (e.g. day after Thanksgiving) count as open.
// Keep in sync with functions/marketCalendar.js.

// One-off closures outside the regular schedule (national days of mourning)
const SPECIAL_CLOSURES = ['2018-12-05', '2025-01-09'];

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dow = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

// nth (1-based) weekday of a month; n = -1 for the last one
function nthWeekday(y, m, weekday, n) {
  if (n > 0) {
    const first = dow(y, m, 1);
    return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = dow(y, m, lastDay);
  return iso(y, m, lastDay - ((last - weekday + 7) % 7));
}

// Fixed-date holiday moved to the nearest weekday
function observed(y, m, d) {
  const w = dow(y, m, d);
  const t = new Date(Date.UTC(y, m - 1, d + (w === 6 ? -1 : w === 0 ? 1 : 0)));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Easter Sunday (anonymous Gregorian algorithm), minus two days
function goodFriday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const t = new Date(Date.UTC(y, month - 1, day - 2));
  return iso(y, t.getUTCMonth() + 1, t.getUTCDate());
}

const cache = {};
export function marketHolidays(y) {
  if (cache[y]) return cache[y];
  const days = [
    dow(y, 1, 1) === 6 ? null : observed(y, 1, 1), // New Year's Day
    nthWeekday(y, 1, 1, 3),                        // Martin Luther King Jr. Day
    nthWeekday(y, 2, 1, 3),                        // Washington's Birthday
    goodFriday(y),
    nthWeekday(y, 5, 1, -1),                       // Memorial Day
    y >= 2022 ? observed(y, 6, 19) : null,         // Juneteenth
    observed(y, 7, 4),                             // Independence Day
    nthWeekday(y, 9, 1, 1),                        // Labor Day
    nthWeekday(y, 11, 4, 4),                       // Thanksgiving
    observed(y, 12, 25),                           // Christmas
    ...SPECIAL_CLOSURES.filter(s => s.startsWith(`${y}-`)),
  ];
  return (cache[y] = new Set(days.filter(Boolean)));
}

// 'YYYY-MM-DD' → true when the market is open that day
export function isMarketDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const w = dow(y, m, d);
  return w !== 0 && w !== 6 && !marketHolidays(y).has(dateStr);
}

// Latest market day on or before dateStr
export function lastMarketDay(dateStr) {
  let [y, m, d] = dateStr.split('-').map(Number);
  for (;;) {
    const s = iso(y, m, d);
    if (isMarketDay(s)) return s;
    const t = new Date(Date.UTC(y, m - 1, d - 1));
    [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  }
}

// Current date and minutes past midnight in New York
export function easternDate(now = new Date()) {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return { date: iso(et.getFullYear(), et.getMonth() + 1, et.getDate()), minutes: et.getHours() * 60 + et.getMinutes() };
}

// The trading day current prices belong to: today once the market has opened,
// otherwise the last session (weekends, holidays, and weekday mornings)
export function priceDate(now = new Date()) {
  const { date, minutes } = easternDate(now);
  if (isMarketDay(date) && minutes >= 9 * 60 + 30) return date;
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return lastMarketDay(iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()));
}
