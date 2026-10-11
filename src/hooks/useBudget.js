import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { genId } from '../utils/id';
import { accountBalances } from '../utils/budget';

// users/{uid}/budgetAccounts/{id} — { name, type: 'cash'|'debit'|'credit'|'savings', startBalance (cents), order }
// users/{uid}/budgetTxs/{id}      — { type: 'expense'|'income'|'transfer', amount (cents), date: 'YYYY-MM-DD',
//                                    accountId, toAccountId (transfers), category, note, createdAt }
export function useBudget(userId) {
  const [accountDocs, setAccountDocs] = useState([]);
  const [txDocs, setTxDocs]           = useState([]);

  useEffect(() => {
    if (!userId) { setAccountDocs([]); setTxDocs([]); return; }
    const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unsubs = [
      onSnapshot(collection(db, 'users', userId, 'budgetAccounts'), s => setAccountDocs(rows(s))),
      onSnapshot(collection(db, 'users', userId, 'budgetTxs'),      s => setTxDocs(rows(s))),
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

  const addAccount = useCallback(async ({ name, type, startBalance }) => {
    const order = accounts.reduce((m, a) => Math.max(m, a.order ?? 0), -1) + 1;
    await setDoc(ref('budgetAccounts', genId()), { name: name.trim(), type, startBalance, order });
  }, [ref, accounts]);

  const updateAccount = useCallback(async (id, { name, type, startBalance }) => {
    await updateDoc(ref('budgetAccounts', id), { name: name.trim(), type, startBalance });
  }, [ref]);

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

  return { accounts, txs, balances, addAccount, updateAccount, deleteAccount, addTx, updateTx, deleteTx };
}
