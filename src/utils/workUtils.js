export const CREW_COLORS = [
  '#4A90E2', // blue
  '#E8924A', // orange
  '#9B59B6', // purple
  '#1ABC9C', // teal
  '#F39C12', // amber
  '#E84393', // pink
  '#00BCD4', // cyan
  '#8E44AD', // deep purple
];

function pad(n) { return String(n).padStart(2, '0'); }

export function dateStr(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Returns YYYY-MM-DD of the Monday that starts the week containing dateStr.
export function getMondayId(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getWeekDates(mondayId) {
  const d = new Date(mondayId + 'T12:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  });
}

export function formatWeekRange(mondayId) {
  const dates = getWeekDates(mondayId);
  const fmt = s => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(dates[0])} – ${fmt(dates[6])}`;
}

export function formatDayFull(ds) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}
