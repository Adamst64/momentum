import { useState, useCallback } from 'react';
import { todayStr, getDOW } from '../utils/dateUtils';
import { genId } from '../utils/id';

const KEY = 'momentum_routines';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

export function useRoutines() {
  const [routines, setRoutines] = useState(load);

  const persist = useCallback((next) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setRoutines(next);
  }, []);

  const addRoutine = useCallback((name, days) => {
    persist([...routines, {
      id: genId(),
      name,
      days,           // number[] 0-6
      completions: {}, // { 'YYYY-MM-DD': true }
    }]);
  }, [routines, persist]);

  const updateRoutine = useCallback((id, name, days) => {
    persist(routines.map(r => r.id === id ? { ...r, name, days } : r));
  }, [routines, persist]);

  const deleteRoutine = useCallback((id) => {
    persist(routines.filter(r => r.id !== id));
  }, [routines, persist]);

  const toggleDay = useCallback((id, dateStr = todayStr()) => {
    persist(routines.map(r => {
      if (r.id !== id) return r;
      const c = { ...r.completions };
      if (c[dateStr]) delete c[dateStr];
      else c[dateStr] = true;
      return { ...r, completions: c };
    }));
  }, [routines, persist]);

  const forDate = useCallback((dateStr) => {
    const dow = getDOW(dateStr);
    return routines.filter(r => r.days.includes(dow));
  }, [routines]);

  const todayRoutines = useCallback(() => forDate(todayStr()), [forDate]);

  const todayStats = useCallback(() => {
    const today = todayStr();
    const list = todayRoutines();
    return { total: list.length, done: list.filter(r => r.completions[today]).length };
  }, [todayRoutines]);

  // null → no routines, 0–1 ratio
  const dayRatio = useCallback((dateStr) => {
    const list = forDate(dateStr);
    if (!list.length) return null;
    return list.filter(r => r.completions[dateStr]).length / list.length;
  }, [forDate]);

  return { routines, addRoutine, updateRoutine, deleteRoutine, toggleDay, forDate, todayRoutines, todayStats, dayRatio };
}
