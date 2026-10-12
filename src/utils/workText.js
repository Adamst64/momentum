import { getMondayId, getWeekDates, formatWeekRange, dayEntries } from './workUtils';

// Text messages have no formatting, so "bold" uses Unicode's mathematical bold
// letters and digits, which phones display as bold text.
const BOLD = { A: 0x1D400, a: 0x1D41A, 0: 0x1D7CE };
export function bold(str) {
  return [...String(str)].map(ch => {
    if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(BOLD.A + ch.charCodeAt(0) - 65);
    if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(BOLD.a + ch.charCodeAt(0) - 97);
    if (ch >= '0' && ch <= '9') return String.fromCodePoint(BOLD[0] + ch.charCodeAt(0) - 48);
    return ch;
  }).join('');
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Monday of the week before the one containing `today`
export function previousMondayId(today) {
  const d = new Date(getMondayId(today) + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// This crew's entries for the week (a day split between two crews counts for each)
export function crewWeekEntries(days, crewId, mondayId) {
  const week = new Set(getWeekDates(mondayId));
  return days
    .filter(d => week.has(d.id))
    .flatMap(dayEntries)
    .filter(e => e.crewId === crewId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Weekly summary for one crew: each day's windows, doors and crew leader.
// No comments, notes or pay status.
export function buildWeekText(crew, entries, mondayId) {
  const lines = [bold(crew.name), `Week of ${formatWeekRange(mondayId)}`, ''];
  let windows = 0, doors = 0, leader = 0;
  entries.forEach(e => {
    const w = e.windows || 0, dr = e.doors || 0;
    windows += w; doors += dr;
    if (e.isCrewLead) leader++;
    const day = new Date(e.id + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    lines.push(
      bold(day),
      `Windows: ${bold(w)} · Doors: ${bold(dr)}`,
      `Crew leader: ${e.isCrewLead ? '✅ Yes' : '❌ No'}`,
      '',
    );
  });
  lines.push(
    '━━━━━━━━━━',
    `${bold('TOTAL')} · ${bold(plural(entries.length, 'day'))}`,
    `Windows: ${bold(windows)} · Doors: ${bold(doors)}`,
    `Crew leader: ${plural(leader, 'day')} · Not leader: ${plural(entries.length - leader, 'day')}`,
  );
  return lines.join('\n');
}

// Opens the phone's Messages app with the number and text filled in
export function smsHref(phone, body) {
  const num = String(phone).replace(/[^\d+]/g, '');
  return `sms:${num}?&body=${encodeURIComponent(body)}`;
}
