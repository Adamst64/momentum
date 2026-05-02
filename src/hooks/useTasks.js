import { useState, useCallback } from 'react';
import { todayStr, getYM } from '../utils/dateUtils';
import { genId } from '../utils/id';

const KEY = 'momentum_tasks';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

export function useTasks() {
  const [tasks, setTasks] = useState(load);

  const persist = useCallback((next) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setTasks(next);
  }, []);

  // ---------- queries ----------

  const todayTasks = useCallback(() => {
    const today = todayStr();
    const ym = getYM(today);
    const dom = new Date().getDate();
    return tasks.filter(t => {
      if (t.type === 'one-time') return t.date === today && !t.completedAt;
      if (t.type === 'recurring-monthly') return t.dayOfMonth === dom && !t.completedOccurrences?.[ym];
      return false;
    });
  }, [tasks]);

  const doneTasks = useCallback(() => {
    const today = todayStr();
    const ym = getYM(today);
    return tasks.filter(t => {
      if (t.type === 'one-time') return t.completedAt === today;
      if (t.type === 'recurring-monthly') return t.completedOccurrences?.[ym] === today;
      if (t.type === 'backlog') return t.completedAt === today;
      return false;
    });
  }, [tasks]);

  const backlogTasks = useCallback(() => {
    const today = todayStr();
    const ym = getYM(today);
    const dom = new Date().getDate();
    return tasks.filter(t => {
      if (t.type === 'backlog') return !t.completedAt;
      // one-time past due and not completed
      if (t.type === 'one-time' && t.date < today && !t.completedAt) return true;
      // recurring-monthly: past dayOfMonth this month and not completed this month
      if (t.type === 'recurring-monthly' && t.dayOfMonth < dom && !t.completedOccurrences?.[ym]) return true;
      return false;
    });
  }, [tasks]);

  const upcomingTasks = useCallback(() => {
    const today = todayStr();
    const ym    = getYM(today);
    const dom   = parseInt(today.slice(-2), 10);
    return tasks.filter(t => {
      if (t.type === 'one-time') return t.date > today && !t.completedAt;
      if (t.type === 'recurring-monthly') {
        const donethis  = !!t.completedOccurrences?.[ym];
        const dueToday  = t.dayOfMonth === dom;
        const missed    = t.dayOfMonth < dom && !donethis;
        return !donethis && !dueToday && !missed;
      }
      return false;
    }).sort((a, b) => {
      const nextDate = (t) => t.type === 'one-time'
        ? t.date
        : `${ym.slice(0,4)}-${ym.slice(5,7)}-${String(t.dayOfMonth).padStart(2,'0')}`;
      return nextDate(a).localeCompare(nextDate(b));
    });
  }, [tasks]);

  const todayStats = useCallback(() => {
    const today = todayStr();
    const ym = getYM(today);
    const dom = new Date().getDate();
    const scheduled = tasks.filter(t => {
      if (t.type === 'one-time') return t.date === today;
      if (t.type === 'recurring-monthly') return t.dayOfMonth === dom;
      return false;
    });
    const done = scheduled.filter(t => {
      if (t.type === 'one-time') return !!t.completedAt;
      if (t.type === 'recurring-monthly') return !!t.completedOccurrences?.[ym];
      return false;
    }).length;
    return { total: scheduled.length, done };
  }, [tasks]);

  // ---------- mutations ----------

  const addTask = useCallback((data) => {
    const base = { id: genId(), ...data };
    if (data.type === 'recurring-monthly') {
      base.completedOccurrences = {};
      base.notifiedMonths = [];
    }
    if (data.type === 'backlog') base.missedDot = false;
    persist([...tasks, base]);
  }, [tasks, persist]);

  const deleteTask = useCallback((id) => {
    persist(tasks.filter(t => t.id !== id));
  }, [tasks, persist]);

  const completeTask = useCallback((id) => {
    const today = todayStr();
    const ym = getYM(today);
    persist(tasks.map(t => {
      if (t.id !== id) return t;
      if (t.type === 'one-time') return { ...t, completed: true, completedAt: today };
      if (t.type === 'recurring-monthly') {
        return { ...t, completedOccurrences: { ...t.completedOccurrences, [ym]: today } };
      }
      // backlog
      return { ...t, done: true, completedAt: today };
    }));
  }, [tasks, persist]);

  const rescheduleTask = useCallback((id, newDate) => {
    persist(tasks.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        type: 'one-time',
        date: newDate,
        completed: false,
        completedAt: null,
        missedDot: false,
        done: false,
      };
    }));
  }, [tasks, persist]);

  const updateTask = useCallback((id, changes) => {
    persist(tasks.map(t => t.id === id ? { ...t, ...changes } : t));
  }, [tasks, persist]);

  return {
    tasks,
    addTask,
    deleteTask,
    completeTask,
    rescheduleTask,
    updateTask,
    todayTasks,
    doneTasks,
    backlogTasks,
    upcomingTasks,
    todayStats,
  };
}
