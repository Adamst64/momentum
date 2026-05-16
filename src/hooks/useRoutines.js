import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { todayStr, getDOW, addDays } from '../utils/dateUtils';
import { genId } from '../utils/id';

export function getCompletionCount(routine, dateStr) {
  const val = routine.completions?.[dateStr];
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return 1; // legacy boolean
}

export function getRequiredForDate(routine, dateStr) {
  const history = routine.timesHistory;
  if (history && history.length) {
    const applicable = [...history]
      .sort((a, b) => b.from.localeCompare(a.from))
      .find(h => h.from <= dateStr);
    if (applicable) {
      const dow = getDOW(dateStr);
      const overrides = applicable.timesPerDayByDow || {};
      if (String(dow) in overrides) return overrides[String(dow)];
      return applicable.timesPerDay ?? 1;
    }
  }
  // Fallback for legacy routines without timesHistory
  const dow = getDOW(dateStr);
  const overrides = routine.timesPerDayByDow || {};
  if (String(dow) in overrides) return overrides[String(dow)];
  return routine.timesPerDay ?? 1;
}

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

  const addRoutine = useCallback(async (name, days, timesPerDay = 1, timesPerDayByDow = {}, startDate = null, initialCompletions = {}) => {
    if (!userId) return;
    const id        = genId();
    const today     = todayStr();
    const createdAt = startDate || today;
    const data      = { name, days, completions: initialCompletions, createdAt, scheduleHistory: [{ days, from: createdAt }] };
    if (timesPerDay > 1) data.timesPerDay = timesPerDay;
    if (Object.keys(timesPerDayByDow).length) data.timesPerDayByDow = timesPerDayByDow;
    data.timesHistory = [{ from: createdAt, timesPerDay: timesPerDay ?? 1, timesPerDayByDow: timesPerDayByDow || {} }];
    await setDoc(doc(db, 'users', userId, 'routines', id), data);
  }, [userId]);

  const updateRoutine = useCallback(async (id, name, days, timesPerDay = 1, timesPerDayByDow = {}) => {
    if (!userId) return;
    const routine = routines.find(r => r.id === id);
    const update  = { name, days, timesPerDay: timesPerDay > 1 ? timesPerDay : null, timesPerDayByDow };
    if (routine) {
      const today = todayStr();

      const prevDays    = routine.days || [];
      const daysChanged = days.length !== prevDays.length || !days.every(d => prevDays.includes(d));
      if (daysChanged) {
        const existing = routine.scheduleHistory || [{ days: prevDays, from: routine.createdAt || today }];
        update.scheduleHistory = [...existing.filter(h => h.from !== today), { days, from: today }];
      }

      const sortKeys = obj => JSON.stringify(Object.entries(obj).sort());
      const prevTimes = routine.timesPerDay ?? 1;
      const prevByDow = routine.timesPerDayByDow || {};
      const timesChanged = prevTimes !== timesPerDay || sortKeys(prevByDow) !== sortKeys(timesPerDayByDow || {});
      if (timesChanged) {
        const existing = routine.timesHistory || [{ from: routine.createdAt || today, timesPerDay: prevTimes, timesPerDayByDow: prevByDow }];
        update.timesHistory = [...existing.filter(h => h.from !== today), { from: today, timesPerDay, timesPerDayByDow: timesPerDayByDow || {} }];
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

  const incrementDay = useCallback(async (id, dateStr = todayStr()) => {
    if (!userId) return;
    const routine = routines.find(r => r.id === id);
    if (!routine) return;
    const required    = getRequiredForDate(routine, dateStr);
    const current     = getCompletionCount(routine, dateStr);
    const completions = { ...routine.completions };
    if (current >= required) delete completions[dateStr]; // wrap to 0
    else completions[dateStr] = current + 1;
    await updateDoc(doc(db, 'users', userId, 'routines', id), { completions });
  }, [userId, routines]);

  // Active views: exclude archived, paused (from pausedAt onwards), deferred, and historically paused dates
  const forDate = useCallback((dateStr) => {
    return routines.filter(r => {
      if (r.archived) return false;
      // Exclude paused routines only from their pause date onwards (not retroactively)
      if (r.paused && (!r.pausedAt || dateStr >= r.pausedAt)) return false;
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
    return {
      total: list.length,
      done: list.filter(r => getCompletionCount(r, today) >= getRequiredForDate(r, today)).length,
    };
  }, [todayRoutines]);

  // Day ratio: excludes paused periods so historical charts aren't polluted
  const dayRatio = useCallback((dateStr) => {
    const list = routines.filter(r => {
      if (r.archived) return false;
      if (r.paused && (!r.pausedAt || dateStr >= r.pausedAt)) return false;
      if (wasPausedOn(r, dateStr)) return false;
      if (r.activeFrom && dateStr < r.activeFrom) return false;
      if (r.createdAt && r.createdAt > dateStr) return false;
      return getScheduleForDate(r, dateStr).includes(getDOW(dateStr));
    });
    if (!list.length) return null;
    const sum = list.reduce((acc, r) => {
      const required = getRequiredForDate(r, dateStr);
      const count    = getCompletionCount(r, dateStr);
      return acc + Math.min(count, required) / required;
    }, 0);
    return sum / list.length;
  }, [routines]);

  return {
    routines, addRoutine, updateRoutine,
    deleteRoutine, archiveRoutine, unarchiveRoutine, restoreDeletedRoutine,
    pauseRoutine, unpauseRoutine, addPausedRange,
    incrementDay, forDate, todayRoutines, todayStats, dayRatio,
  };
}
