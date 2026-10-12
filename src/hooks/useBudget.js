import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';

// Also told when data that came from the local cache is confirmed by the server,
// so "loaded" (used before anything is synced or cleaned up) can wait for that
const META = { includeMetadataChanges: true };
import { genId } from '../utils/id';
import { todayStr } from '../utils/dateUtils';
import { accountBalances, mergeCategories, BALANCE_CATEGORY, recurringDates } from '../utils/budget';

// users/{uid}/budgetAccounts/{id}   — { name, type: 'cash'|'debit'|'credit'|'savings', order }
// users/{uid}/budgetCategories/{id} — edits to a built-in category, or a custom one (see mergeCategories)
// users/{uid}/budgetTxs/{id}      — { type: 'expense'|'income'|'transfer', amount (cents), date: 'YYYY-MM-DD',
//                                    accountId, toAccountId (transfers), category, note, createdAt,
//                                    items?: [{ name, amount (cents), group }] from a scanned receipt,
//                                    source?: 'recurring' | 'work' | 'investing' (made by the app, see below),
//                                    deleted?: true — an app-made entry you deleted, kept so it isn't re-made,
//                                    refunds?: [{ id, amount (cents), date }], originalAmount (cents) — on a refunded
//                                    expense: amount is what it costs after refunds (0 when fully refunded) }
// Accounts can also carry recurring: [{ id, label, amount (cents), months: 1|3, start, from?, category }]
// (repeating income, added on each due date) and workLink: { since } (Work tab pay lands here).
export function useBudget(userId) {
  const [accountDocs, setAccountDocs] = useState([]);
  const [txDocs, setTxDocs]           = useState([]);
  const [categoryDocs, setCategoryDocs] = useState([]);
  const [loaded, setLoaded] = useState({}); // which collections have arrived

  useEffect(() => {
    if (!userId) { setAccountDocs([]); setTxDocs([]); setCategoryDocs([]); setLoaded({}); return; }
    const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const mark = k => setLoaded(l => (l[k] ? l : { ...l, [k]: true }));
    const unsubs = [
      onSnapshot(collection(db, 'users', userId, 'budgetAccounts'), META, s => { setAccountDocs(rows(s)); if (!s.metadata.fromCache) mark('accounts'); }),
      onSnapshot(collection(db, 'users', userId, 'budgetTxs'), META, s => { setTxDocs(rows(s)); if (!s.metadata.fromCache) mark('txs'); }),
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
    () => txDocs.filter(t => !t.deleted).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')),
    [txDocs]);
  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const categories = useMemo(() => mergeCategories(categoryDocs), [categoryDocs]);

  // opening: cents already in the account, saved as an "Existing balance" entry (not income)
  const addAccount = useCallback(async ({ name, type, opening = 0 }) => {
    const order = accounts.reduce((m, a) => Math.max(m, a.order ?? 0), -1) + 1;
    const id = genId();
    const batch = writeBatch(db);
    batch.set(ref('budgetAccounts', id), { name: name.trim(), type, order });
    if (opening > 0 && type !== 'credit') {
      batch.set(ref('budgetTxs', genId()), {
        type: 'income', amount: opening, date: todayStr(), accountId: id, toAccountId: null,
        category: BALANCE_CATEGORY.id, note: '', createdAt: new Date().toISOString(),
      });
    }
    await batch.commit();
    return id;
  }, [ref, accounts]);

  const updateAccount = useCallback(async (id, { name, type }) => {
    await updateDoc(ref('budgetAccounts', id), { name: name.trim(), type });
  }, [ref]);

  // Repeating income on an account (rules replace the whole list)
  const setRecurring = useCallback(async (id, recurring) => {
    await updateDoc(ref('budgetAccounts', id), { recurring });
  }, [ref]);

  // Work tab pay lands in this account from now on; only one account at a time
  const linkWork = useCallback(async (id) => {
    const batch = writeBatch(db);
    accounts.filter(a => a.workLink && a.id !== id).forEach(a => batch.update(ref('budgetAccounts', a.id), { workLink: null }));
    if (id) batch.update(ref('budgetAccounts', id), { workLink: { since: new Date().toISOString() } });
    await batch.commit();
  }, [ref, accounts]);

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

  // moveTo: another category id — its entries (and repeating incomes) move there first,
  // then the category goes away for good (built-ins can only be hidden).
  // No moveTo: an unused custom category is deleted; a used one (or a built-in) is
  // hidden, so its entries keep their name and emoji.
  const removeCategory = useCallback(async (id, moveTo = null) => {
    const cat = categories.find(c => c.id === id);
    const used = txDocs.filter(t => t.category === id);
    // Firestore takes up to 500 writes per batch: move entries 400 at a time
    if (moveTo) {
      for (let i = 0; i < used.length; i += 400) {
        const b = writeBatch(db);
        used.slice(i, i + 400).forEach(t => b.update(ref('budgetTxs', t.id), { category: moveTo }));
        await b.commit();
      }
    }
    const batch = writeBatch(db);
    if (moveTo) {
      accountDocs.filter(a => (a.recurring || []).some(r => r.category === id)).forEach(a =>
        batch.update(ref('budgetAccounts', a.id), { recurring: a.recurring.map(r => (r.category === id ? { ...r, category: moveTo } : r)) }));
    }
    if (cat?.builtIn || (!moveTo && used.length)) batch.set(ref('budgetCategories', id), { hidden: true }, { merge: true });
    else batch.delete(ref('budgetCategories', id));
    await batch.commit();
  }, [ref, categories, txDocs, accountDocs]);

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
    ...(t.items ? { items: t.type === 'expense' ? t.items : [] } : {}),
    ...(t.originalAmount !== undefined ? { originalAmount: t.originalAmount } : {}),
  });

  const addTx = useCallback(async (t) => {
    await setDoc(ref('budgetTxs', genId()), { ...clean(t), createdAt: new Date().toISOString() });
  }, [ref]);

  const updateTx = useCallback(async (id, t) => {
    await updateDoc(ref('budgetTxs', id), clean(t));
  }, [ref]);

  // Money back for (part of) a purchase: the purchase keeps its original price and
  // its amount drops by the refund, so spending, stats and the balance all follow
  const addRefund = useCallback(async (txId, { amount, date }) => {
    const t = txDocs.find(x => x.id === txId);
    if (!t || t.type !== 'expense') throw new Error('That purchase is gone.');
    if (!(amount > 0) || amount > t.amount) throw new Error(`A refund can be at most ${(t.amount / 100).toFixed(2)}.`);
    const refunds = [...(t.refunds || []), { id: genId(), amount, date }];
    await updateDoc(ref('budgetTxs', txId), {
      refunds, originalAmount: t.originalAmount ?? t.amount, amount: t.amount - amount,
    });
  }, [ref, txDocs]);

  const removeRefund = useCallback(async (txId, refundId) => {
    const t = txDocs.find(x => x.id === txId);
    const r = t?.refunds?.find(x => x.id === refundId);
    if (!r) return;
    await updateDoc(ref('budgetTxs', txId), { refunds: t.refunds.filter(x => x.id !== refundId), amount: t.amount + r.amount });
  }, [ref, txDocs]);

  // App-made entries (paychecks, Work pay) are kept as a hidden marker so they aren't made again
  const deleteTx = useCallback(async (id) => {
    const t = txDocs.find(x => x.id === id);
    if (t?.source === 'recurring' || t?.source === 'work') await updateDoc(ref('budgetTxs', id), { deleted: true });
    else await deleteDoc(ref('budgetTxs', id));
  }, [ref, txDocs]);

  // Entries other parts of the app keep in sync (Work pay, investing transfers), by fixed id
  const putSynced = useCallback(async (id, data) => {
    await setDoc(ref('budgetTxs', id), data, { merge: true });
  }, [ref]);
  const removeSynced = useCallback(async (id) => {
    await deleteDoc(ref('budgetTxs', id));
  }, [ref]);

  // Repeating income: add each due date that hasn't been added yet (fixed ids, so two
  // devices doing this at once write the same entry)
  const ready = loaded.accounts && loaded.txs;
  useEffect(() => {
    if (!ready) return;
    const have = new Set(txDocs.map(t => t.id));
    const today = todayStr();
    const batch = writeBatch(db);
    let n = 0;
    for (const a of accountDocs) {
      for (const r of a.recurring || []) {
        if (!(r.amount > 0)) continue;
        for (const ds of recurringDates(r, today)) {
          const id = `rec-${r.id}-${ds}`;
          // from: set when a rule is edited, so changing it doesn't re-add past months
          if (have.has(id) || (r.from && ds < r.from) || n >= 400) continue;
          batch.set(ref('budgetTxs', id), {
            type: 'income', amount: r.amount, date: ds, accountId: a.id, toAccountId: null,
            category: r.category || 'salary', note: r.label || '', source: 'recurring', recurringId: r.id,
            createdAt: new Date().toISOString(),
          }, { merge: true }); // never wipes an edit or a deleted marker made elsewhere
          n++;
        }
      }
    }
    if (n) batch.commit().catch(() => {});
  }, [ready, accountDocs, txDocs, ref]);

  // Photo of a receipt (base64, no data: prefix) → { store, date, total, tax, items: [{ name, price, group }] } in dollars
  const scanReceipt = useCallback(async (image, mediaType) => {
    const fn = httpsCallable(getFunctions(getApp()), 'scanReceipt', { timeout: 180000 });
    return (await fn({ image, mediaType })).data;
  }, []);

  return {
    scanReceipt, loaded: ready, txDocs, setRecurring, linkWork, putSynced, removeSynced,
    accounts, txs, balances, categories,
    addAccount, updateAccount, deleteAccount, addTx, updateTx, deleteTx,
    addCategory, updateCategory, removeCategory, addRefund, removeRefund,
  };
}
