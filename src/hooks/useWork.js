import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { genId, } from '../utils/id';
import { CREW_COLORS } from '../utils/workUtils';

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
      onSnapshot(collection(db, 'users', userId, 'workCrews'),   s => setCrews(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'users', userId, 'workMembers'), s => setMembers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [userId]);

  const saveDay = useCallback(async (ds, data) => {
    await setDoc(doc(db, 'users', userId, 'workDays', ds), data);
  }, [userId]);

  const deleteDay = useCallback(async (ds) => {
    await deleteDoc(doc(db, 'users', userId, 'workDays', ds));
  }, [userId]);

  // paid: boolean — toggles per-crew payment status within a week doc
  const setWeekPaid = useCallback(async (mondayId, crewId, paid) => {
    await setDoc(
      doc(db, 'users', userId, 'workWeeks', mondayId),
      { [crewId]: paid },
      { merge: true },
    );
  }, [userId]);

  const addCrew = useCallback(async (name, color) => {
    await setDoc(doc(db, 'users', userId, 'workCrews', genId()), { name: name.trim(), color: color || CREW_COLORS[0] });
  }, [userId]);

  const updateCrewColor = useCallback(async (id, color) => {
    await updateDoc(doc(db, 'users', userId, 'workCrews', id), { color });
  }, [userId]);

  const deleteCrew = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'workCrews', id));
  }, [userId]);

  const addMember = useCallback(async (name) => {
    await setDoc(doc(db, 'users', userId, 'workMembers', genId()), { name: name.trim() });
  }, [userId]);

  const deleteMember = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'workMembers', id));
  }, [userId]);

  return { days, weeks, crews, members, saveDay, deleteDay, setWeekPaid, addCrew, updateCrewColor, deleteCrew, addMember, deleteMember };
}
