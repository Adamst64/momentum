import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

// Also told when data that came from the local cache is confirmed by the server,
// so "loaded" (used before anything is synced or cleaned up) can wait for that
const META = { includeMetadataChanges: true };
import { genId, } from '../utils/id';
import { CREW_COLORS, getMondayId, dayEntries, parsePayEntry } from '../utils/workUtils';

// Crews and members keep the order the user dragged them into ({ order: n });
// older ones without it go last, by name
const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.name || '').localeCompare(b.name || '');
const nextOrder = list => list.reduce((m, x) => Math.max(m, x.order ?? -1), -1) + 1;

export function useWork(userId) {
  const [days,    setDays]    = useState([]);
  const [weeks,   setWeeks]   = useState([]);
  const [crews,   setCrews]   = useState([]);
  const [members, setMembers] = useState([]);
  const [got,     setGot]     = useState({}); // which collections have arrived

  useEffect(() => {
    if (!userId) { setGot({}); return; }
    const unsubs = [
      onSnapshot(collection(db, 'users', userId, 'workDays'),    s => setDays(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'users', userId, 'workWeeks'), META, s => { setWeeks(s.docs.map(d => ({ id: d.id, ...d.data() }))); if (!s.metadata.fromCache) setGot(g => ({ ...g, weeks: true })); }),
      onSnapshot(collection(db, 'users', userId, 'workCrews'), META, s => { setCrews(s.docs.map(d => ({ id: d.id, ...d.data() })).sort(byOrder)); if (!s.metadata.fromCache) setGot(g => ({ ...g, crews: true })); }),
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

  // paidAt: when it was first marked paid (the budget uses it to file the pay on that day)
  // Trip-only day pay: status 'paid' (with amount), 'unpaid', or null to reopen it
  // paidAt: when it was marked paid (the budget files the pay on that day)
  const setTripPay = useCallback(async (ds, status, amount = 0) => {
    const prev = days.find(d => d.id === ds)?.tripPay;
    const paidAt = status === 'paid' ? (prev?.status === 'paid' && prev.paidAt) || new Date().toISOString() : null;
    await updateDoc(doc(db, 'users', userId, 'workDays', ds), {
      tripPay: status
        ? { status, amount: status === 'paid' ? Number(amount) || 0 : 0, ...(paidAt ? { paidAt } : {}) }
        : deleteField(),
    });
  }, [userId, days]);

  const setWeekPayment = useCallback(async (mondayId, crewId, paid, amount) => {
    const prev = weeks.find(w => w.id === mondayId)?.[crewId];
    const wasPaid = parsePayEntry(prev).paid;
    const paidAt = paid ? (wasPaid && prev?.paidAt) || new Date().toISOString() : deleteField();
    await setDoc(
      doc(db, 'users', userId, 'workWeeks', mondayId),
      { [crewId]: { paid, amount: Number(amount) || 0, paidAt } },
      { merge: true },
    );
  }, [userId, weeks]);

  const addCrew = useCallback(async (name, color) => {
    await setDoc(doc(db, 'users', userId, 'workCrews', genId()), { name: name.trim(), color: color || CREW_COLORS[0], order: nextOrder(crews) });
  }, [userId, crews]);

  const updateCrewColor = useCallback(async (id, color) => {
    await updateDoc(doc(db, 'users', userId, 'workCrews', id), { color });
  }, [userId]);

  const deleteCrew = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'workCrews', id));
  }, [userId]);

  // Optional number that this crew's weekly summary is texted to. Also saves the
  // timezone so the Friday 3 PM reminder fires in local time.
  const updateCrewPhone = useCallback(async (id, phone) => {
    const clean = (phone || '').trim();
    await updateDoc(doc(db, 'users', userId, 'workCrews', id), { phone: clean || deleteField() });
    if (clean) {
      await setDoc(doc(db, 'users', userId), {
        preferences: { workTexts: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
      }, { merge: true });
    }
  }, [userId]);

  // Remember that last week's summary was opened in Messages for this crew
  const markCrewTexted = useCallback(async (id, mondayId) => {
    await updateDoc(doc(db, 'users', userId, 'workCrews', id), { lastTextedWeek: mondayId });
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

  const loaded = !!(got.weeks && got.crews);

  return { loaded, days, weeks, crews, members, saveDay, deleteDay, setWeekPayment, setTripPay, addCrew, updateCrewColor, updateCrewPhone, markCrewTexted, deleteCrew, addMember, deleteMember, reorderCrews, reorderMembers };
}
