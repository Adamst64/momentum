// A task's reminders: [{ daysBefore, time }] — each a day (0 = the due day,
// 1 = the day before…) and a time. Tasks saved before this have just notify.time.
export const BEFORE_OPTIONS = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day before' },
  { value: 2, label: '2 days before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
];

export const remindersOf = notify => {
  if (!notify?.enabled) return [];
  if (notify.reminders?.length) return notify.reminders;
  return notify.time ? [{ daysBefore: 0, time: notify.time }] : [];
};

const short = r => (r.daysBefore ? `${r.daysBefore === 7 ? '1 wk' : `${r.daysBefore}d`} before ${r.time}` : r.time);
export const remindersSummary = notify => remindersOf(notify).map(short).join(', ');
