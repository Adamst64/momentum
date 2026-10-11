import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { genId } from '../utils/id';
import { accountBalances, mergeCategories } from '../utils/budget';

// users/{uid}/budgetAccounts/{id}   — { name, type: 'cash'|'debit'|'credit'|'savings', order }
// users/{uid}/budgetCategories/{id} — edits to a built-in category, or a custom one (see mergeCategories)
// users/{uid}/budgetTxs/{id}      — { type: 'expense'|'income'|'transfer', amount (cents), date: 'YYYY-MM-DD',
//                                    accountId, toAccountId (transfers), category, note, createdAt }
export function useBudget(userId) {
  const [accountDocs, setAccountDocs] = useState([]);
  const [txDocs, setTxDocs]           = useState([]);
  const [categoryDocs, setCategoryDocs] = useState([]);

  useEffect(() => {
    if (!userId) { setAccountDocs([]); setTxDocs([]); setCategoryDocs([]); return; }
    const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unsubs = [
      onSnapshot(collection(db, 'users', userId, 'budgetAccounts'), s => setAccountDocs(rows(s))),
      onSnapshot(collection(db, 'users', userId, 'budgetTxs'),      s => setTxDocs(rows(s))),
      onSnapshot(collection(db, 'users', userId, 'budgetCategories'), s => setCategoryDocs(rows(s))),
    ];
    return () => unsubs.forEach(u => u());
  }, [userId]);

  const ref = useCallback((name, id) => doc(db, 'users', userId, name, id), [userId]);

  const accounts = useMemo(
    () => [...accountDocs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [accountDocs]);
  // Newest first; same-day entries by creation time
  const txs = useMemo(
    () => [...txDocs].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')),
    [txDocs]);
  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const categories = useMemo(() => mergeCategories(categoryDocs), [categoryDocs]);

  const addAccount = useCallback(async ({ name, type }) => {
    const order = accounts.reduce((m, a) => Math.max(m, a.order ?? 0), -1) + 1;
    await setDoc(ref('budgetAccounts', genId()), { name: name.trim(), type, order });
  }, [ref, accounts]);

  const updateAccount = useCallback(async (id, { name, type }) => {
    await updateDoc(ref('budgetAccounts', id), { name: name.trim(), type });
  }, [ref]);

  // Returns the new category's id, so a form can select it right away
  const addCategory = useCallback(async ({ kind, label, emoji, color }) => {
    const id = genId();
    await setDoc(ref('budgetCategories', id), { kind, label: label.trim(), emoji, color, createdAt: new Date().toISOString() });
    return id;
  }, [ref]);

  // Merge, so editing a built-in only stores what changed
  const updateCategory = useCallback(async (id, { label, emoji, color }) => {
    await setDoc(ref('budgetCategories', id), { label: label.trim(), emoji, color, hidden: false }, { merge: true });
  }, [ref]);

  // Built-ins can only be hidden. A custom one in use is hidden too, so its
  // transactions keep their name and emoji; an unused one is deleted outright.
  const removeCategory = useCallback(async (id) => {
    const cat = categories.find(c => c.id === id);
    if (cat?.builtIn || txDocs.some(t => t.category === id)) {
      await setDoc(ref('budgetCategories', id), { hidden: true }, { merge: true });
    } else {
      await deleteDoc(ref('budgetCategories', id));
    }
  }, [ref, categories, txDocs]);

  // Removes the account and every transaction that touches it
  const deleteAccount = useCallback(async (id) => {
    const batch = writeBatch(db);
    txDocs.filter(t => t.accountId === id || t.toAccountId === id)
      .forEach(t => batch.delete(ref('budgetTxs', t.id)));
    batch.delete(ref('budgetAccounts', id));
    await batch.commit();
  }, [ref, txDocs]);

  const clean = t => ({
    type: t.type, amount: t.amount, date: t.date, accountId: t.accountId,
    toAccountId: t.type === 'transfer' ? t.toAccountId : null,
    category: t.type === 'transfer' ? null : t.category,
    note: (t.note || '').trim(),
  });

  const addTx = useCallback(async (t) => {
    await setDoc(ref('budgetTxs', genId()), { ...clean(t), createdAt: new Date().toISOString() });
  }, [ref]);

  const updateTx = useCallback(async (id, t) => {
    await updateDoc(ref('budgetTxs', id), clean(t));
  }, [ref]);

  const deleteTx = useCallback(async (id) => {
    await deleteDoc(ref('budgetTxs', id));
  }, [ref]);

  return {
    accounts, txs, balances, categories,
    addAccount, updateAccount, deleteAccount, addTx, updateTx, deleteTx,
    addCategory, updateCategory, removeCategory,
  };
}
