import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { todayStr, getDOW, addDays } from '../utils/dateUtils';
import { genId } from '../utils/id';

export function getScheduleForDate(routine, dateStr) {
  const history = routine.scheduleHistory;
  if (!history || !history.length) return routine.days;
  const applicable = [...history]
    .sort((a, b) => b.from.localeCompare(a.from))
    .find(h => h.from <= dateStr);
  return applicable ? applicable.days : routine.days;
}

// Returns true if the routine was paused on the given date
function wasPausedOn(routine, dateStr) {
  if (routine.paused && routine.pausedAt && dateStr >= routine.pausedAt) return true;
  return (routine.pausedRanges || []).some(pr => dateStr >= pr.from && dateStr <= pr.to);
}

export function useRoutines(userId) {
  const [routines, setRoutines] = useState([]);

  useEffect(() => {
    if (!userId) { setRoutines([]); return; }
    const col = collection(db, 'users', userId, 'routines');
    return onSnapshot(col, snap => {
      setRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [userId]);

  const addRoutine = useCallback(async (name, days) => {
    if (!userId) return;
    const id    = genId();
    const today = todayStr();
    await setDoc(doc(db, 'users', userId, 'routines', id), {
      name, days, completions: {}, createdAt: today,
      scheduleHistory: [{ days, from: today }],
    });
  }, [userId]);

  const updateRoutine = useCallback(async (id, name, days) => {
    if (!userId) return;
    const routine = routines.find(r => r.id === id);
    const update  = { name, days };
    if (routine) {
      const prevDays    = routine.days || [];
      const daysChanged = days.length !== prevDays.length || !days.every(d => prevDays.includes(d));
      if (daysChanged) {
        const today    = todayStr();
        const existing = routine.scheduleHistory || [{ days: prevDays, from: routine.createdAt || today }];
        const filtered = existing.filter(h => h.from !== today);
        update.scheduleHistory = [...filtered, { days, from: today }];
      }
    }
    await updateDoc(doc(db, 'users', userId, 'routines', id), update);
  }, [userId, routines]);

  const deleteRoutine = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'routines', id));
  }, [userId]);

  // Soft-delete: hides from active views but keeps completion history in monthly calendar
  const archiveRoutine = useCallback(async (id) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'routines', id), { archived: true });
  }, [userId]);

  const unarchiveRoutine = useCallback(async (id) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'routines', id), { archived: false });
  }, [userId]);

  // Pause: record pausedAt so we can exclude those days from history on resume
  const pauseRoutine = useCallback(async (id) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'routines', id), { paused: true, pausedAt: todayStr() });
  }, [userId]);

  // Resume: record the pause range so historical charts stay accurate
  // startTomorrow=true → today is still excluded; routine becomes active from tomorrow
  const unpauseRoutine = useCallback(async (id, startTomorrow = false) => {
    if (!userId) return;
    const routine = routines.find(r => r.id === id);
    const today = todayStr();
    const rangeFrom = routine?.pausedAt || today;
    // "start today" excludes up to yesterday; "start tomorrow" excludes up to today
    const rangeTo = startTomorrow ? today : addDays(today, -1);
    const update = { paused: false, pausedAt: null, activeFrom: null };
    if (rangeFrom <= rangeTo) {
      update.pausedRanges = [...(routine?.pausedRanges || []), { from: rangeFrom, to: rangeTo }];
    }
    if (startTomorrow) {
      update.activeFrom = addDays(today, 1);
    }
    await updateDoc(doc(db, 'users', userId, 'routines', id), update);
  }, [userId, routines]);

  // Manually add a paused date range (backfill for routines paused before history tracking)
  const addPausedRange = useCallback(async (id, from, to) => {
    if (!userId || !from || !to || from > to) return;
    const routine = routines.find(r => r.id === id);
    if (!routine) return;
    const existing = routine.pausedRanges || [];
    await updateDoc(doc(db, 'users', userId, 'routines', id), {
      pausedRanges: [...existing, { from, to }],
    });
  }, [userId, routines]);

  // Restores a previously deleted routine document (for undo)
  const restoreDeletedRoutine = useCallback(async (routine) => {
    if (!userId) return;
    const { id, ...data } = routine;
    await setDoc(doc(db, 'users', userId, 'routines', id), data);
  }, [userId]);

  const toggleDay = useCallback(async (id, dateStr = todayStr()) => {
    if (!userId) return;
    const routine = routines.find(r => r.id === id);
    if (!routine) return;
    const completions = { ...routine.completions };
    if (completions[dateStr]) delete completions[dateStr];
    else completions[dateStr] = true;
    await updateDoc(doc(db, 'users', userId, 'routines', id), { completions });
  }, [userId, routines]);

  // Active views: exclude archived, paused, deferred (activeFrom), and historically paused dates
  const forDate = useCallback((dateStr) => {
    return routines.filter(r => {
      if (r.archived || r.paused) return false;
      if (r.activeFrom && dateStr < r.activeFrom) return false;
      if (wasPausedOn(r, dateStr)) return false;
      if (r.createdAt && r.createdAt > dateStr) return false;
      return getScheduleForDate(r, dateStr).includes(getDOW(dateStr));
    });
  }, [routines]);

  const todayRoutines = useCallback(() => forDate(todayStr()), [forDate]);

  const todayStats = useCallback(() => {
    const today = todayStr();
    const list  = todayRoutines();
    return { total: list.length, done: list.filter(r => r.completions[today]).length };
  }, [todayRoutines]);

  // Day ratio: excludes paused periods so historical charts aren't polluted
  const dayRatio = useCallback((dateStr) => {
    const list = routines.filter(r => {
      if (r.archived) return false;
      if (wasPausedOn(r, dateStr)) return false;
      if (r.activeFrom && dateStr < r.activeFrom) return false;
      if (r.createdAt && r.createdAt > dateStr) return false;
      return getScheduleForDate(r, dateStr).includes(getDOW(dateStr));
    });
    if (!list.length) return null;
    return list.filter(r => r.completions?.[dateStr]).length / list.length;
  }, [routines]);

  return {
    routines, addRoutine, updateRoutine,
    deleteRoutine, archiveRoutine, unarchiveRoutine, restoreDeletedRoutine,
    pauseRoutine, unpauseRoutine, addPausedRange,
    toggleDay, forDate, todayRoutines, todayStats, dayRatio,
  };
}
