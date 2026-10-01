import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { genId } from '../utils/id';
import { todayStr } from '../utils/dateUtils';

// Journal entries: { date: 'YYYY-MM-DD', mood: 1-5 | null, text, createdAt, updatedAt }
export function useNotes(userId) {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (!userId) { setNotes([]); return; }
    return onSnapshot(collection(db, 'users', userId, 'notes'), snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [userId]);

  const addNote = useCallback(async ({ date, mood = null, text }) => {
    if (!userId || !text.trim()) return;
    const now = new Date().toISOString();
    await setDoc(doc(db, 'users', userId, 'notes', genId()), {
      date: date || todayStr(), mood, text: text.trim(), createdAt: now, updatedAt: now,
    });
  }, [userId]);

  const updateNote = useCallback(async (id, { date, mood = null, text }) => {
    if (!userId || !text.trim()) return;
    await updateDoc(doc(db, 'users', userId, 'notes', id), {
      date, mood, text: text.trim(), updatedAt: new Date().toISOString(),
    });
  }, [userId]);

  const deleteNote = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'notes', id));
  }, [userId]);

  // Newest first; same-day entries by creation time
  const sorted = [...notes].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

  return { notes: sorted, addNote, updateNote, deleteNote };
}
