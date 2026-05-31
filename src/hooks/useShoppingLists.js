import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { genId } from '../utils/id';

export const TAG_COLORS = [
  '#6BAE5A', // green
  '#C8B87A', // gold
  '#5A9AE0', // blue
  '#A07AE0', // purple
  '#E06AA0', // pink
  '#E0A050', // orange
  '#8A9E52', // olive
  '#E07070', // red
];

function genInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function syncInventoryTags(listId, inventory, normalizedName, tagIds) {
  const inv = inventory.find(i => i.name.toLowerCase() === normalizedName);
  if (!inv) return;
  const existing = inv.tagIds || [];
  const added = tagIds.filter(t => !existing.includes(t));
  if (added.length > 0) {
    await updateDoc(doc(db, 'lists', listId, 'inventory', inv.id), {
      tagIds: [...existing, ...added],
    });
  }
}

async function initPersonalList(userId) {
  const listId = genId();
  await setDoc(doc(db, 'lists', listId), {
    name: 'Shopping',
    ownerId: userId,
    members: [userId],
    inviteCode: genInviteCode(),
    createdAt: new Date().toISOString(),
  });
  // Migrate existing items from old location
  const oldSnap = await getDocs(collection(db, 'users', userId, 'shopping'));
  if (!oldSnap.empty) {
    const batch = writeBatch(db);
    oldSnap.docs.forEach(d => {
      batch.set(doc(db, 'lists', listId, 'items', d.id), { ...d.data(), tagIds: [] });
      batch.delete(d.ref);
    });
    await batch.commit();
  }
}

