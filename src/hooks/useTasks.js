import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { todayStr, getYM } from '../utils/dateUtils';
import { genId } from '../utils/id';

export function useTasks(userId) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!userId) { setTasks([]); return; }
    const col = collection(db, 'users', userId, 'tasks');
    return onSnapshot(col, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [userId]);

  // ---------- queries ----------

  const todayTasks = useCallback(() => {
    const today = todayStr();
    const ym  = today.slice(0, 7);
    const dom = parseInt(today.slice(-2), 10);
    return tasks.filter(t => {
      if (t.type === 'one-time') return t.date === today;
      if (t.type === 'recurring-monthly') {
        if (t.createdAt && today < t.createdAt) return false;
        let day = t.monthOverrides?.[ym] ?? t.dayOfMonth;
        // If genuinely missed (existed on original due day), roll to today
        if (day < dom) {
          const dueDateStr = `${ym}-${String(day).padStart(2, '0')}`;
          if (!t.createdAt || t.createdAt <= dueDateStr) day = dom;
        }
        return day === dom;
      }
      return false;
    });
  }, [tasks]);

  const tasksForDate = useCallback((dateStr) => {
    const ym    = dateStr.slice(0, 7);
    const dom   = parseInt(dateStr.slice(-2), 10);
    const today = todayStr();
    const isToday = dateStr === today;
    return tasks
      .filter(t => {
        if (t.type === 'one-time') return t.date === dateStr;
        if (t.type === 'recurring-monthly') {
          if (t.createdAt && dateStr < t.createdAt) return false;
          let day = t.monthOverrides?.[ym] ?? t.dayOfMonth;
          // For today: roll to today if task was genuinely missed (existed on original due day)
          if (isToday && ym === today.slice(0, 7) && day < dom) {
            const dueDateStr = `${ym}-${String(day).padStart(2, '0')}`;
            if (!t.createdAt || t.createdAt <= dueDateStr) day = dom;
          }
          return day === dom;
        }
        if (t.type === 'backlog') return t.completedAt === dateStr;
        return false;
      })
      .map(t => {
        let done = false;
        if (t.type === 'one-time') done = t.completedAt === dateStr;
        else if (t.type === 'recurring-monthly') done = !!t.completedOccurrences?.[ym];
        else if (t.type === 'backlog') done = true;
        return { task: t, done };
      });
  }, [tasks]);

  const toggleTaskForDate = useCallback(async (id, dateStr) => {
    if (!userId) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const ym = dateStr.slice(0, 7);
    let changes;
    if (task.type === 'one-time') {
      const isDone = task.completedAt === dateStr;
      changes = isDone
        ? { completed: false, completedAt: null }
        : { completed: true, completedAt: dateStr };
    } else if (task.type === 'recurring-monthly') {
      const isDone = !!task.completedOccurrences?.[ym];
      changes = { completedOccurrences: { ...task.completedOccurrences, [ym]: isDone ? null : dateStr } };
    } else if (task.type === 'backlog') {
      const isDone = task.completedAt === dateStr;
      changes = isDone ? { done: false, completedAt: null } : { done: true, completedAt: dateStr };
    }
    if (changes) await updateDoc(doc(db, 'users', userId, 'tasks', id), changes);
  }, [userId, tasks]);

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
    return tasks
      .filter(t => {
        if (t.type === 'backlog') return !t.completedAt;
        if (t.type === 'one-time' && t.date < today && !t.completedAt) return true;
        return false;
      })
      .map(t => ({ task: t, missed: t.type === 'one-time' }));
  }, [tasks]);

  const scheduledTasks = useCallback(() => {
    const today = todayStr();
    return tasks.filter(t => {
      if (t.type === 'one-time') return t.date > today && !t.completedAt;
      return false;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks]);

  const monthlyTasks = useCallback(() => {
    return tasks
      .filter(t => t.type === 'recurring-monthly')
      .sort((a, b) => (a.dayOfMonth ?? 1) - (b.dayOfMonth ?? 1));
  }, [tasks]);

  const todayStats = useCallback(() => {
    const today = todayStr();
    const ym  = getYM(today);
    const dom = new Date().getDate();
    const scheduled = tasks.filter(t => {
      if (t.type === 'one-time') return t.date === today;
      if (t.type === 'recurring-monthly') {
        if (t.createdAt && today < t.createdAt) return false;
        let day = t.monthOverrides?.[ym] ?? t.dayOfMonth;
        if (day < dom) {
          const dueDateStr = `${ym}-${String(day).padStart(2, '0')}`;
          if (!t.createdAt || t.createdAt <= dueDateStr) day = dom;
        }
        return day === dom;
      }
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

  const addTask = useCallback(async (data) => {
    if (!userId) return;
    const id = genId();
    const base = { id, createdAt: todayStr(), ...data };
    if (data.type === 'recurring-monthly') {
      base.completedOccurrences = {};
    }
    if (data.type === 'backlog') base.missedDot = false;
    await setDoc(doc(db, 'users', userId, 'tasks', id), base);
  }, [userId]);

  const deleteTask = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'tasks', id));
  }, [userId]);

  const completeTask = useCallback(async (id) => {
    if (!userId) return;
    const today = todayStr();
    const ym = getYM(today);
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    let changes;
    if (task.type === 'one-time') {
      changes = { completed: true, completedAt: today };
    } else if (task.type === 'recurring-monthly') {
      changes = { completedOccurrences: { ...task.completedOccurrences, [ym]: today } };
    } else {
      changes = { done: true, completedAt: today };
    }
    await updateDoc(doc(db, 'users', userId, 'tasks', id), changes);
  }, [userId, tasks]);

  const rescheduleTask = useCallback(async (id, newDate, sourceYM) => {
    if (!userId) return;
    const task = tasks.find(t => t.id === id);
    if (task?.type === 'recurring-monthly') {
      // Override just the specified month; all others keep their own day
      const ym     = sourceYM || newDate.slice(0, 7);
      const newDay = parseInt(newDate.slice(-2), 10);
      await updateDoc(doc(db, 'users', userId, 'tasks', id), {
        monthOverrides: { ...(task.monthOverrides || {}), [ym]: newDay },
      });
    } else {
      await updateDoc(doc(db, 'users', userId, 'tasks', id), {
        type: 'one-time',
        date: newDate,
        completed: false,
        completedAt: null,
        missedDot: false,
        done: false,
      });
    }
  }, [userId, tasks]);

  const updateTask = useCallback(async (id, changes) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'tasks', id), changes);
  }, [userId]);

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
    scheduledTasks,
    monthlyTasks,
    todayStats,
    tasksForDate,
    toggleTaskForDate,
  };
}
