import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { todayStr, getDOW } from '../utils/dateUtils';
import { genId } from '../utils/id';

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
    const id = genId();
    await setDoc(doc(db, 'users', userId, 'routines', id), { name, days, completions: {} });
  }, [userId]);

  const updateRoutine = useCallback(async (id, name, days) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'routines', id), { name, days });
  }, [userId]);

  const deleteRoutine = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'routines', id));
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

  const dayRatio = useCallback((dateStr) => {
    const list = forDate(dateStr);
    if (!list.length) return null;
    return list.filter(r => r.completions[dateStr]).length / list.length;
  }, [forDate]);

  return { routines, addRoutine, updateRoutine, deleteRoutine, toggleDay, forDate, todayRoutines, todayStats, dayRatio };
}
