import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { genId } from '../utils/id';

export function useBirthdays(userId) {
  const [birthdays, setBirthdays] = useState([]);

  useEffect(() => {
    if (!userId) { setBirthdays([]); return; }
    const col = collection(db, 'users', userId, 'birthdays');
    return onSnapshot(col, snap => {
      setBirthdays(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [userId]);

  const addBirthday = useCallback(async (name, month, day, year) => {
    if (!userId) return;
    const id = genId();
    await setDoc(doc(db, 'users', userId, 'birthdays', id), {
      name, month, day, year: year || null,
    });
  }, [userId]);

  const updateBirthday = useCallback(async (id, name, month, day, year) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'birthdays', id), {
      name, month, day, year: year || null,
    });
  }, [userId]);

  const deleteBirthday = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'birthdays', id));
  }, [userId]);

  return { birthdays, addBirthday, updateBirthday, deleteBirthday };
}
