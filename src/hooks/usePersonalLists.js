import { useState, useCallback, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { genId } from '../utils/id';
import { todayStr } from '../utils/dateUtils';

// Personal lists live in users/{uid}/personalLists/{id}:
// { name, kind: 'try' | 'checklist', createdAt, items: [{ id, text, done, doneAt }] }
// 'try'       — movies, books, places… done items keep the date they were done
// 'checklist' — reusable (packing) lists that can be reset to all-unchecked
export function usePersonalLists(userId) {
  const [lists, setLists] = useState([]);

  useEffect(() => {
    if (!userId) { setLists([]); return; }
    return onSnapshot(collection(db, 'users', userId, 'personalLists'), snap => {
      setLists(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
    });
  }, [userId]);

  const ref = useCallback(id => doc(db, 'users', userId, 'personalLists', id), [userId]);

  const setItems = useCallback(async (listId, updater) => {
    const list = lists.find(l => l.id === listId);
    if (!userId || !list) return;
    await updateDoc(ref(listId), { items: updater(list.items || []) });
  }, [userId, lists, ref]);

  const createList = useCallback(async (name, kind) => {
    if (!userId || !name.trim()) return null;
    const id = genId();
    await setDoc(ref(id), { name: name.trim(), kind, createdAt: new Date().toISOString(), items: [] });
    return id;
  }, [userId, ref]);

  const renameList = useCallback(async (listId, name) => {
    if (!userId || !name.trim()) return;
    await updateDoc(ref(listId), { name: name.trim() });
  }, [userId, ref]);

  const deleteList = useCallback(async (listId) => {
    if (!userId) return;
    await deleteDoc(ref(listId));
  }, [userId, ref]);

  const addItem = useCallback((listId, text) => {
    if (!text.trim()) return;
    return setItems(listId, items => [...items, { id: genId(), text: text.trim(), done: false, doneAt: null }]);
  }, [setItems]);

  const toggleItem = useCallback((listId, itemId) =>
    setItems(listId, items => items.map(i => i.id === itemId
      ? { ...i, done: !i.done, doneAt: i.done ? null : todayStr() }
      : i)), [setItems]);

  const deleteItem = useCallback((listId, itemId) =>
    setItems(listId, items => items.filter(i => i.id !== itemId)), [setItems]);

  const resetList = useCallback((listId) =>
    setItems(listId, items => items.map(i => ({ ...i, done: false, doneAt: null }))), [setItems]);

  return { lists, createList, renameList, deleteList, addItem, toggleItem, deleteItem, resetList };
}
