import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { genId } from '../utils/id';
import { priceDate, easternDate } from '../utils/marketCalendar';
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

  const updateTx = useCallback((id, fields) => updateDoc(ref('invTransactions', id), fields), [ref]);

  const setAsset = useCallback((symbol, fields) =>
    setDoc(ref('invAssets', symbol), symbol === CASH_ID ? fields : { symbol, ...fields }, { merge: true }), [ref]);

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
  const deleteHolding = useCallback(async (symbol) => {
    const batch = writeBatch(db);
    txs.filter(t => t.symbol === symbol).forEach(t => batch.delete(ref('invTransactions', t.id)));
    alerts.filter(a => a.symbol === symbol).forEach(a => batch.delete(ref('invAlerts', a.id)));
    if (!assets[symbol]?.watch) batch.delete(ref('invAssets', symbol));
    await batch.commit();
  }, [txs, alerts, assets, ref]);

  return {
    txs, assets, assetDocs, snapshots, alerts, portfolio, cashTarget,
    addTx, deleteTx, updateTx, setAsset, removeAsset, refreshPrices, ensureAsset, stockInfo, priceHistory, searchSymbols,
    addAlert, toggleAlert, deleteAlert, deleteHolding,
  };
}
