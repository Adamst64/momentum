import { addDays, getDOW } from './dateUtils';

// Streak badges, by number of clean days in a row
export const MILESTONES = [
  { days: 1,    icon: '🌱', label: 'First day' },
  { days: 3,    icon: '🌿', label: '3 days' },
  { days: 7,    icon: '⭐', label: '1 week' },
  { days: 14,   icon: '✨', label: '2 weeks' },
  { days: 21,   icon: '🔥', label: '3 weeks' },
  { days: 30,   icon: '🥉', label: '1 month' },
  { days: 45,   icon: '💪', label: '45 days' },
  { days: 60,   icon: '🥈', label: '2 months' },
  { days: 75,   icon: '⚡', label: '75 days' },
  { days: 90,   icon: '🥇', label: '3 months' },
  { days: 100,  icon: '💯', label: '100 days' },
  { days: 120,  icon: '🚀', label: '4 months' },
  { days: 150,  icon: '🌟', label: '150 days' },
  { days: 180,  icon: '🏅', label: '6 months' },
  { days: 200,  icon: '🎯', label: '200 days' },
  { days: 250,  icon: '💎', label: '250 days' },
  { days: 270,  icon: '🌊', label: '9 months' },
  { days: 300,  icon: '🏔️', label: '300 days' },
  { days: 365,  icon: '🏆', label: '1 year' },
  { days: 500,  icon: '👑', label: '500 days' },
  { days: 548,  icon: '🦅', label: '18 months' },
  { days: 730,  icon: '🐉', label: '2 years' },
  { days: 1000, icon: '🌌', label: '1000 days' },
  { days: 1095, icon: '🗿', label: '3 years' },
  { days: 1825, icon: '🪐', label: '5 years' },
];

export const SLIP_REASONS = ['Stress', 'Social', 'Boredom', 'Tired', 'Craving', 'Celebrating', 'Bad mood'];

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

// Weekdays a commitment applied to on a date. Edits add a { days, from } entry to
// scheduleHistory so earlier weeks keep their old days. No `days` means every day.
export function daysForDate(c, ds) {
  const entry = [...(c.scheduleHistory || [])]
    .sort((a, b) => b.from.localeCompare(a.from))
    .find(h => h.from <= ds);
  const days = entry ? entry.days : c.days;
  return Array.isArray(days) ? days : EVERY_DAY;
}

export const isScheduled = (c, ds) => daysForDate(c, ds).includes(getDOW(ds));
export const isFailed    = (c, ds) => !!c.failures?.[ds];

// Streaks count finished days only (through yesterday); today is "in progress"
// until it's over, unless it was already marked as a slip.
// Days the commitment isn't scheduled are skipped: they neither count nor break it.
export function commitmentStats(c, today) {
  const created = c.createdAt || today;
  let run = 0, best = 0, clean = 0, total = 0;
  for (let ds = created; ds < today; ds = addDays(ds, 1)) {
    if (!isScheduled(c, ds)) continue;
    if (isFailed(c, ds)) { run = 0; }
    else { run++; best = Math.max(best, run); }
    // The "last time you failed" date given on creation only sets the start
    if (ds === c.seedDate) continue;
    total++;
    if (!isFailed(c, ds)) clean++;
  }
  const failedToday = isFailed(c, today);
  const current = failedToday ? 0 : run;
  // A slip today already counts against the clean percentage
  if (failedToday && today !== c.seedDate && created <= today) total++;

  const ym = today.slice(0, 7), y = today.slice(0, 4);
  const slips = Object.keys(c.failures || {})
    .filter(ds => c.failures[ds] && ds !== c.seedDate && ds <= today)
    .sort().reverse()
    .map(ds => ({ date: ds, note: c.failureNotes?.[ds] || '' }));

  const next = MILESTONES.find(m => m.days > current) || null;
  return {
    current, best, failedToday,
    scheduledToday: isScheduled(c, today),
    // Badge reached with the day that just finished: celebrate it all of today
    newBadge: failedToday ? null : MILESTONES.find(m => m.days === current) || null,
    next, toNext: next ? next.days - current : 0,
    clean, total, pct: total ? Math.round(clean / total * 100) : null,
    slips,
    slipsThisMonth: slips.filter(s => s.date.startsWith(ym)).length,
    slipsThisYear:  slips.filter(s => s.date.startsWith(y)).length,
  };
}

export const streakLabel = n => `${n} day${n === 1 ? '' : 's'} clean`;
