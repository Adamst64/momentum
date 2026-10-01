import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { genId } from '../utils/id';
import { toDateStr } from '../utils/dateUtils';
import { computePortfolio, CASH_ID, BENCHMARK } from '../utils/investing';

// users/{uid}/invTransactions — every deposit, withdrawal, buy, sell, dividend
// users/{uid}/invAssets/{SYMBOL} — { symbol, name, source: 'finnhub'|'manual', price, prevClose,
//                                   priceUpdatedAt, targetPct, watch }; doc 'cash' holds the cash target %
// users/{uid}/invSnapshots/{date} — { date, value, cash, netDeposits } for the value chart and returns
// users/{uid}/invAlerts/{id} — { symbol, direction: 'above'|'below', target, enabled, triggeredAt }
export function useInvesting(userId) {
  const [txs, setTxs]             = useState([]);
  const [assetDocs, setAssetDocs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [alerts, setAlerts]       = useState([]);

  useEffect(() => {
    if (!userId) { setTxs([]); setAssetDocs([]); setSnapshots([]); setAlerts([]); return; }
    const col = name => collection(db, 'users', userId, name);
    const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unsubs = [
      onSnapshot(col('invTransactions'), s => setTxs(rows(s))),
      onSnapshot(col('invAssets'),       s => setAssetDocs(rows(s))),
      onSnapshot(col('invSnapshots'),    s => setSnapshots(rows(s))),
      onSnapshot(col('invAlerts'),       s => setAlerts(rows(s))),
    ];
    return () => unsubs.forEach(u => u());
  }, [userId]);

  const assets = useMemo(
    () => Object.fromEntries(assetDocs.filter(a => a.id !== CASH_ID).map(a => [a.id, a])),
    [assetDocs]);
  const cashTarget = assetDocs.find(a => a.id === CASH_ID)?.targetPct ?? null;
  const portfolio  = useMemo(() => computePortfolio(txs, assets), [txs, assets]);

  const ref = useCallback((name, id) => doc(db, 'users', userId, name, id), [userId]);

  const addTx = useCallback(async (tx) => {
    const id = genId();
    await setDoc(ref('invTransactions', id), { ...tx, createdAt: new Date().toISOString() });
  }, [ref]);

  const deleteTx = useCallback(id => deleteDoc(ref('invTransactions', id)), [ref]);

  const setAsset = useCallback((symbol, fields) =>
    setDoc(ref('invAssets', symbol), symbol === CASH_ID ? fields : { symbol, ...fields }, { merge: true }), [ref]);

  const removeAsset = useCallback(symbol => deleteDoc(ref('invAssets', symbol)), [ref]);

  // Saves today's portfolio value so the chart and period returns have data
  const saveSnapshot = useCallback(async (prices = {}) => {
    const merged = { ...assets };
    for (const [sym, q] of Object.entries(prices)) merged[sym] = { ...merged[sym], ...q };
    const p = computePortfolio(txs, merged);
    const date = toDateStr(new Date());
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

  // Key stats, past earnings, profile and recent news for one symbol
  const stockInfo = useCallback(async (symbol) => {
    const fn = httpsCallable(getFunctions(getApp()), 'stockInfo');
    return (await fn({ symbol })).data;
  }, []);

  const addAlert = useCallback((symbol, direction, target) =>
    setDoc(ref('invAlerts', genId()), { symbol, direction, target, enabled: true, createdAt: new Date().toISOString() }), [ref]);

  const toggleAlert = useCallback((id, enabled) =>
    updateDoc(ref('invAlerts', id), { enabled, ...(enabled ? { triggeredAt: null, triggeredPrice: null } : {}) }), [ref]);

  const deleteAlert = useCallback(id => deleteDoc(ref('invAlerts', id)), [ref]);

  return {
    txs, assets, assetDocs, snapshots, alerts, portfolio, cashTarget,
    addTx, deleteTx, setAsset, removeAsset, refreshPrices, ensureAsset, stockInfo,
    addAlert, toggleAlert, deleteAlert,
  };
}
