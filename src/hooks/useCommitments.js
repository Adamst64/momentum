import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { todayStr } from '../utils/dateUtils';
import { genId } from '../utils/id';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export function useCommitments(userId) {
  const [commitments, setCommitments] = useState([]);

  useEffect(() => {
    if (!userId) { setCommitments([]); return; }
    const col = collection(db, 'users', userId, 'commitments');
    return onSnapshot(col, snap => {
      setCommitments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [userId]);

  // days: weekdays it applies to (0 = Sunday); omitted means every day
  const addCommitment = useCallback(async (name, lastFailedDate = null, days = null) => {
    if (!userId) return;
    const id = genId();
    await setDoc(doc(db, 'users', userId, 'commitments', id), {
      name,
      createdAt: lastFailedDate || todayStr(),
      failures: lastFailedDate ? { [lastFailedDate]: true } : {},
      ...(lastFailedDate ? { seedDate: lastFailedDate } : {}),
      ...(days ? { days } : {}),
    });
  }, [userId]);

  // Changing the days applies from today on; earlier days keep the old schedule
  const updateCommitment = useCallback(async (id, name, days = null) => {
    if (!userId) return;
    const c = commitments.find(x => x.id === id);
    if (!c) return;
    const update = { name, days: days || deleteField() };
    const asList = d => (Array.isArray(d) ? [...d].sort() : EVERY_DAY);
    if (asList(c.days).join() !== asList(days).join()) {
      const today = todayStr();
      const existing = c.scheduleHistory || [{ days: asList(c.days), from: c.createdAt || today }];
      update.scheduleHistory = [...existing.filter(h => h.from !== today), { days: asList(days), from: today }];
    }
    await updateDoc(doc(db, 'users', userId, 'commitments', id), update);
  }, [userId, commitments]);

  const deleteCommitment = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'commitments', id));
  }, [userId]);

  // Mark a day as a slip, with an optional reason
  const markSlip = useCallback(async (id, dateStr = todayStr(), note = '') => {
    if (!userId) return;
    const c = commitments.find(x => x.id === id);
    if (!c) return;
    const failureNotes = { ...c.failureNotes };
    if (note.trim()) failureNotes[dateStr] = note.trim();
    else delete failureNotes[dateStr];
    await updateDoc(doc(db, 'users', userId, 'commitments', id), {
      failures: { ...c.failures, [dateStr]: true },
      failureNotes,
    });
  }, [userId, commitments]);

  const clearSlip = useCallback(async (id, dateStr = todayStr()) => {
    if (!userId) return;
    const c = commitments.find(x => x.id === id);
    if (!c) return;
    const failures = { ...c.failures };
    const failureNotes = { ...c.failureNotes };
    delete failures[dateStr];
    delete failureNotes[dateStr];
    await updateDoc(doc(db, 'users', userId, 'commitments', id), { failures, failureNotes });
  }, [userId, commitments]);

  return { commitments, addCommitment, updateCommitment, deleteCommitment, markSlip, clearSlip };
}
