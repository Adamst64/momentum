import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { todayStr } from '../utils/dateUtils';
import { genId } from '../utils/id';

export function useCommitments(userId) {
  const [commitments, setCommitments] = useState([]);

  useEffect(() => {
    if (!userId) { setCommitments([]); return; }
    const col = collection(db, 'users', userId, 'commitments');
    return onSnapshot(col, snap => {
      setCommitments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [userId]);

  const addCommitment = useCallback(async (name, lastFailedDate = null) => {
    if (!userId) return;
    const id = genId();
    await setDoc(doc(db, 'users', userId, 'commitments', id), {
      name,
      createdAt: lastFailedDate || todayStr(),
      failures: lastFailedDate ? { [lastFailedDate]: true } : {},
      ...(lastFailedDate ? { seedDate: lastFailedDate } : {}),
    });
  }, [userId]);

  const updateCommitment = useCallback(async (id, name) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'commitments', id), { name });
  }, [userId]);

  const deleteCommitment = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'commitments', id));
  }, [userId]);

  const toggleFailed = useCallback(async (id, dateStr = todayStr()) => {
    if (!userId) return;
    const commitment = commitments.find(c => c.id === id);
    if (!commitment) return;
    const failures = { ...commitment.failures };
    if (failures[dateStr]) delete failures[dateStr];
    else failures[dateStr] = true;
    await updateDoc(doc(db, 'users', userId, 'commitments', id), { failures });
  }, [userId, commitments]);

  return { commitments, addCommitment, updateCommitment, deleteCommitment, toggleFailed };
}
