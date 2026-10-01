import { collection, getDocs, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { todayStr } from './dateUtils';

// What each category clears. "Progress" categories keep the items themselves
// and restart their history from today; the others delete the items.
export const RESET_CATEGORIES = [
  { key: 'routines',    label: 'Routine progress',   hint: 'Check-offs, streaks and stats. Routines stay and start fresh today.' },
  { key: 'commitments', label: 'Commitment history', hint: 'Marked failures. Commitments stay and start fresh today.' },
  { key: 'tasks',       label: 'Task history',       hint: 'Deletes finished one-time and backlog tasks; clears monthly task check-offs.' },
  { key: 'notes',       label: 'Journal entries',    hint: 'Deletes every note.' },
  { key: 'lists',       label: 'Lists',              hint: 'Deletes all to-try lists and checklists.' },
  { key: 'birthdays',   label: 'Birthdays',          hint: 'Deletes every birthday.' },
  { key: 'work',        label: 'Work log',           hint: 'Deletes logged work days and weekly pay. Crews and members stay.', workOnly: true },
];

// Firestore batches allow 500 writes; stay under it
async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach(op => op(batch));
    await batch.commit();
  }
}

const docsOf = async (userId, name) => (await getDocs(collection(db, 'users', userId, name))).docs;

export async function resetData(userId, keys) {
  if (!userId || !keys.length) return;
  const today = todayStr();
  const ops = [];
  const wipe = async (name) => (await docsOf(userId, name)).forEach(d => ops.push(b => b.delete(d.ref)));

  if (keys.includes('routines')) {
    for (const d of await docsOf(userId, 'routines')) {
      const r = d.data();
      ops.push(b => b.update(d.ref, {
        completions: {},
        createdAt: today,
        scheduleHistory: [{ days: r.days || [], from: today }],
        timesHistory: [{ from: today, timesPerDay: r.timesPerDay ?? 1, timesPerDayByDow: r.timesPerDayByDow || {} }],
        pausedRanges: [],
        pausedAt: r.paused ? today : null,
        activeFrom: null,
      }));
    }
  }

  if (keys.includes('commitments')) {
    for (const d of await docsOf(userId, 'commitments')) {
      ops.push(b => b.update(d.ref, { failures: {}, createdAt: today, seedDate: deleteField() }));
    }
  }

  if (keys.includes('tasks')) {
    for (const d of await docsOf(userId, 'tasks')) {
      const t = d.data();
      if (t.type === 'recurring-monthly') {
        ops.push(b => b.update(d.ref, { completedOccurrences: {} }));
      } else if (t.completedAt) {
        ops.push(b => b.delete(d.ref));
      }
    }
  }

  if (keys.includes('notes'))     await wipe('notes');
  if (keys.includes('lists'))     await wipe('personalLists');
  if (keys.includes('birthdays')) await wipe('birthdays');
  if (keys.includes('work')) {
    await wipe('workDays');
    await wipe('workWeeks');
  }

  await commitInChunks(ops);
}
