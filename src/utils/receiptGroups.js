// Your own receipt groups (e.g. 🌷 Flowers) and what the receipt reader learns from
// your fixes. users/{uid}/receiptGroups/{id}:
//   custom group: { custom: true, label, emoji, examples: [item names] }
//   built-in group (id = its id): { examples } — items you moved into it
// The scanner gets all of it, so the next receipt uses your groups and fixes.
import { useSyncExternalStore } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { genId } from './id';

let state = { userId: null, docs: [] };
const listeners = new Set();
const emit = () => listeners.forEach(l => l());

// Called by useBudget whenever the collection changes
export function setReceiptGroups(userId, docs) {
  state = { userId, docs };
  emit();
}
export const customGroups = () => state.docs.filter(d => d.custom && d.label);
export const useReceiptGroups = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state.docs);

const MAX_EXAMPLES = 30;

// New group; returns its id
export async function addReceiptGroup(label, emoji) {
  if (!state.userId) throw new Error('Not signed in');
  const id = `c${genId().replace(/-/g, '').slice(0, 10)}`;
  const d = { custom: true, label: label.trim().slice(0, 40), emoji: (emoji || '').trim() || '🏷️', examples: [] };
  state = { ...state, docs: [...state.docs, { id, ...d }] }; // shows straight away
  emit();
  await setDoc(doc(db, 'users', state.userId, 'receiptGroups', id), d);
  return id;
}

// Fix a group's name or emoji
export async function updateReceiptGroup(id, label, emoji) {
  if (!state.userId || !label.trim()) return;
  const fields = { label: label.trim().slice(0, 40), emoji: (emoji || '').trim() || '🏷️' };
  state = { ...state, docs: state.docs.map(d => (d.id === id ? { ...d, ...fields } : d)) };
  emit();
  await setDoc(doc(db, 'users', state.userId, 'receiptGroups', id), fields, { merge: true });
}

// Remove a group (and what was learned for it); its items count as Other
export async function deleteReceiptGroup(id) {
  if (!state.userId) return;
  state = { ...state, docs: state.docs.filter(d => d.id !== id) };
  emit();
  await deleteDoc(doc(db, 'users', state.userId, 'receiptGroups', id));
}

// After saving a receipt: items you put in a different group than the reader did
// (or added yourself) become examples for that group. rows: [{ name, group, orig? }]
export function learnReceiptGroups(rows) {
  if (!state.userId) return;
  const byGroup = {};
  rows.forEach(r => {
    const name = String(r.name || '').trim();
    if (!name || !r.group || r.group === r.orig || r.group === 'other') return;
    (byGroup[r.group] = byGroup[r.group] || []).push(name);
  });
  Object.entries(byGroup).forEach(([id, names]) => {
    const cur = state.docs.find(d => d.id === id)?.examples || [];
    const lower = new Set(names.map(n => n.toLowerCase()));
    const examples = [...cur.filter(n => !lower.has(n.toLowerCase())), ...names].slice(-MAX_EXAMPLES);
    setDoc(doc(db, 'users', state.userId, 'receiptGroups', id), { examples }, { merge: true }).catch(() => {});
  });
}

// What the scanner is told: custom groups and learned examples
export const scannerHints = () => state.docs
  .filter(d => (d.custom && d.label) || d.examples?.length)
  .map(d => ({ id: d.id, ...(d.custom ? { label: d.label, emoji: d.emoji } : {}), examples: (d.examples || []).slice(-MAX_EXAMPLES) }));
