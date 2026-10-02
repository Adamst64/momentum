import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { genId, } from '../utils/id';
import { CREW_COLORS, getMondayId, dayEntries } from '../utils/workUtils';

// Crews and members keep the order the user dragged them into ({ order: n });
// older ones without it go last, by name
const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.name || '').localeCompare(b.name || '');
const nextOrder = list => list.reduce((m, x) => Math.max(m, x.order ?? -1), -1) + 1;

export function useWork(userId) {
  const [days,    setDays]    = useState([]);
  const [weeks,   setWeeks]   = useState([]);
  const [crews,   setCrews]   = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const unsubs = [
      onSnapshot(collection(db, 'users', userId, 'workDays'),    s => setDays(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'users', userId, 'workWeeks'),   s => setWeeks(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'users', userId, 'workCrews'),   s => setCrews(s.docs.map(d => ({ id: d.id, ...d.data() })).sort(byOrder))),
      onSnapshot(collection(db, 'users', userId, 'workMembers'), s => setMembers(s.docs.map(d => ({ id: d.id, ...d.data() })).sort(byOrder))),
    ];
    return () => unsubs.forEach(u => u());
  }, [userId]);

  const saveDay = useCallback(async (ds, data) => {
    await setDoc(doc(db, 'users', userId, 'workDays', ds), data);
  }, [userId]);

  const deleteDay = useCallback(async (ds) => {
    const crewIds = dayEntries(days.find(d => d.id === ds)).map(e => e.crewId).filter(Boolean);
    await deleteDoc(doc(db, 'users', userId, 'workDays', ds));

    // Drop a crew's payment for the week if this was its last day there
    const mondayId = getMondayId(ds);
    for (const crewId of new Set(crewIds)) {
      const stillHasDays = days.some(d =>
        d.id !== ds && getMondayId(d.id) === mondayId && dayEntries(d).some(e => e.crewId === crewId)
      );
      if (!stillHasDays) {
        try {
          await updateDoc(
            doc(db, 'users', userId, 'workWeeks', mondayId),
            { [crewId]: deleteField() },
          );
        } catch (_) { /* week doc didn't exist, nothing to clean up */ }
      }
    }
  }, [userId, days]);

  const setWeekPayment = useCallback(async (mondayId, crewId, paid, amount) => {
    await setDoc(
      doc(db, 'users', userId, 'workWeeks', mondayId),
      { [crewId]: { paid, amount: Number(amount) || 0 } },
      { merge: true },
    );
  }, [userId]);

  const addCrew = useCallback(async (name, color) => {
    await setDoc(doc(db, 'users', userId, 'workCrews', genId()), { name: name.trim(), color: color || CREW_COLORS[0], order: nextOrder(crews) });
  }, [userId, crews]);

  const updateCrewColor = useCallback(async (id, color) => {
    await updateDoc(doc(db, 'users', userId, 'workCrews', id), { color });
  }, [userId]);

  const deleteCrew = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'workCrews', id));
  }, [userId]);

  const addMember = useCallback(async (name) => {
    await setDoc(doc(db, 'users', userId, 'workMembers', genId()), { name: name.trim(), order: nextOrder(members) });
  }, [userId, members]);

  // Save a new order (array of ids) for crews or members
  const reorder = useCallback(async (coll, ids) => {
    const batch = writeBatch(db);
    ids.forEach((id, i) => batch.update(doc(db, 'users', userId, coll, id), { order: i }));
    await batch.commit();
  }, [userId]);
  const reorderCrews   = useCallback(ids => reorder('workCrews', ids), [reorder]);
  const reorderMembers = useCallback(ids => reorder('workMembers', ids), [reorder]);

  const deleteMember = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'workMembers', id));
  }, [userId]);

  return { days, weeks, crews, members, saveDay, deleteDay, setWeekPayment, addCrew, updateCrewColor, deleteCrew, addMember, deleteMember, reorderCrews, reorderMembers };
}
