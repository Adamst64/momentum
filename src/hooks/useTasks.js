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
      if (t.type === 'one-time' && t.date < today && !t.completedAt) return true;
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

  const addTask = useCallback(async (data) => {
    if (!userId) return;
    const id = genId();
    const base = { id, ...data };
    if (data.type === 'recurring-monthly') {
      base.completedOccurrences = {};
      base.notifiedMonths = [];
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

  const rescheduleTask = useCallback(async (id, newDate) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'tasks', id), {
      type: 'one-time',
      date: newDate,
      completed: false,
      completedAt: null,
      missedDot: false,
      done: false,
    });
  }, [userId]);

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
    upcomingTasks,
    todayStats,
  };
}
