import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { genId } from '../utils/id';

export function useShoppingList(userId) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!userId) { setItems([]); return; }
    const col = collection(db, 'users', userId, 'shopping');
    return onSnapshot(col, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return (a.order || 0) - (b.order || 0);
      });
      setItems(docs);
    });
  }, [userId]);

  const addItem = useCallback(async (name) => {
    if (!userId || !name.trim()) return;
    const id = genId();
    await setDoc(doc(db, 'users', userId, 'shopping', id), {
      name: name.trim(),
      checked: false,
      order: Date.now(),
    });
  }, [userId]);

  const toggleItem = useCallback(async (id) => {
    if (!userId) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    await updateDoc(doc(db, 'users', userId, 'shopping', id), { checked: !item.checked });
  }, [userId, items]);

  const deleteItem = useCallback(async (id) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'shopping', id));
  }, [userId]);

  const clearFinished = useCallback(async () => {
    if (!userId) return;
    const finished = items.filter(i => i.checked);
    if (!finished.length) return;
    const batch = writeBatch(db);
    finished.forEach(item => batch.delete(doc(db, 'users', userId, 'shopping', item.id)));
    await batch.commit();
  }, [userId, items]);

  const clearAll = useCallback(async () => {
    if (!userId || !items.length) return;
    const batch = writeBatch(db);
    items.forEach(item => batch.delete(doc(db, 'users', userId, 'shopping', item.id)));
    await batch.commit();
  }, [userId, items]);

  return { items, addItem, toggleItem, deleteItem, clearFinished, clearAll };
}
