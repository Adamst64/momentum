import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { genId } from '../utils/id';
import { priceDate, easternDate } from '../utils/marketCalendar';
import { toDateStr } from '../utils/dateUtils';
import { computePortfolio, CASH_ID, BENCHMARK } from '../utils/investing';

// users/{uid}/invTransactions — every deposit, withdrawal, buy, sell, dividend
// users/{uid}/invAssets/{SYMBOL} — { symbol, name, source: 'finnhub'|'manual', price, prevClose,
//                                   priceUpdatedAt, targetPct, watch } (an old 'cash' doc, if any, is ignored)
// users/{uid}/invSnapshots/{date} — { date, value, cash, netDeposits } for the value chart and returns
// users/{uid}/invAlerts/{id} — { symbol, direction: 'above'|'below', target, enabled, triggeredAt }
// users/{uid}/invAccounts/{id} — { name, order } brokerage accounts; transactions point here via account
// users/{uid}/invWatchLists/{id} — { name, order } named watchlists; a stock's asset doc lists them in
//   lists: [id] with listAdded.{id}: date and listAddedPrice.{id}: price when added
// Chart marks live on the asset doc: marks: [{ id, date, label }]
export function useInvesting(userId) {
  const [txs, setTxs]             = useState([]);
  const [assetDocs, setAssetDocs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [alerts, setAlerts]       = useState([]);
  const [accountDocs, setAccountDocs] = useState([]);
  const [listDocs, setListDocs] = useState([]);

  useEffect(() => {
    if (!userId) { setTxs([]); setAssetDocs([]); setSnapshots([]); setAlerts([]); setAccountDocs([]); setListDocs([]); return; }
    const col = name => collection(db, 'users', userId, name);
    const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unsubs = [
      onSnapshot(col('invTransactions'), s => setTxs(rows(s))),
      onSnapshot(col('invAssets'),       s => setAssetDocs(rows(s))),
      onSnapshot(col('invSnapshots'),    s => setSnapshots(rows(s))),
      onSnapshot(col('invAlerts'),       s => setAlerts(rows(s))),
      onSnapshot(col('invAccounts'),     s => setAccountDocs(rows(s))),
      onSnapshot(col('invWatchLists'),   s => setListDocs(rows(s))),
    ];
    return () => unsubs.forEach(u => u());
  }, [userId]);

  const assets = useMemo(
    () => Object.fromEntries(assetDocs.filter(a => a.id !== CASH_ID).map(a => [a.id, a])),
    [assetDocs]);
  const portfolio  = useMemo(() => computePortfolio(txs, assets), [txs, assets]);
  const watchLists = useMemo(
    () => [...listDocs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [listDocs]);
  const accounts   = useMemo(
    () => [...accountDocs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [accountDocs]);

  const ref = useCallback((name, id) => doc(db, 'users', userId, name, id), [userId]);

  const addTx = useCallback(async (tx) => {
    const id = genId();
    await setDoc(ref('invTransactions', id), { ...tx, createdAt: new Date().toISOString() });
  }, [ref]);

  // Several transactions saved together (a buy paid from a fund = its fund sale + the buy)
  const addTxs = useCallback(async (list) => {
    const batch = writeBatch(db);
    // createdAt a millisecond apart keeps their order (fund sale before the buy it pays for)
    const t0 = Date.now();
    list.forEach((tx, i) => batch.set(ref('invTransactions', genId()), { ...tx, createdAt: new Date(t0 + i).toISOString() }));
    await batch.commit();
  }, [ref]);

  // Editing: the old rows (both halves of a linked pair) are swapped for the new
  // ones in one batch, keeping the original createdAt so same-day order holds
  const replaceTxs = useCallback(async (oldIds, list) => {
    const old = txs.filter(t => oldIds.includes(t.id));
    const t0 = Math.min(...old.map(t => Date.parse(t.createdAt) || Date.now()), Date.now());
    const batch = writeBatch(db);
    old.forEach(t => batch.delete(ref('invTransactions', t.id)));
    const linkId = list.length > 1 ? genId() : null;
    list.forEach((tx, i) => batch.set(ref('invTransactions', genId()), {
      ...tx, ...(linkId ? { linkId } : {}), createdAt: new Date(t0 + i).toISOString(),
    }));
    await batch.commit();
  }, [txs, ref]);

  // Deleting one half of a linked pair deletes both
  const deleteTx = useCallback(async (id) => {
    const tx = txs.find(t => t.id === id);
    const linked = tx?.linkId ? txs.filter(t => t.linkId === tx.linkId) : [tx].filter(Boolean);
    if (linked.length <= 1) return deleteDoc(ref('invTransactions', id));
    const batch = writeBatch(db);
    linked.forEach(t => batch.delete(ref('invTransactions', t.id)));
    await batch.commit();
  }, [txs, ref]);

  // Moving a transaction to another account moves its linked partner too
  const setTxAccount = useCallback(async (id, account) => {
    const tx = txs.find(t => t.id === id);
    const list = tx?.linkId ? txs.filter(t => t.linkId === tx.linkId) : [tx].filter(Boolean);
    const batch = writeBatch(db);
    list.forEach(t => batch.update(ref('invTransactions', t.id), { account: account || null }));
    await batch.commit();
  }, [txs, ref]);

  // Many transactions to one account at once (linked partners follow)
  const assignTxs = useCallback(async (ids, account) => {
    const picked = txs.filter(t => ids.includes(t.id));
    const links = new Set(picked.map(t => t.linkId).filter(Boolean));
    const all = txs.filter(t => ids.includes(t.id) || (t.linkId && links.has(t.linkId)));
    for (let i = 0; i < all.length; i += 450) { // batches top out at 500 writes
      const batch = writeBatch(db);
      all.slice(i, i + 450).forEach(t => batch.update(ref('invTransactions', t.id), { account: account || null }));
      await batch.commit();
    }
  }, [txs, ref]);

  // ── Watch lists ──
  const addWatchList = useCallback(async (name) => {
    const id = genId();
    await setDoc(ref('invWatchLists', id), { name: name.trim(), order: listDocs.length, createdAt: new Date().toISOString() });
    return id;
  }, [ref, listDocs.length]);

  const renameWatchList = useCallback((id, name) => updateDoc(ref('invWatchLists', id), { name: name.trim() }), [ref]);

  // The stocks stay watched; they just aren't in that list anymore
  const deleteWatchList = useCallback(async (id) => {
    const batch = writeBatch(db);
    assetDocs.filter(a => (a.lists || []).includes(id)).forEach(a => batch.update(ref('invAssets', a.id), {
      lists: arrayRemove(id), [`listAdded.${id}`]: deleteField(), [`listAddedPrice.${id}`]: deleteField(),
    }));
    batch.delete(ref('invWatchLists', id));
    await batch.commit();
  }, [assetDocs, ref]);

  // listId null = watched without a list. Remembers the day and price it was added.
  const addToList = useCallback((symbol, listId, price) => setDoc(ref('invAssets', symbol), {
    symbol, watch: true,
    ...(listId ? {
      lists: arrayUnion(listId),
      listAdded: { [listId]: toDateStr(new Date()) },
      ...(price ? { listAddedPrice: { [listId]: price } } : {}),
    } : {}),
  }, { merge: true }), [ref]);

  // Out of one list; out of the watchlist entirely when it's in no list anymore
  const removeFromList = useCallback((symbol, listId) => {
    const a = assets[symbol] || {};
    const left = (a.lists || []).filter(x => x !== listId);
    return updateDoc(ref('invAssets', symbol), {
      ...(listId ? { lists: arrayRemove(listId), [`listAdded.${listId}`]: deleteField(), [`listAddedPrice.${listId}`]: deleteField() } : {}),
      ...(left.length === 0 ? { watch: false } : {}),
    });
  }, [assets, ref]);

  // ── Your own marks on a stock's chart ──
  // A mark is { id, date, label, note? } — note can be as long as you like
  const addMark = useCallback((symbol, date, label, note) =>
    setDoc(ref('invAssets', symbol), {
      symbol, marks: arrayUnion({ id: genId(), date, label: label.trim(), ...(note?.trim() ? { note: note.trim() } : {}) }),
    }, { merge: true }), [ref]);
  const updateMark = useCallback((symbol, id, fields) => {
    const marks = (assets[symbol]?.marks || []).map(m => (m.id === id ? {
      ...m, ...fields, label: (fields.label ?? m.label).trim(), note: (fields.note ?? m.note ?? '').trim(),
    } : m));
    return setDoc(ref('invAssets', symbol), { marks }, { merge: true });
  }, [assets, ref]);
  const deleteMark = useCallback((symbol, mark) => updateDoc(ref('invAssets', symbol), { marks: arrayRemove(mark) }), [ref]);

  const addAccount = useCallback(async (name) => {
    const id = genId();
    await setDoc(ref('invAccounts', id), { name: name.trim(), order: accountDocs.length, createdAt: new Date().toISOString() });
    return id;
  }, [ref, accountDocs.length]);

  const renameAccount = useCallback((id, name) => updateDoc(ref('invAccounts', id), { name: name.trim() }), [ref]);

  // Its transactions stay, moved to "No account"
  const deleteAccount = useCallback(async (id) => {
    const batch = writeBatch(db);
    txs.filter(t => t.account === id).forEach(t => batch.update(ref('invTransactions', t.id), { account: null }));
    batch.delete(ref('invAccounts', id));
    await batch.commit();
  }, [txs, ref]);

  const updateTx = useCallback((id, fields) => updateDoc(ref('invTransactions', id), fields), [ref]);

  const setAsset = useCallback((symbol, fields) =>
    setDoc(ref('invAssets', symbol), { symbol, ...fields }, { merge: true }), [ref]);

  const removeAsset = useCallback(symbol => deleteDoc(ref('invAssets', symbol)), [ref]);

  // Saves today's portfolio value so the chart and period returns have data.
  // Only once the market has opened on a market day: weekends, holidays and
  // mornings would just repeat the last close as a flat point on the chart.
  const saveSnapshot = useCallback(async (prices = {}) => {
    const date = priceDate();
    if (date !== easternDate().date) return;
    const merged = { ...assets };
    for (const [sym, q] of Object.entries(prices)) merged[sym] = { ...merged[sym], ...q };
    const p = computePortfolio(txs, merged);
    await setDoc(ref('invSnapshots', date), {
      date, value: p.value, cash: p.cash, netDeposits: p.netDeposits,
      spy: merged[BENCHMARK]?.price ?? null,
      updatedAt: new Date().toISOString(),
    });
  }, [txs, assets, ref]);

  // Live prices via the refreshPrices Cloud Function (it writes them to invAssets).
  // Pass symbols to look up specific tickers; omit to refresh everything auto-priced.
  const refreshPrices = useCallback(async (symbols) => {
    const fn = httpsCallable(getFunctions(getApp()), 'refreshPrices');
    const res = await fn(symbols ? { symbols } : {});
    if (!symbols && txs.length) await saveSnapshot(res.data.prices || {});
    return res.data;
  }, [txs.length, saveSnapshot]);

  // New ticker: try the price service; anything it doesn't know gets a manual price
  const ensureAsset = useCallback(async (symbol, fallbackPrice) => {
    if (assets[symbol]) return assets[symbol].source;
    try {
      const res = await refreshPrices([symbol]);
      if (res.prices?.[symbol]) return 'finnhub';
    } catch { /* price service unavailable — fall through to manual */ }
    await setAsset(symbol, { source: 'manual', price: fallbackPrice ?? null, priceUpdatedAt: new Date().toISOString() });
    return 'manual';
  }, [assets, refreshPrices, setAsset]);

  // Key stats, past earnings and profile for one symbol
  const stockInfo = useCallback(async (symbol) => {
    const fn = httpsCallable(getFunctions(getApp()), 'stockInfo');
    return (await fn({ symbol })).data;
  }, []);

  // Daily closes for a stock's chart, cached per symbol and range for 15 minutes
  const historyCache = useRef({});
  const priceHistory = useCallback(async (symbol, range) => {
    const key = `${symbol}:${range}`;
    const hit = historyCache.current[key];
    if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.points;
    const fn = httpsCallable(getFunctions(getApp()), 'priceHistory');
    const points = (await fn({ symbol, range })).data.points || [];
    historyCache.current[key] = { at: Date.now(), points };
    return points;
  }, []);

  // Ticker suggestions: { results: [{ symbol, name }], exact: is `query` itself a real ticker }
  const searchSymbols = useCallback(async (query) => {
    const fn = httpsCallable(getFunctions(getApp()), 'searchSymbols');
    const { results = [], exact = false } = (await fn({ query })).data || {};
    return { results, exact };
  }, []);

  const addAlert = useCallback((symbol, direction, target) =>
    setDoc(ref('invAlerts', genId()), { symbol, direction, target, enabled: true, createdAt: new Date().toISOString() }), [ref]);

  const toggleAlert = useCallback((id, enabled) =>
    updateDoc(ref('invAlerts', id), { enabled, ...(enabled ? { triggeredAt: null, triggeredPrice: null } : {}) }), [ref]);

  const deleteAlert = useCallback(id => deleteDoc(ref('invAlerts', id)), [ref]);

  // Removes a holding entirely: all its transactions and alerts, and its asset
  // doc unless it's on the watchlist. One batch, so it never half-deletes.
  // account given ('' = no account): only that account's transactions go, and the
  // stock's alerts/asset doc stay while other accounts still have it.
  const deleteHolding = useCallback(async (symbol, account) => {
    const batch = writeBatch(db);
    const inScope = t => t.symbol === symbol && (account === undefined || (t.account || '') === account);
    // …plus the other half of any linked pair (the fund sale that paid for a buy)
    const mine = txs.filter(inScope);
    const links = new Set(mine.map(t => t.linkId).filter(Boolean));
    txs.filter(t => inScope(t) || (t.linkId && links.has(t.linkId))).forEach(t => batch.delete(ref('invTransactions', t.id)));
    const remaining = txs.some(t => t.symbol === symbol && !inScope(t));
    if (!remaining) {
      alerts.filter(a => a.symbol === symbol).forEach(a => batch.delete(ref('invAlerts', a.id)));
      if (!assets[symbol]?.watch) batch.delete(ref('invAssets', symbol));
    }
    await batch.commit();
  }, [txs, alerts, assets, ref]);

  return {
    txs, assets, assetDocs, snapshots, alerts, portfolio, accounts, watchLists,
    addWatchList, renameWatchList, deleteWatchList, addToList, removeFromList, addMark, updateMark, deleteMark,
    addTx, addTxs, replaceTxs, deleteTx, updateTx, setTxAccount, assignTxs, addAccount, renameAccount, deleteAccount, setAsset, removeAsset, refreshPrices, ensureAsset, stockInfo, priceHistory, searchSymbols,
    addAlert, toggleAlert, deleteAlert, deleteHolding,
  };
}
