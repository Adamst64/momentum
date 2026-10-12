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

// Weekly summary for one crew: each day's windows, doors, crew leader and who was
// on site, plus notes ticked for the text; the total is days and leader / not
// leader. Other notes and pay status stay out.
export function buildWeekText(crew, entries, mondayId, members = []) {
  const nameOf = id => members.find(m => m.id === id)?.name;
  const lines = [bold(crew.name), `Week of ${formatWeekRange(mondayId)}`, ''];
  let leader = 0;
  entries.forEach(e => {
    if (e.isCrewLead) leader++;
    const day = new Date(e.id + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    const onSite = (e.memberIds || []).map(nameOf).filter(Boolean);
    lines.push(
      bold(day),
      `Windows: ${bold(e.windows || 0)} · Doors: ${bold(e.doors || 0)}`,
      `Crew leader: ${e.isCrewLead ? '✅ Yes' : '❌ No'}`,
      ...(onSite.length ? [`On site: ${onSite.join(', ')}`] : []),
      // Only notes ticked "Include this note in the weekly text"
      ...(e.commentInText && e.comment?.trim() ? [`Note: ${e.comment.trim()}`] : []),
      '',
    );
  });
  lines.push(
    '━━━━━━━━━━',
    `${bold('TOTAL')}: ${bold(plural(entries.length, 'day'))}`,
    `Crew leader: ${bold(plural(leader, 'day'))}`,
    `Not crew leader: ${bold(plural(entries.length - leader, 'day'))}`,
  );
  return lines.join('\n');
}

// Opens the phone's Messages app with the number and text filled in
export function smsHref(phone, body) {
  const num = String(phone).replace(/[^\d+]/g, '');
  return `sms:${num}?&body=${encodeURIComponent(body)}`;
}