export function useShoppingLists(userId) {
  const [lists, setLists]               = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [items, setItems]               = useState([]);
  const [tags, setTags]                 = useState([]);
  const [inventory, setInventory]       = useState([]);
  const initRef = useRef(false);

  // Listen to all lists the user is a member of
  useEffect(() => {
    if (!userId) { setLists([]); setItems([]); setTags([]); setInventory([]); setActiveListId(null); return; }
    initRef.current = false;

    const q = query(collection(db, 'lists'), where('members', 'array-contains', userId));
    return onSnapshot(q, async (snap) => {
      const fetched = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

      if (fetched.length === 0 && !initRef.current) {
        initRef.current = true;
        await initPersonalList(userId);
      } else if (fetched.length > 0) {
        setLists(fetched);
        setActiveListId(prev => {
          if (prev && fetched.some(l => l.id === prev)) return prev;
          return fetched.find(l => l.ownerId === userId)?.id || fetched[0].id;
        });
      }
    });
  }, [userId]);

  // Listen to items, tags, and inventory for the active list
  useEffect(() => {
    setItems([]); setTags([]); setInventory([]);
    if (!activeListId) return;

    const itemsUnsub = onSnapshot(collection(db, 'lists', activeListId, 'items'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return (a.order || 0) - (b.order || 0);
      });
      setItems(docs);
    });

    const tagsUnsub = onSnapshot(collection(db, 'lists', activeListId, 'tags'), snap => {
      setTags(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const invUnsub = onSnapshot(collection(db, 'lists', activeListId, 'inventory'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => a.name.localeCompare(b.name));
      setInventory(docs);
    });

    return () => { itemsUnsub(); tagsUnsub(); invUnsub(); };
  }, [activeListId]);

  // ── Items ──────────────────────────────────────────────────────────────────
  const addItem = useCallback(async (name, tagIds = []) => {
    if (!userId || !name.trim() || !activeListId) return;
    const normalizedName = name.trim().toLowerCase();
    const invEnabled = lists.find(l => l.id === activeListId)?.hasInventory || inventory.length > 0;

    // If item with same name already exists in the list, update it instead of duplicating
    const existingItem = items.find(i => i.name.toLowerCase() === normalizedName);
    if (existingItem) {
      const mergedTags = [...new Set([...(existingItem.tagIds || []), ...tagIds])];
      await updateDoc(doc(db, 'lists', activeListId, 'items', existingItem.id), {
        checked: false, tagIds: mergedTags,
      });
      if (invEnabled) await syncInventoryTags(activeListId, inventory, normalizedName, mergedTags);
      return;
    }

    const id = genId();
    await setDoc(doc(db, 'lists', activeListId, 'items', id), {
      name: name.trim(), checked: false, order: Date.now(), tagIds,
    });
    if (invEnabled) {
      // Upsert to inventory (case-insensitive dedup by name)
      const existingInv = inventory.find(i => i.name.toLowerCase() === normalizedName);
      if (!existingInv) {
        await setDoc(doc(db, 'lists', activeListId, 'inventory', genId()), {
          name: name.trim(), tagIds,
        });
      } else {
        await syncInventoryTags(activeListId, inventory, normalizedName, tagIds);
      }
    }
  }, [userId, activeListId, lists, items, inventory]);

  const updateItemTags = useCallback(async (id, tagIds) => {
    if (!activeListId) return;
    const item = items.find(i => i.id === id);
    await updateDoc(doc(db, 'lists', activeListId, 'items', id), { tagIds });
    const invEnabled = lists.find(l => l.id === activeListId)?.hasInventory || inventory.length > 0;
    if (item && invEnabled) await syncInventoryTags(activeListId, inventory, item.name.toLowerCase(), tagIds);
  }, [activeListId, lists, items, inventory]);

  const renameItem = useCallback(async (id, name) => {
    if (!activeListId || !name.trim()) return;
    const item = items.find(i => i.id === id);
    await updateDoc(doc(db, 'lists', activeListId, 'items', id), { name: name.trim() });
    if (!item) return;

    const invEnabled = lists.find(l => l.id === activeListId)?.hasInventory || inventory.length > 0;
    if (!invEnabled) return;

    const oldNorm = item.name.toLowerCase();
    const newNorm = name.trim().toLowerCase();
    if (oldNorm === newNorm) return;

    const oldInv = inventory.find(i => i.name.toLowerCase() === oldNorm);
    const newInv = inventory.find(i => i.name.toLowerCase() === newNorm);

    if (oldInv) {
      if (!newInv) {
        // Rename the inventory entry
        await updateDoc(doc(db, 'lists', activeListId, 'inventory', oldInv.id), { name: name.trim() });
      } else {
        // New name already in inventory: merge tags into it, delete old entry
        const mergedTags = [...new Set([...(newInv.tagIds || []), ...(oldInv.tagIds || [])])];
        await updateDoc(doc(db, 'lists', activeListId, 'inventory', newInv.id), { tagIds: mergedTags });
        await deleteDoc(doc(db, 'lists', activeListId, 'inventory', oldInv.id));
      }
    } else {
      // No inventory entry for old name — create one for the new name if missing
      if (!newInv) {
        await setDoc(doc(db, 'lists', activeListId, 'inventory', genId()), {
          name: name.trim(), tagIds: item.tagIds || [],
        });
      }
    }
  }, [activeListId, lists, items, inventory]);

  const toggleItem = useCallback(async (id) => {
    if (!activeListId) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    await updateDoc(doc(db, 'lists', activeListId, 'items', id), { checked: !item.checked });
  }, [activeListId, items]);

  const deleteItem = useCallback(async (id) => {
    if (!activeListId) return;
    await deleteDoc(doc(db, 'lists', activeListId, 'items', id));
  }, [activeListId]);

  const clearFinished = useCallback(async () => {
    if (!activeListId) return;
    const finished = items.filter(i => i.checked);
    if (!finished.length) return;
    const batch = writeBatch(db);
    finished.forEach(i => batch.delete(doc(db, 'lists', activeListId, 'items', i.id)));
    await batch.commit();
  }, [activeListId, items]);

  const clearAll = useCallback(async () => {
    if (!activeListId || !items.length) return;
    const batch = writeBatch(db);
    items.forEach(i => batch.delete(doc(db, 'lists', activeListId, 'items', i.id)));
    await batch.commit();
  }, [activeListId, items]);

  // ── Tags ───────────────────────────────────────────────────────────────────
  const addTag = useCallback(async (name, color) => {
    if (!activeListId || !name.trim()) return null;
    const id = genId();
    await setDoc(doc(db, 'lists', activeListId, 'tags', id), { name: name.trim(), color });
    return id;
  }, [activeListId]);

  const updateTag = useCallback(async (tagId, updates) => {
    if (!activeListId) return;
    await updateDoc(doc(db, 'lists', activeListId, 'tags', tagId), updates);
  }, [activeListId]);

  const deleteTag = useCallback(async (tagId) => {
    if (!activeListId) return;
    const batch = writeBatch(db);
    items.filter(i => i.tagIds?.includes(tagId)).forEach(item => {
      batch.update(doc(db, 'lists', activeListId, 'items', item.id), {
        tagIds: (item.tagIds || []).filter(t => t !== tagId),
      });
    });
    inventory.filter(i => i.tagIds?.includes(tagId)).forEach(item => {
      batch.update(doc(db, 'lists', activeListId, 'inventory', item.id), {
        tagIds: (item.tagIds || []).filter(t => t !== tagId),
      });
    });
    batch.delete(doc(db, 'lists', activeListId, 'tags', tagId));
    await batch.commit();
  }, [activeListId, items, inventory]);

  // ── Inventory ──────────────────────────────────────────────────────────────
  const updateInventoryItem = useCallback(async (id, changes) => {
    if (!activeListId) return;
    await updateDoc(doc(db, 'lists', activeListId, 'inventory', id), changes);
  }, [activeListId]);

  const deleteInventoryItem = useCallback(async (id) => {
    if (!activeListId) return;
    await deleteDoc(doc(db, 'lists', activeListId, 'inventory', id));
  }, [activeListId]);

  const addItemFromInventory = useCallback(async (invItem) => {
    if (!userId || !activeListId) return;
    const id = genId();
    await setDoc(doc(db, 'lists', activeListId, 'items', id), {
      name: invItem.name, checked: false, order: Date.now(), tagIds: invItem.tagIds || [],
    });
  }, [userId, activeListId]);

  // ── List management ────────────────────────────────────────────────────────
  const createList = useCallback(async (name, hasInventory = false) => {
    if (!userId || !name.trim()) return;
    const id = genId();
    await setDoc(doc(db, 'lists', id), {
      name: name.trim(), ownerId: userId,
      members: [userId], inviteCode: genInviteCode(),
      createdAt: new Date().toISOString(),
      hasInventory,
    });
    setActiveListId(id);
  }, [userId]);

  const renameList = useCallback(async (name) => {
    if (!activeListId || !name.trim()) return;
    await updateDoc(doc(db, 'lists', activeListId), { name: name.trim() });
  }, [activeListId]);

  const leaveOrDeleteList = useCallback(async () => {
    if (!userId || !activeListId) return;
    const list = lists.find(l => l.id === activeListId);
    if (!list) return;

    if (list.members.length <= 1) {
      const batch = writeBatch(db);
      items.forEach(i => batch.delete(doc(db, 'lists', activeListId, 'items', i.id)));
      tags.forEach(t => batch.delete(doc(db, 'lists', activeListId, 'tags', t.id)));
      inventory.forEach(i => batch.delete(doc(db, 'lists', activeListId, 'inventory', i.id)));
      batch.delete(doc(db, 'lists', activeListId));
      await batch.commit();
    } else {
      await updateDoc(doc(db, 'lists', activeListId), {
        members: list.members.filter(m => m !== userId),
      });
    }
    const remaining = lists.filter(l => l.id !== activeListId);
    setActiveListId(remaining[0]?.id || null);
  }, [userId, activeListId, lists, items, tags, inventory]);

  const regenerateCode = useCallback(async () => {
    if (!activeListId) return;
    await updateDoc(doc(db, 'lists', activeListId), { inviteCode: genInviteCode() });
  }, [activeListId]);

  const joinList = useCallback(async (inviteCode) => {
    const fn = httpsCallable(getFunctions(getApp()), 'joinListByCode');
    const result = await fn({ inviteCode: inviteCode.trim().toUpperCase() });
    if (result.data?.listId) setActiveListId(result.data.listId);
    return result.data;
  }, []);

  const activeList = lists.find(l => l.id === activeListId) || null;

  return {
    lists, activeList, activeListId, setActiveListId,
    items, tags, inventory,
    addItem, toggleItem, updateItemTags, renameItem, deleteItem, clearFinished, clearAll,
    addTag, updateTag, deleteTag,
    updateInventoryItem, deleteInventoryItem, addItemFromInventory,
    createList, renameList, leaveOrDeleteList, regenerateCode, joinList,
  };
}
