import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Modal from '../Modal';
import { useBackHandler } from '../../hooks/useBackHandler';
import { T } from '../../theme';
import { toDateStr, formatShortDate, formatDateYear, addDays } from '../../utils/dateUtils';
import { isMarketDay, priceDate, marketStatus } from '../../utils/marketCalendar';
import { movedToday, dayContext, money, signedMoney, pct, qtyFmt, soldPositions, accountGroups, txEditInit, isLegacyCash, buildValueHistory, sortTx, periodReturn, monthlyFlows, benchmarkReturn, sectorBreakdown, PERIODS, BENCHMARK, extendedPrice } from '../../utils/investing';
import TabBar, { SubBar, ICONS, scrollToTop, jumpTo } from '../TabBar';
import { Card, SectionTitle, Chips, inputStyle, gainColor, noSelect, ConfirmDialog } from './ui';
import { ValueChart, AllocationDonut, AllocationLegend, allocationSlices, MonthlyFlows, Performers } from './Charts';
import TxModal from './TxModal';
import TransferSheet from '../TransferSheet';
import { stockEvents, EventBell, colorOf } from './PositionCalendar';
import SymbolInput from './SymbolInput';
import HoldingModal, { TxList } from './HoldingModal';
import { ANALYST_COLOR } from './StockInfo';

const HIDE_KEY = 'momentum_hide_amounts';
const readHide = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const writeHide = v => { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ } };

// The switcher at the bottom of the screen (like Robinhood's)
const VIEWS = [
  { value: 'overview',  label: 'Overview',  icon: ICONS.chart },
  { value: 'portfolio', label: 'Portfolio', icon: ICONS.list },
  { value: 'watchlist', label: 'Watchlist', icon: ICONS.star },
  { value: 'insights',  label: 'Insights',  icon: ICONS.bulb },
  { value: 'calendar',  label: 'Events',    icon: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0' },
];

const ADD_ACTIONS = [
  { type: 'buy',      label: 'Buy',           hint: 'Record a purchase, or add shares you already own' },
  { type: 'sell',     label: 'Sell',          hint: 'Record a sale' },
  { type: 'deposit',  label: 'Add money',     hint: 'Money in, straight into a fund like FDRXX or VMFXX' },
  { type: 'withdraw', label: 'Withdraw',      hint: 'Money out of a fund and the account' },
  { type: 'dividend', label: 'Dividend',      hint: 'Paid by a stock or fund — into a fund, or reinvested' },
];

const STALE_OPEN_MS = 15 * 60 * 1000;      // during pre-market, the session and after hours
const STALE_CLOSED_MS = 12 * 60 * 60 * 1000; // overnight and weekends
const PULL_TRIGGER = 70;

// "3 min ago" style label for the last price update
const ago = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Short earnings badge: weekday within the week, otherwise the date
const earningsBadge = (date, today) => {
  const d = new Date(date + 'T12:00:00');
  const days = Math.round((d - new Date(today + 'T12:00:00')) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'tmrw';
  return d.toLocaleDateString('en-US', days < 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' });
};

export default function InvestingTab({ hook, userId, budget }) {
  const { txs, portfolio, assets, snapshots, accounts, refreshPrices, deleteTx, setTxAccount, setAsset } = hook;
  const [view, setViewState] = useState('overview');
  // Each view opens at its top, not where the last one was scrolled to
  const setView = v => {
    setViewState(v); setOpenAccountId(null); setOpenListId(null);
    scrollToTop();
  };
  const [period, setPeriod]   = useState('ALL');
  const [hide, setHide]       = useState(readHide);
  const [trade, setTrade]     = useState(null);  // { type, symbol }
  const [adding, setAdding]   = useState(false);
  const [open, setOpen]       = useState(null);  // symbol, or { symbol, account } from an account's row
  const openSym = typeof open === 'object' && open ? open.symbol : open;
  const [byAccountPref, setByAccountPrefState] = useState(() => { try { return localStorage.getItem('momentum_by_account') !== '0'; } catch { return true; } });
  const setByAccountPref = v => { setByAccountPrefState(v); try { localStorage.setItem('momentum_by_account', v ? '1' : '0'); } catch { /* storage unavailable */ } };
  const [manageAccounts, setManageAccounts] = useState(false);
  const [editing, setEditing] = useState(null); // transaction being edited from All transactions
  const [transfer, setTransfer] = useState(false);
  const [showAllTx, setShowAllTx] = useState(false); // Insights → All transactions, folded by default
  // Hero: investments only, or net worth (investments + Budget cash)
  const hasCash = (budget?.accounts?.length || 0) > 0;
  const [heroMode, setHeroModeState] = useState(() => { try { return localStorage.getItem('momentum_hero') || 'inv'; } catch { return 'inv'; } });
  const setHeroMode = v => { setHeroModeState(v); setScrub(null); setSpan(null); try { localStorage.setItem('momentum_hero', v); } catch { /* storage unavailable */ } };
  // Tapping an account opens its own page (null = the Portfolio list). Leaving
  // the tab or switching views always comes back to the list.
  const [openAccountId, setOpenAccountId] = useState(null);
  useBackHandler(openAccountId !== null, () => setOpenAccountId(null));
  useEffect(() => { if (openAccountId !== null) window.scrollTo(0, 0); }, [openAccountId]);
  // Same for a watch list opened from the Watchlist
  const [openListId, setOpenListId] = useState(null);
  useBackHandler(openListId !== null, () => setOpenListId(null));
  useEffect(() => { if (openListId !== null) window.scrollTo(0, 0); }, [openListId]);
  const [targetFor, setTargetFor] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateErr, setUpdateErr] = useState(null);
  const [scrub, setScrub]     = useState(null);  // chart point under the finger
  const [span, setSpan]       = useState(null);  // two-finger { from, to } on the chart
  const [status, setStatus]   = useState(() => marketStatus());
  const [pull, setPull]       = useState(0);
  const pullStart = useRef(null);
  const autoTried = useRef(false);

  const toggleHide = () => { setHide(h => { writeHide(!h); return !h; }); };

  // Market status pill ticks once a minute
  useEffect(() => {
    const id = setInterval(() => setStatus(marketStatus()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const today = toDateStr(new Date());
  // Value history rebuilt from your transactions: daily closes for everything
  // you've traded (plus SPY for the comparison), from the first transaction on
  const tradedSymbols = useMemo(() => [...new Set(txs.filter(t => t.symbol).map(t => t.symbol))].sort().join(','), [txs]);
  const firstDate = useMemo(() => sortTx(txs)[0]?.date || null, [txs]);
  const [histories, setHistories] = useState(null);
  useEffect(() => {
    if (!firstDate || !hook.priceHistory) return undefined;
    let live = true;
    const age = (Date.now() - new Date(firstDate + 'T12:00:00')) / 864e5;
    const range = age <= 350 ? '1y' : age <= 715 ? 'd2y' : 'd5y';
    const syms = [...tradedSymbols.split(',').filter(Boolean), BENCHMARK];
    Promise.all(syms.map(s => hook.priceHistory(s, range).then(pts => [s, pts]).catch(() => [s, null])))
      .then(pairs => { if (live) setHistories(Object.fromEntries(pairs.filter(([, pts]) => pts && pts.length))); });
    return () => { live = false; };
  }, [tradedSymbols, firstDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useMemo(() => {
    if (!histories || !firstDate) return null;
    const end = priceDate(); // today's point is the live value, added below
    const days = [];
    for (let d = firstDate; d < end; d = addDays(d, 1)) if (isMarketDay(d)) days.push(d);
    return buildValueHistory(txs, histories, assets, days);
  }, [histories, txs, assets, firstDate]);
  // Until prices load, fall back to the values saved each day
  const series = history || snapshots;

  const ret = useMemo(() => periodReturn(txs, series, portfolio.value, period, today), [txs, series, portfolio.value, period, today]);

  // Budget cash on any date: running total of every budget entry up to that day
  // (credit cards count as negative, so this is cash minus what's owed)
  const worth = heroMode === 'worth' && hasCash;
  // Returns: total return (value minus money put in) at each day's close
  const returnsMode = heroMode === 'ret';
  const cashSteps = useMemo(() => cashTimeline(budget?.accounts || [], budget?.txs || []), [budget?.accounts, budget?.txs]);
  const cashNow = useMemo(() => (budget?.accounts || []).reduce((t, a) => t + (budget.balances[a.id] || 0), 0) / 100, [budget?.accounts, budget?.balances]);
  const cashAt = useCallback(d => {
    let lo = 0, hi = cashSteps.length - 1, v = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (cashSteps[m].date <= d) { v = cashSteps[m].total; lo = m + 1; } else hi = m - 1; }
    return v / 100;
  }, [cashSteps]);

  // 1D / 1W: the portfolio through the day, rebuilt from intraday prices of what's
  // held now (5-minute steps for 1D, 15-minute for 1W; regular session only, since
  // "Now" is valued at the official prices). Funds without intraday
  // prices count at their current price. Daily history is shown until these load.
  const intraRange = period === '1D' ? 'i1d' : period === '1W' ? 'i5d' : null;
  const heldKey = portfolio.holdings.filter(h => h.qty > 0).map(h => `${h.symbol}:${h.qty}`).join(',');
  const [intra, setIntra] = useState(null); // { key, points }
  useEffect(() => {
    if (!intraRange || !heldKey || !hook.priceHistory) return undefined;
    let live = true;
    const key = `${intraRange}|${heldKey}`;
    const held = heldKey.split(',').map(x => { const [symbol, q] = x.split(':'); return { symbol, qty: Number(q) }; });
    Promise.all(held.map(h => hook.priceHistory(h.symbol, intraRange).then(pts => [h.symbol, pts.filter(p => !p.ext && !p.prev)]).catch(() => [h.symbol, []])))
      .then(pairs => {
        if (!live) return;
        const series = Object.fromEntries(pairs);
        const times = [...new Set(pairs.flatMap(([, pts]) => pts.map(p => p.t)).filter(Boolean))].sort((a, b) => a - b);
        const labelAt = {};
        pairs.forEach(([, pts]) => pts.forEach(p => { if (p.t) labelAt[p.t] = { label: p.label, date: p.date }; }));
        const cursor = {};
        const points = times.map(t => {
          let v = portfolio.cash || 0;
          for (const h of held) {
            const pts = series[h.symbol] || [];
            let i = cursor[h.symbol] ?? -1;
            while (i + 1 < pts.length && pts[i + 1].t <= t) i++;
            cursor[h.symbol] = i;
            const price = i >= 0 ? pts[i].value : pts[0]?.value ?? assets[h.symbol]?.price ?? 0;
            v += h.qty * price;
          }
          return { date: labelAt[t].date, label: labelAt[t].label, value: v };
        });
        setIntra({ key, points });
      });
    return () => { live = false; };
  }, [intraRange, heldKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chart: the value history in the selected period, plus "now". Only market
  // days, so weekends and holidays don't show up as flat stretches. "Now" stands
  // in for the session current prices belong to (the last one when closed).
  const chartPoints = useMemo(() => {
    const p = PERIODS.find(x => x.key === period);
    const start = p.start ? p.start(today) : '0000';
    const nowDate = priceDate();
    const pts = series
      .filter(s => s.date > start && s.date < nowDate && isMarketDay(s.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    let out = txs.length ? [...pts, { date: nowDate, value: portfolio.value, netDeposits: portfolio.netDeposits, label: 'Now' }] : [];
    const intraPts = intraRange && intra?.key === `${intraRange}|${heldKey}` && intra.points.length > 1 ? intra.points : null;
    if (txs.length && intraPts) {
      // Money in or out during the day isn't in these points, so none is subtracted
      const nd = portfolio.netDeposits;
      out = [
        ...(intraRange === 'i1d' ? [{ date: intraPts[0].date, label: 'Previous close', value: portfolio.value - portfolio.dayChange, netDeposits: nd }] : []),
        ...intraPts.map(p => ({ ...p, netDeposits: nd })),
        { date: nowDate, value: portfolio.value, netDeposits: nd, label: 'Now' },
      ];
    }
    if (returnsMode) {
      // Past days use that day's closing prices (fund NAVs included); the last point is now
      return out.filter(p => typeof p.netDeposits === 'number')
        .map(p => ({ ...p, value: p.value - p.netDeposits, invested: p.value }));
    }
    if (!worth) return out;
    // Net worth: each day's investments plus Budget cash that day (no deposits to
    // exclude: money moving between bank and investing stays inside net worth)
    return out.map((p, i) => {
      // Cash as it was that day (today: right now); spending shows up straight away
      const cash = i === out.length - 1 || p.date >= today ? cashNow : cashAt(p.date);
      return { date: p.date, label: p.label, value: p.value + cash, invested: p.value, cash };
    });
  }, [series, period, today, portfolio.value, portfolio.netDeposits, portfolio.dayChange, txs.length, worth, returnsMode, cashAt, cashNow, intra, intraRange, heldKey]);

  const lastUpdate = Object.values(assets).map(a => a.priceUpdatedAt).filter(Boolean).sort().pop();
  const hasAuto = Object.values(assets).some(a => a.source === 'finnhub');

  const update = useCallback(async () => {
    setUpdating(true);
    setUpdateErr(null);
    try { await refreshPrices(); }
    catch (e) { setUpdateErr(e.message || 'Could not update prices'); }
    finally { setUpdating(false); }
  }, [refreshPrices]);

  // Refresh on open (and when the app comes back to the front) when prices are
  // stale: 15 minutes while anything trades, 12 hours while the market is closed.
  // A fund still showing yesterday's price on a trading day keeps the 15 minutes
  // into the evening, so its NAV (out around 6–8 PM ET) shows up without a pull.
  const held = portfolio.holdings;
  const waitingNav = held.some(h => assets[h.symbol]?.priceProvider === 'yahoo' && !movedToday(assets[h.symbol])) && isMarketDay(today);
  const freshness = useRef({});
  freshness.current = { hasAuto, lastUpdate, session: status.session, waitingNav, update, updating };
  useEffect(() => {
    const check = () => {
      const f = freshness.current;
      if (!f.hasAuto || f.updating || document.visibilityState !== 'visible') return;
      const age = f.lastUpdate ? Date.now() - new Date(f.lastUpdate) : Infinity;
      const limit = f.session === 'closed' && !f.waitingNav ? STALE_CLOSED_MS : STALE_OPEN_MS;
      if (age > limit) f.update();
    };
    if (!autoTried.current && hasAuto) { autoTried.current = true; check(); }
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [hasAuto]);

  // Pull down from the top of the page to refresh
  // Works from anywhere at the top, the chart included: a gesture that turns
  // out sideways (chart scrubbing) or uses two fingers is dropped.
  const onTouchStart = e => {
    const busy = updating || adding || trade || open || targetFor || e.touches.length > 1;
    pullStart.current = window.scrollY <= 0 && !busy ? { x: e.touches[0].clientX, y: e.touches[0].clientY, decided: false } : null;
  };
  const onTouchMove = e => {
    const s = pullStart.current;
    if (s === null) return;
    // The chart claimed this finger (scrubbing): it's not a pull
    if (e.touches.length > 1 || e.defaultPrevented) { pullStart.current = null; setPull(0); return; }
    const dx = e.touches[0].clientX - s.x, dy = e.touches[0].clientY - s.y;
    if (!s.decided && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      if (Math.abs(dx) > Math.abs(dy)) { pullStart.current = null; setPull(0); return; }
      s.decided = true;
    }
    setPull(dy > 0 ? Math.min(dy * 0.5, PULL_TRIGGER + 20) : 0);
  };
  const onTouchEnd = () => {
    if (pull >= PULL_TRIGGER) update();
    pullStart.current = null;
    setPull(0);
  };

  const bench = ret && !ret.unavailable ? benchmarkReturn(series, ret.start, assets[BENCHMARK]?.price || histories?.[BENCHMARK]?.slice(-1)[0]?.value) : null;

  const slices = allocationSlices(portfolio, assets);
  const sliceColor = Object.fromEntries(slices.map(x => [x.key, x.color]));
  const slicePct = Object.fromEntries(slices.map(x => [x.key, x.pct]));
  const allocTotal = slices.reduce((t, x) => t + x.value, 0);
  // Most underweight holding (by target %), at least 2 pts and $1 short
  const nextBuy = slices
    .filter(x => x.key !== 'other' && x.target !== null && x.target !== undefined)
    .map(x => ({ symbol: x.key, target: x.target, under: x.target - x.pct * 100, amount: (x.target / 100) * allocTotal - x.value }))
    .filter(x => x.under >= 2 && x.amount >= 1)
    .sort((a, b) => b.under - a.under)[0] || null;
  // On the watchlist: watched, or in any list (owned stocks stay in their lists)
  const watch = Object.values(assets).filter(a => a.watch || (a.lists || []).length > 0);
  const sold = soldPositions(portfolio.closed, assets);
  // Holdings grouped by account (shown once you use accounts)
  const groups = useMemo(() => accountGroups(txs, assets, accounts), [txs, assets, accounts]);
  const groupMode = accounts.length > 0 || txs.some(t => t.account);
  const byAccount = groupMode && byAccountPref;
  const soonDate = toDateStr(new Date(Date.now() + 7 * 864e5));
  const laterDate = toDateStr(new Date(Date.now() + 21 * 864e5));
  const rowProps = { assets, today, soonDate, laterDate, hide, sliceColor, onOpen: setOpen };
  // How many accounts hold each symbol (for the "in 3 accounts" tag)
  const acctCount = {};
  groups.forEach(g => g.positions.forEach(p => { acctCount[p.symbol] = (acctCount[p.symbol] || 0) + 1; }));


  // Headline: the touched chart point, else the current value
  const headValue = span ? span.to.value : scrub ? scrub.value : worth ? portfolio.value + cashNow : returnsMode ? portfolio.totalGain : portfolio.value;
  // Touching a point: that day's return (vs the day before's last value, or for
  // 1D vs yesterday's close), not counting money added or withdrawn that day
  const scrubDay = (() => {
    if (!scrub) return null;
    const i = chartPoints.indexOf(scrub);
    if (i <= 0) return null;
    let base = null;
    if (intraRange === 'i1d') base = chartPoints[0];
    else for (let j = i - 1; j >= 0; j--) if (chartPoints[j].date < scrub.date) { base = chartPoints[j]; break; }
    if (!base) return null;
    const flows = typeof scrub.netDeposits === 'number' && typeof base.netDeposits === 'number' ? scrub.netDeposits - base.netDeposits : 0;
    const gain = scrub.value - base.value - flows;
    const denom = base.value + Math.max(0, flows);
    return { gain, pct: denom > 0 ? gain / denom : null };
  })();
  const periodLabel = PERIODS.find(p => p.key === period)?.label;

  // Sheets and pop-ups, shared by the main view and an opened account's page
  const overlays = (
    <>
      <TabBar items={VIEWS} value={view} onChange={setView} />
      {adding && (
        <Modal title="Add" onClose={() => setAdding(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...ADD_ACTIONS, ...(hasCash ? [{ type: 'transfer', label: '⇄ Transfer', hint: 'Between your bank accounts and investing (or bank to bank)' }] : [])].map(a => (
              <button
                key={a.type}
                onClick={() => { setAdding(false); if (a.type === 'transfer') setTransfer(true); else setTrade({ type: a.type }); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '12px 14px', borderRadius: 12,
                  background: a.type === 'buy' ? '#2A3A1A' : T.bg, border: `1px solid ${a.type === 'buy' ? T.olive : T.cardBorder}`, textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{a.label}</span>
                <span style={{ fontSize: 12, color: T.muted }}>{a.hint}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {trade && <TxModal hook={hook} budget={budget} initialType={trade.type} initialSymbol={trade.symbol || ''} onClose={() => setTrade(null)} />}
      {transfer && <TransferSheet investing={hook} budget={budget} onClose={() => setTransfer(false)} />}
      {manageAccounts && <AccountsModal hook={hook} onClose={() => setManageAccounts(false)} />}
      {editing && <TxModal hook={hook} budget={budget} editing={editing} onClose={() => setEditing(null)} />}
      {open && (
        <HoldingModal
          key={openSym}
          hook={hook} budget={budget} symbol={openSym} account={typeof open === 'object' ? open.account : undefined} hide={hide} userId={userId}
          onTrade={(type, symbol, acct) => {
            // The account being viewed, or the only one holding it
            const where = [...new Set(groups.filter(g => g.positions.some(p => p.symbol === symbol)).map(g => g.id))];
            const account = acct !== undefined ? acct : where.length === 1 ? where[0] : undefined;
            setOpen(null);
            setTrade({ type, symbol, ...(account !== undefined ? { account } : {}) });
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {targetFor && (
        <TargetModal
          label={targetFor}
          initial={assets[targetFor]?.targetPct}
          onSave={v => setAsset(targetFor, { targetPct: v })}
          onClose={() => setTargetFor(null)}
        />
      )}
    </>
  );

  // An account opened from the Portfolio: its own page; swipe right (or ‹) to go back
  const pageGroup = openAccountId !== null ? groups.find(g => g.id === openAccountId) || null : null;
  if (openListId !== null && view === 'watchlist') {
    return (
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <WatchListPage hook={hook} listId={openListId} items={watch} hide={hide} onBack={() => setOpenListId(null)} onOpen={setOpen} />
        {overlays}
      </div>
    );
  }
  if (pageGroup) {
    return (
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AccountPage
          g={pageGroup} hide={hide} onBack={() => setOpenAccountId(null)} onAdd={() => setAdding(true)}
          coreFund={accounts.find(a => a.id === pageGroup.id)?.coreFund || null}
          onSetCore={sym => hook.setCoreFund(pageGroup.id, sym)}
          onAssign={() => setManageAccounts(true)}
          renderRow={(pos, i) => <HoldingRow key={pos.key} h={pos} first={i === 0} {...rowProps} inAccounts={acctCount[pos.symbol]} share={allocTotal > 0 && pos.value ? pos.value / allocTotal : 0} />}
          onOpenSold={sym => setOpen({ symbol: sym, account: pageGroup.id })}
        />
        {overlays}
      </div>
    );
  }

  return (
    <div
      style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    >
      {(pull > 0 || updating) && (
        <div style={{ height: updating ? 28 : pull * 0.5, overflow: 'hidden', textAlign: 'center', fontSize: 12, color: T.muted, transition: pull ? 'none' : 'height 0.2s' }}>
          {updating ? 'Updating prices…' : pull >= PULL_TRIGGER ? 'Release to update' : 'Pull to update'}
        </div>
      )}

      {/* Market status, hide amounts, add — on every view */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
          color: status.session === 'open' ? T.green : status.session === 'closed' ? T.muted : T.khaki,
          background: status.session === 'open' ? 'rgba(48,209,88,0.12)' : T.card,
        }}>
          {status.session === 'open' ? '● ' : ''}{status.label}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={toggleHide} aria-label={hide ? 'Show amounts' : 'Hide amounts'} style={{ padding: 4, flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke={T.olive} strokeWidth="1.8" />
            <circle cx="12" cy="12" r="3" stroke={T.olive} strokeWidth="1.8" />
            {hide && <path d="M4 4l16 16" stroke={T.olive} strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
        </button>
        <button
          onClick={() => setAdding(true)}
          aria-label="Add transaction"
          style={{ width: 32, height: 32, borderRadius: 16, background: T.olive, color: '#fff', fontSize: 22, lineHeight: '30px', flexShrink: 0 }}
        >+</button>
      </div>

      {/* Overview: value, period change, chart */}
      {view === 'overview' && <Card style={noSelect}>

        <div style={{ fontSize: 34, fontWeight: 800, color: returnsMode ? gainColor(headValue) : T.text, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>
          {returnsMode ? signedMoney(headValue, hide) : money(headValue, hide)}
        </div>
        {returnsMode && (() => {
          // Total return as of the touched day (or now), and that day's own move
          const p = scrub || null;
          const put = p ? p.netDeposits : portfolio.netDeposits;
          const i = p ? chartPoints.indexOf(p) : -1;
          const prev = i > 0 ? chartPoints.slice(0, i).reverse().find(x => x.date < p.date) : null;
          const day = p ? (prev ? p.value - prev.value : null) : portfolio.dayChange;
          return (
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              Total return{put > 0 ? ` (${pct(headValue / put)} on ${money(put, hide)} put in)` : ''}
              {' · '}{p ? (p.label || formatDateYear(p.date)) : 'now'}
              {day !== null && <span style={{ color: gainColor(day) }}> · {signedMoney(day, hide)} {p ? 'that day' : dayContext().word}</span>}
            </div>
          );
        })()}
        {worth && (() => {
          const p = span ? span.to : scrub;
          const inv = p ? p.invested : portfolio.value, cash = p ? p.cash : cashNow;
          return (
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              Investments <b style={{ color: T.text, fontWeight: 600 }}>{money(inv, hide)}</b> · Cash <b style={{ color: cash < 0 ? T.red : T.text, fontWeight: 600 }}>{money(cash, hide)}</b>
            </div>
          );
        })()}

        {returnsMode ? (span ? (
          <div style={{ fontSize: 13, marginTop: 2, color: T.muted }}>
            <span style={{ color: gainColor(span.to.value - span.from.value), fontWeight: 700 }}>{signedMoney(span.to.value - span.from.value, hide)}</span> earned
            {' · '}{formatDateYear(span.from.date)} → {span.to.label || formatDateYear(span.to.date)}
          </div>
        ) : null) : span && worth ? (
          <div style={{ fontSize: 13, marginTop: 2, color: T.muted }}>
            <span style={{ color: gainColor(span.to.value - span.from.value), fontWeight: 700 }}>{signedMoney(span.to.value - span.from.value, hide)}</span>
            {' · '}{formatDateYear(span.from.date)} → {span.to.label || formatDateYear(span.to.date)}
          </div>
        ) : scrub && worth ? (
          <div style={{ fontSize: 13, marginTop: 2, color: T.muted }}>{scrub.label || formatDateYear(scrub.date)}</div>
        ) : span ? (() => {
          // Gain between two dates, not counting money added or withdrawn in between
          const nd = typeof span.to.netDeposits === 'number' && typeof span.from.netDeposits === 'number';
          const flows = nd ? span.to.netDeposits - span.from.netDeposits : 0;
          const gain = span.to.value - span.from.value - flows;
          const base = span.from.value + Math.max(0, flows);
          return (
            <div style={{ fontSize: 13, marginTop: 2, color: T.muted }}>
              <span style={{ color: gainColor(gain), fontWeight: 700 }}>{signedMoney(gain, hide)}{base > 0 ? ` (${pct(gain / base)})` : ''}</span>
              {' · '}{formatDateYear(span.from.date)} → {span.to.label || formatDateYear(span.to.date)}
              {Math.abs(flows) > 0.005 && <div style={{ fontSize: 11 }}>Excludes {signedMoney(flows, hide)} you added or withdrew</div>}
            </div>
          );
        })() : scrub ? (
          <div style={{ fontSize: 13, marginTop: 2, color: T.muted }}>
            {scrub.label || formatDateYear(scrub.date)}
            {scrubDay && (
              <span style={{ color: gainColor(scrubDay.gain) }}> · {signedMoney(scrubDay.gain, hide)}{scrubDay.pct !== null ? ` (${pct(scrubDay.pct)})` : ''} {intraRange === 'i1d' ? 'today so far' : 'that day'}</span>
            )}
          </div>
        ) : (
          <>
            {!worth && ret && !ret.unavailable && (
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: gainColor(ret.gain) }}>
                {signedMoney(ret.gain, hide)} ({pct(ret.pct)}) <span style={{ color: T.muted, fontWeight: 400 }}>· {period === 'ALL' ? 'all time' : periodLabel}</span>
              </div>
            )}
            {txs.length > 0 && !worth && (
              <div style={{ fontSize: 12, marginTop: 2, color: gainColor(portfolio.dayChange) }}>
                {signedMoney(portfolio.dayChange, hide)} {dayContext().word}
                {portfolio.ext && (
                  <span style={{ color: gainColor(portfolio.ext.change) }}> · {signedMoney(portfolio.ext.change, hide)} {portfolio.ext.label.toLowerCase()}</span>
                )}
              </div>
            )}
          </>
        )}

        {txs.length > 0 && (
          <>
            <div style={{ marginTop: 12 }}>
              <ValueChart points={chartPoints} hide={hide} onScrub={setScrub} onRange={setSpan} />
            </div>
            <div style={{ marginTop: 10 }}>
              <Chips small options={PERIODS.map(p => ({ value: p.key, label: p.label }))} value={period} onChange={v => { setPeriod(v); setScrub(null); }} />
            </div>
          </>
        )}

        {/* One line under the chart: vs the S&P 500 (when there's history) and when prices updated */}
        {(hasAuto || (!worth && !returnsMode && bench !== null && ret?.pct != null)) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10, fontSize: 11, color: T.muted }}>
            {!worth && !returnsMode && bench !== null && ret?.pct != null && txs.length > 0 && (
              <span style={{ flex: 1, minWidth: 0 }}>
                S&P 500 <span style={{ color: gainColor(bench) }}>{pct(bench)}</span> · you're {ret.pct >= bench ? 'ahead' : 'behind'} {Math.abs((ret.pct - bench) * 100).toFixed(1)} pts
              </span>
            )}
            {hasAuto && (
              <button onClick={update} disabled={updating} style={{ marginLeft: 'auto', padding: 0, fontSize: 11, color: updateErr ? T.red : T.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {updating ? 'Updating prices…' : updateErr ? `${updateErr} · tap to retry` : lastUpdate ? `Updated ${ago(lastUpdate)} ↻` : 'Update prices ↻'}
              </button>
            )}
          </div>
        )}
      </Card>}

      {view === 'overview' && txs.length > 0 && (
        <SubBar
          items={[
            { value: 'inv', label: 'Investments' },
            { value: 'ret', label: 'Returns', icon: 'M4 17l6-6 4 4 6-8M15 7h5v5' },
            ...(hasCash ? [{ value: 'worth', label: 'Net worth' }] : []),
          ]}
          value={worth ? 'worth' : returnsMode ? 'ret' : 'inv'} onChange={setHeroMode}
        />
      )}

      {txs.length === 0 && (view === 'overview' || view === 'portfolio') && (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '24px 12px', lineHeight: 1.5 }}>
          Tap <b style={{ color: T.text }}>+</b> to get started. For what you already own, choose <b style={{ color: T.text }}>Buy</b> → <b style={{ color: T.text }}>Already owned</b> — that includes
          money market funds like FDRXX. New money goes in with <b style={{ color: T.text }}>Add money</b> (into a fund), and buys are paid from that fund. Past trades are fine — just pick their real date.
        </div>
      )}

      {view === 'portfolio' && txs.length > 0 && (
        <>
        <SubBar
          items={[
            ...(groupMode ? [{ value: 'account', label: 'By account' }, { value: 'all', label: 'All' }] : []),
            { value: 'manage', label: accounts.length ? 'Accounts' : '+ Set up accounts', onPress: () => setManageAccounts(true) },
          ]}
          value={byAccount ? 'account' : 'all'} onChange={v => setByAccountPref(v === 'account')}
        />
        {byAccount ? groups.map(g => (
          <AccountCard key={g.id || 'none'} g={g} hide={hide} onOpen={() => setOpenAccountId(g.id)} />
        )) : (
          <Card style={{ padding: '6px 16px' }}>
            {portfolio.holdings.length === 0 && <div style={{ fontSize: 13, color: T.muted, padding: '10px 0' }}>No holdings yet.</div>}
            {portfolio.holdings.map((h, i) => (
              <HoldingRow key={h.symbol} h={h} first={i === 0} {...rowProps} share={slicePct[h.symbol]} />
            ))}
          </Card>
        )}
        {!byAccount && sold.length > 0 && <SoldList items={sold} hide={hide} onOpen={setOpen} />}
        </>
      )}

      {view === 'portfolio' && budget?.accounts?.length > 0 && (
        <BudgetCashCard budget={budget} hide={hide} />
      )}

      {view === 'watchlist' && (
        <WatchHome hook={hook} items={watch} onOpenList={setOpenListId} />
      )}

      {view === 'calendar' && <EventsCalendar hook={hook} today={today} onOpen={setOpen} />}

      {view === 'insights' && txs.length > 0 && (
        <>
          <SubBar items={[
            { value: 'ins-alloc', label: 'Allocation' }, { value: 'ins-sectors', label: 'Sectors' },
            { value: 'ins-perf', label: 'Performers' }, { value: 'ins-monthly', label: 'Monthly' },
            { value: 'ins-totals', label: 'Totals' }, { value: 'ins-tx', label: 'Transactions' },
          ].map(x => ({ ...x, jump: true, onPress: () => { setShowAllTx(x.value === 'ins-tx'); setTimeout(() => jumpTo(x.value), 0); } }))} />
          <Card id="ins-alloc">
            <SectionTitle>Allocation</SectionTitle>
            {slices.length === 0 ? (
              <div style={{ fontSize: 13, color: T.muted }}>Nothing allocated yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><AllocationDonut slices={slices} /></div>
                <AllocationLegend slices={slices} onEditTarget={setTargetFor} />
              </div>
            )}
            {nextBuy ? (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: '#2A2616', border: '1px solid #5A5130' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Next buy idea</div>
                <div style={{ fontSize: 13, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>
                  {nextBuy.symbol} is {nextBuy.under.toFixed(1)} pts under its {nextBuy.target}% target — about {money(nextBuy.amount, hide)} more would get it there.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
                {slices.some(x => x.target !== null && x.target !== undefined)
                  ? 'Everything is close to its target.'
                  : 'Tap “set target” to choose your own target % and get buy suggestions.'}
              </div>
            )}
          </Card>

          <Card id="ins-sectors">
            <SectionTitle>Sectors</SectionTitle>
            {(() => {
              const sectors = sectorBreakdown(portfolio.holdings, assets);
              if (!sectors.length) return <div style={{ fontSize: 13, color: T.muted }}>No priced holdings yet.</div>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {sectors.map(s => (
                    <div key={s.sector}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: T.text }}>{s.sector}</span>
                        <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{(s.pct * 100).toFixed(1)}%{!hide && <span style={{ color: T.muted }}> · {money(s.value)}</span>}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: T.bg }}>
                        <div style={{ height: 6, borderRadius: 3, width: `${Math.max(2, s.pct * 100)}%`, background: '#3987e5' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: T.muted }}>Share of invested money. ETFs are grouped since the free data plan doesn't break them down.</div>
                </div>
              );
            })()}
          </Card>

          <Card id="ins-perf">
            <SectionTitle>Top & bottom performers</SectionTitle>
            <Performers holdings={portfolio.holdings} sold={sold} hide={hide} onOpen={setOpen} />
            <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Held: gain so far. Sold: the gain you locked in when you sold.</div>
          </Card>

          <Card id="ins-monthly">
            <SectionTitle>Monthly: deposited vs invested</SectionTitle>
            <MonthlyFlows months={monthlyFlows(txs.filter(t => t.note !== 'Cleared leftover cash'))} hide={hide} />
          </Card>

          <Card id="ins-totals">
            <SectionTitle>Totals</SectionTitle>
            <TotalRow label="Money added (net)" value={money(portfolio.netDeposits, hide)} />
            <TotalRow label="Realized gains (sells)" value={signedMoney(portfolio.realized, hide)} color={gainColor(portfolio.realized)} />
            <TotalRow label="Dividends received" value={money(portfolio.dividends, hide)} />
            <TotalRow label="Unrealized gains" value={signedMoney(portfolio.holdings.reduce((a, h) => a + (h.unrealized || 0), 0), hide)} />
          </Card>

          <Card id="ins-tx" style={showAllTx ? undefined : { padding: 0 }}>
            <button onClick={() => setShowAllTx(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: showAllTx ? '0 0 10px' : '14px 16px' }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>All transactions</span>
              <span style={{ fontSize: 13, color: T.muted }}>{txs.length}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{showAllTx ? '▴' : '▾'}</span>
            </button>
            {showAllTx && <TxList txs={txs} hide={hide} onDelete={deleteTx} onEdit={t => { const e = txEditInit(t, txs); if (e) setEditing(e); }} accounts={accounts} onSetAccount={setTxAccount} />}
          </Card>
        </>
      )}

      {overlays}
    </div>
  );
}

// One holding (or one account's position) in the Portfolio list
function HoldingRow({ h, first, share, inAccounts, assets, today, soonDate, laterDate, hide, sliceColor, onOpen }) {
  // The next date on this stock's calendar (yours or the earnings report) within 3 weeks
  const next = stockEvents(assets[h.symbol]).find(e => e.date >= today);
  const showEarn = next && next.date <= laterDate;
  return (
    <button
      onClick={() => onOpen(h.account !== null && h.account !== undefined ? { symbol: h.symbol, account: h.account } : h.symbol)}
      style={{ width: '100%', padding: '12px 0 10px', borderTop: first ? 'none' : `1px solid ${T.cardBorder}`, textAlign: 'left', display: 'block' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 7 }}>
            {h.symbol}
            {showEarn && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
                color: next.date <= soonDate ? T.khaki : T.muted, background: next.date <= soonDate ? '#2A2616' : T.bg,
              }}>
                {next.kind === 'earnings' ? 'Earnings' : next.label.length > 16 ? next.label.slice(0, 15) + '…' : next.label} {earningsBadge(next.date, today)}
              </span>
            )}
            {h.source === 'manual' && <span style={{ fontSize: 10, color: T.muted, fontWeight: 400 }}>manual</span>}
            {inAccounts > 1 && <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, background: T.bg, padding: '2px 6px', borderRadius: 8 }}>in {inAccounts} accounts</span>}
          </div>
          <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {qtyFmt(h.qty)} × avg {money(h.avgCost, hide)}
          </div>
          <TargetLine target={assets[h.symbol]?.priceTarget} analyst={assets[h.symbol]?.analyst?.targetMean} price={h.price} hide={hide} />
        </div>
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: 15, color: T.text, fontWeight: 600 }}>{money(h.value, hide)}</div>
          {/* Total gain, then the day's move: live (today / pre-market / after hours) in color, the last session's in grey */}
          <div style={{ fontSize: 12, color: gainColor(h.unrealized) }}>
            {signedMoney(h.unrealized, hide)}{h.unrealizedPct !== null ? ` (${pct(h.unrealizedPct)})` : ''}
          </div>
          {(() => {
            const dc = dayContext();
            // A fund whose new price isn't out yet has no move to show
            const day = h.dayPct !== null && h.prevClose && Math.abs(h.price - h.prevClose) > 1e-9 ? { change: h.qty * (h.price - h.prevClose), pct: h.dayPct } : null;
            const ext = h.ext ? { change: h.qty * h.ext.change, pct: h.ext.pct, label: h.ext.label.toLowerCase() } : null;
            const line = (m, label, color, size = 11) => (
              <div style={{ fontSize: size, color }}>{signedMoney(m.change, hide)} ({pct(m.pct)}) {label}</div>
            );
            if (dc.pre) return (
              <>
                {ext && line(ext, 'pre-market', gainColor(ext.pct))}
                {day && line(day, dc.word, T.muted)}
              </>
            );
            return (
              <>
                {day && line(day, dc.word, gainColor(day.pct))}
                {ext && line(ext, ext.label, gainColor(ext.pct))}
              </>
            );
          })()}
        </div>
      </div>
      {share > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.bg }}>
            <div style={{ height: 4, borderRadius: 2, width: `${Math.max(1.5, share * 100)}%`, background: sliceColor[h.symbol] || '#5A5A5E' }} />
          </div>
          <span style={{ fontSize: 10, color: T.muted, width: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(share * 100)}%</span>
        </div>
      )}
    </button>
  );
}

// Add, rename and delete accounts
function AccountsModal({ hook, onClose }) {
  const { accounts, txs, addAccount, renameAccount, deleteAccount, assignTxs } = hook;
  // Unassigned transactions grouped by stock (old cash rows are hidden; "Move all"
  // still moves them along so each account's math stays balanced)
  const loose = {};
  txs.filter(t => !t.account && !isLegacyCash(t)).forEach(t => { const k = t.symbol || 'Other'; (loose[k] = loose[k] || []).push(t.id); });
  const looseKeys = Object.keys(loose).sort((a, b) => (a === 'Other') - (b === 'Other') || a.localeCompare(b));
  const [moved, setMoved] = useState(null);
  const assign = (key, ids, acc) => run(async () => {
    await assignTxs(ids, acc);
    setMoved(`${key === '*' ? 'Everything' : key} → ${accounts.find(a => a.id === acc)?.name}`);
  });
  const [names, setNames] = useState(() => Object.fromEntries(accounts.map(a => [a.id, a.name])));
  const [newName, setNewName] = useState('');
  const [asking, setAsking] = useState(null); // account waiting for "are you sure?"
  const [err, setErr] = useState(null);
  const run = async fn => { setErr(null); try { await fn(); } catch (e) { setErr(e.message || 'Something went wrong'); } };
  const unassigned = txs.filter(t => !t.account && !isLegacyCash(t)).length;
  return (
    <Modal title="Accounts" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* New account first, so it's never below a long list */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newName} onChange={e => setNewName(e.target.value)} placeholder="New account, e.g. Vanguard 401k" style={{ ...inputStyle, flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) run(async () => { await addAccount(newName); setNewName(''); }); }}
          />
          <button
            onClick={() => newName.trim() && run(async () => { await addAccount(newName); setNewName(''); })}
            style={{ padding: '0 14px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}
          >Add</button>
        </div>
        {accounts.map(a => {
          const n = txs.filter(t => t.account === a.id && !isLegacyCash(t)).length;
          return (
            <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={names[a.id] ?? a.name}
                onChange={e => setNames(m => ({ ...m, [a.id]: e.target.value }))}
                onBlur={() => { const v = (names[a.id] || '').trim(); if (v && v !== a.name) run(() => renameAccount(a.id, v)); }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ fontSize: 11, color: T.muted, width: 44, textAlign: 'right' }}>{n} tx</span>
              <button onClick={() => setAsking(a)} style={{ fontSize: 16, color: T.subtle, width: 40 }} aria-label={`Delete ${a.name}`}>×</button>
            </div>
          );
        })}
        {err && <div style={{ fontSize: 13, color: T.red }}>{err}</div>}

        {unassigned > 0 && (
          <div style={{ marginTop: 6 }}>
            <SectionTitle>Not in an account yet</SectionTitle>
            {accounts.length === 0 ? (
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45 }}>Add an account above first, then pick where each of these belongs.</div>
            ) : (
              <>
                {looseKeys.map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1 }}>
                      {k}<span style={{ fontSize: 11, color: T.muted, fontWeight: 400 }}> · {loose[k].length} transaction{loose[k].length !== 1 ? 's' : ''}</span>
                    </span>
                    <AccountSelect accounts={accounts} onPick={acc => assign(k, loose[k], acc)} />
                  </div>
                ))}
                {looseKeys.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 0', borderTop: `1px solid ${T.cardBorder}`, marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: T.muted, flex: 1 }}>Move all {unassigned} to</span>
                    <AccountSelect accounts={accounts} onPick={acc => assign('*', txs.filter(t => !t.account).map(t => t.id), acc)} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {moved && <div style={{ fontSize: 13, color: T.green }}>Moved: {moved}</div>}

        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45 }}>
          Deleting an account keeps its transactions; they move to “No account”. You can also change a single transaction's
          account from the label under it (Insights → All transactions, or on the stock's screen).
        </div>
      </div>
      {asking && (
        <ConfirmDialog
          title={`Delete ${asking.name}?`}
          message={`The account is removed. Its ${txs.filter(t => t.account === asking.id && !isLegacyCash(t)).length} transaction(s) stay and move to “No account”, so your holdings don't change.`}
          onConfirm={() => deleteAccount(asking.id)}
          onClose={() => setAsking(null)}
        />
      )}
    </Modal>
  );
}

// "Choose…" dropdown that fires once per pick
function AccountSelect({ accounts, onPick }) {
  return (
    <select
      value=""
      onChange={e => { if (e.target.value) onPick(e.target.value); }}
      style={{ fontSize: 13, color: T.khaki, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '6px 8px', maxWidth: 170, colorScheme: 'dark' }}
    >
      <option value="">Choose account…</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  );
}

// "Target $400 +49% · Analysts $350 +31%" under a holding or watched stock
function TargetLine({ target, analyst, price, hide }) {
  if (!(target > 0) && !(analyst > 0)) return null;
  const part = (label, v, color) => {
    const gap = price > 0 ? v / price - 1 : null;
    const hit = gap !== null && Math.abs(gap) < 0.005;
    return (
      <span style={{ color }}>
        {label} {hide ? '••••' : `$${Math.round(v).toLocaleString('en-US')}`}
        {gap !== null && (hit ? ' reached' : ` ${gap > 0 ? '+' : ''}${(gap * 100).toFixed(0)}%`)}
      </span>
    );
  };
  return (
    <div style={{ fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {target > 0 && part('Target', target, '#5AC8FA')}
      {target > 0 && analyst > 0 && <span style={{ color: T.muted }}> · </span>}
      {analyst > 0 && part('Analysts', analyst, ANALYST_COLOR)}
    </div>
  );
}

function TotalRow({ label, value, color = T.text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function TargetModal({ label, initial, onSave, onClose }) {
  const [v, setV] = useState(initial != null ? String(initial) : '');
  const [err, setErr] = useState(null);
  const save = async (val) => {
    try { await onSave(val); onClose(); } catch (e) { setErr(e.message || 'Could not save'); }
  };
  return (
    <Modal title={`Target for ${label}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={v} onChange={e => setV(e.target.value)} inputMode="decimal" placeholder="% of portfolio, e.g. 25" style={inputStyle} />
        {err && <div style={{ fontSize: 13, color: T.red }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => save(null)} style={{ flex: 1, padding: 12, borderRadius: 12, background: T.subtle, color: T.text, fontSize: 14 }}>Clear</button>
          <button
            onClick={() => { const n = parseFloat(v); if (n >= 0 && n <= 100) save(n); else setErr('Enter a number from 0 to 100'); }}
            style={{ flex: 2, padding: 12, borderRadius: 12, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}
          >Save</button>
        </div>
      </div>
    </Modal>
  );
}

// Fully sold positions: what you made on them, and how the price moved after
function SoldList({ items, hide, onOpen }) {
  return (
    <Card>
      <SectionTitle>Sold</SectionTitle>
      {items.length === 0 && (
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
          Stocks you sell completely show up here, with your gain or loss and how the price moved after you sold.
        </div>
      )}
      <SoldRows items={items} hide={hide} onOpen={onOpen} />
      {items.length > 0 && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>
          Gain/loss is what you sold for minus what you paid (fees included). “Since sold” compares today's price with your sell price; prices refresh automatically, or pull down to update.
        </div>
      )}
    </Card>
  );
}

// One account in the Portfolio list: tap to open its page
function AccountCard({ g, hide, onOpen }) {
  const n = g.positions.length;
  return (
    <Card style={{ padding: '4px 16px' }}>
      <button onClick={onOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
          <span style={{ display: 'block', fontSize: 11, color: T.muted }}>
            {n} holding{n !== 1 ? 's' : ''}{g.sold.length ? ` · ${g.sold.length} sold` : ''}
          </span>
        </span>
        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: T.text }}>{money(g.value, hide)}</span>
          {(() => {
            // Before the open: only the pre-market move (yesterday's change isn't today's)
            const dc = dayContext();
            if (dc.pre) return g.ext && Math.abs(g.ext.change) > 0.005
              ? <span style={{ display: 'block', fontSize: 11, color: gainColor(g.ext.change) }}>{signedMoney(g.ext.change, hide)} pre-market</span>
              : null;
            return (
              <>
                {Math.abs(g.dayChange) > 0.005 && <span style={{ display: 'block', fontSize: 11, color: gainColor(g.dayChange) }}>{signedMoney(g.dayChange, hide)} {dc.word}</span>}
                {g.ext?.session === 'post' && Math.abs(g.ext.change) > 0.005 && <span style={{ display: 'block', fontSize: 11, color: gainColor(g.ext.change) }}>{signedMoney(g.ext.change, hide)} after hours</span>}
              </>
            );
          })()}
        </span>
        <span style={{ fontSize: 18, color: T.muted, marginLeft: 2 }}>›</span>
      </button>
    </Card>
  );
}

// "Realized (sold)   +$120.00  +13.3%" — % of the money it's measured against
function GainRow({ label, sub, value, pctOf, hide, strong }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: strong ? 15 : 13 }}>
      <span style={{ flex: 1, color: strong ? T.text : T.muted, fontWeight: strong ? 700 : 400 }}>
        {label}{sub && <span style={{ fontSize: 11 }}> · {sub}</span>}
      </span>
      <span style={{ color: gainColor(value), fontWeight: strong ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>{signedMoney(value, hide)}</span>
      <span style={{ width: 64, textAlign: 'right', color: gainColor(value), fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : 400 }}>
        {pctOf > 0 ? pct(value / pctOf) : ''}
      </span>
    </div>
  );
}

// An account's own page: its holdings and what was sold from it
function AccountPage({ g, hide, onBack, onAdd, onAssign, renderRow, onOpenSold, coreFund, onSetCore }) {
  const n = g.positions.length;
  const cost = g.positions.reduce((t, p) => t + (p.cost || 0), 0);
  const unrealized = g.positions.reduce((t, p) => t + (p.unrealized || 0), 0);
  const total = g.realized + unrealized + g.dividends;
  const prevValue = g.value - g.dayChange; // yesterday's close of what's held now
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }} />
        <button onClick={onAdd} aria-label="Add transaction" style={{ width: 32, height: 32, borderRadius: 16, background: T.olive, color: '#fff', fontSize: 22, lineHeight: '30px' }}>+</button>
      </div>

      <Card style={noSelect}>
        <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>{g.name}</div>
        <div style={{ marginTop: 4, fontSize: 30, fontWeight: 800, color: T.text, letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums' }}>{money(g.value, hide)}</div>
        <div style={{ fontSize: 13, color: gainColor(dayContext().pre ? (g.ext?.change ?? 0) : g.dayChange), marginTop: 2 }}>
          {(() => {
            const dc = dayContext();
            const last = `${signedMoney(g.dayChange, hide)}${prevValue > 0 ? ` (${pct(g.dayChange / prevValue)})` : ''} ${dc.word}`;
            if (!dc.pre) return last;
            return (
              <>
                {g.ext ? <>{signedMoney(g.ext.change, hide)}{g.ext.pct !== null ? ` (${pct(g.ext.pct)})` : ''} pre-market</> : 'No pre-market moves yet'}
                <span style={{ color: T.muted }}> · {last}</span>
              </>
            );
          })()}
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <GainRow label="Realized" sub="sold" value={g.realized} pctOf={g.soldBasis} hide={hide} />
          <GainRow label="Unrealized" sub="still held" value={unrealized} pctOf={cost} hide={hide} />
          {g.dividends > 0.005 && <GainRow label="Dividends" value={g.dividends} hide={hide} />}
          <div style={{ borderTop: `1px solid ${T.cardBorder}`, paddingTop: 6 }}>
            <GainRow label="Total gain" value={total} pctOf={cost + g.soldBasis} hide={hide} strong />
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
          {n} holding{n !== 1 ? 's' : ''}{g.sold.length ? ` · ${g.sold.length} sold` : ''} · total = realized + unrealized{g.dividends > 0.005 ? ' + dividends' : ''}
        </div>
      </Card>

      {g.id !== '' && <CoreFundRow g={g} coreFund={coreFund} onSetCore={onSetCore} hide={hide} />}

      {g.id === '' && (
        <button onClick={onAssign} style={{ fontSize: 13, color: T.khaki, textAlign: 'left' }}>Assign these to accounts →</button>
      )}

      <Card style={{ padding: '6px 16px' }}>
        {g.positions.map(renderRow)}
        {n === 0 && <div style={{ fontSize: 13, color: T.muted, padding: '10px 0' }}>Nothing held here right now.</div>}
      </Card>

      {g.sold.length > 0 && (
        <Card>
          <SectionTitle>Sold</SectionTitle>
          <SoldRows items={g.sold} hide={hide} onOpen={onOpenSold} />
        </Card>
      )}

      <div style={{ fontSize: 11, color: T.muted, textAlign: 'center' }}>Swipe right from the left edge to go back</div>
    </>
  );
}

// Fully sold positions: what you made, and how the price moved after
function SoldRows({ items, hide, onOpen }) {
  return (
    <>
      {items.map((s, i) => (
        <button
          key={s.symbol}
          onClick={() => onOpen(s.symbol)}
          style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderTop: i ? `1px solid ${T.cardBorder}` : 'none', textAlign: 'left' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s.symbol}</div>
            <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {qtyFmt(s.qty)} sold @ {money(s.avgSell, hide)} · {formatShortDate(s.date)}
            </div>
            <div style={{ fontSize: 12, color: gainColor(s.realized), marginTop: 2 }}>
              {s.realized >= 0 ? 'Gain' : 'Loss'} {signedMoney(s.realized, hide)} ({pct(s.realizedPct)})
              {s.dividends > 0 && <span style={{ color: T.muted }}> · +{money(s.dividends, hide)} dividends</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontSize: 14, color: T.text }}>{money(s.price, hide)}</div>
            <div style={{ fontSize: 12, color: gainColor(s.sinceSell) }}>{pct(s.sinceSell)} since sold</div>
            {s.ifHeld !== null && Math.abs(s.ifHeld) >= 0.01 && (
              <div style={{ fontSize: 11, color: T.muted }}>
                {s.ifHeld > 0 ? 'Missed' : 'Saved'} {money(Math.abs(s.ifHeld), hide)}
              </div>
            )}
          </div>
        </button>
      ))}
    </>
  );
}

const NO_LIST = '__none'; // stocks you watch that aren't in any list

const dayPct = a => (!movedToday(a) ? 0 : a.price && a.prevClose ? (a.price - a.prevClose) / a.prevClose : null);

// Watchlist home: your lists; tap one to open it
function WatchHome({ hook, items, onOpenList }) {
  const { watchLists, addWatchList } = hook;
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const [showNew, setShowNew] = useState(false); // the New list box (always shown before the first list)
  const loose = items.filter(a => !(a.lists || []).some(id => watchLists.some(l => l.id === id)));
  const cards = [
    ...watchLists.map(l => ({ id: l.id, name: l.name, items: items.filter(a => (a.lists || []).includes(l.id)) })),
    ...(loose.length ? [{ id: NO_LIST, name: 'Not in a list', items: loose }] : []),
  ];
  const create = async () => {
    if (!name.trim()) return;
    setErr(null);
    try { const id = await addWatchList(name); setName(''); setShowNew(false); onOpenList(id); }
    catch (e) { setErr(e.message || 'Could not create the list'); }
  };
  return (
    <>
      {cards.map(c => {
        const moves = c.items.map(dayPct).filter(x => x !== null);
        const avg = moves.length ? moves.reduce((t, x) => t + x, 0) / moves.length : null;
        return (
          <Card key={c.id} style={{ padding: '4px 16px' }}>
            <button onClick={() => onOpenList(c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', textAlign: 'left' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: c.id === NO_LIST ? T.muted : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.items.length} item{c.items.length !== 1 ? 's' : ''}{c.items.length ? ` · ${c.items.slice(0, 4).map(a => a.symbol).join(', ')}${c.items.length > 4 ? '…' : ''}` : ''}
                </span>
              </span>
              {avg !== null && <span style={{ fontSize: 12, color: gainColor(avg), fontVariantNumeric: 'tabular-nums' }}>{pct(avg)} avg today</span>}
              <span style={{ fontSize: 18, color: T.muted }}>›</span>
            </button>
          </Card>
        );
      })}
      {watchLists.length > 0 && <SubBar items={[{ value: 'new', label: showNew ? 'Cancel new list' : '+ New list', onPress: () => setShowNew(v => !v) }]} />}
      {(showNew || !watchLists.length) && <Card>
        <SectionTitle>{watchLists.length ? 'New list' : 'Make your first list'}</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder="e.g. My picks, YouTuber picks" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={create} style={{ padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}>Create</button>
        </div>
        {err && <div style={{ fontSize: 13, color: T.red, marginTop: 6 }}>{err}</div>}
        <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>A stock can be in several lists. Each list remembers when you added it and the price then.</div>
      </Card>}
    </>
  );
}

const LIST_SORTS = [
  { value: 'az', label: 'A–Z' },
  { value: 'today', label: 'Today' },
  { value: 'since', label: 'Since added' },
  { value: 'added', label: 'Newest' },
];

// One watch list's own page (swipe right / ‹ to go back)
function WatchListPage({ hook, listId, items, hide, onBack, onOpen }) {
  const { portfolio, watchLists, refreshPrices, addToList, removeFromList, renameWatchList, deleteWatchList } = hook;
  const list = watchLists.find(l => l.id === listId) || null;
  const isLoose = listId === NO_LIST;
  const rows = isLoose
    ? items.filter(a => !(a.lists || []).some(id => watchLists.some(l => l.id === id)))
    : items.filter(a => (a.lists || []).includes(listId));
  const [sort, setSort] = useState('az');
  const [sym, setSym] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [asking, setAsking] = useState(null);   // { title, message, label, action }
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(list?.name || '');

  const since = a => {
    const p0 = a.listAddedPrice?.[listId];
    return p0 && a.price ? a.price / p0 - 1 : null;
  };
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'today') return (dayPct(b) ?? -Infinity) - (dayPct(a) ?? -Infinity);
    if (sort === 'since') return (since(b) ?? -Infinity) - (since(a) ?? -Infinity);
    if (sort === 'added') return (b.listAdded?.[listId] || '').localeCompare(a.listAdded?.[listId] || '');
    return a.symbol.localeCompare(b.symbol);
  });

  // Stocks you came to own stay in the list, below the ones you're only watching
  const ownedSet = new Set(portfolio.holdings.map(h => h.symbol));
  const soldSet = new Set(portfolio.closed.map(h => h.symbol));
  const sections = [
    { key: 'watching', title: 'Watching', items: sorted.filter(a => !ownedSet.has(a.symbol) && !soldSet.has(a.symbol)) },
    { key: 'owned', title: 'Owned', items: sorted.filter(a => ownedSet.has(a.symbol)) },
    { key: 'sold', title: 'Owned & sold', items: sorted.filter(a => !ownedSet.has(a.symbol) && soldSet.has(a.symbol)) },
  ];
  const renderRow = (a, i, sec) => {
          const day = dayPct(a);
          const ext = extendedPrice(a);
          const s0 = since(a);
          const added = a.listAdded?.[listId];
          return (
            <div key={a.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: i || rows.length > 1 ? `1px solid ${T.cardBorder}` : 'none', marginTop: i === 0 && rows.length > 1 ? 10 : 0, opacity: sec === 'sold' ? 0.85 : 1 }}>
              <button onClick={() => onOpen(a.symbol)} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{a.symbol}</div>
                {a.name && <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>}
                {added && (
                  <div style={{ fontSize: 11, color: T.muted }}>
                    Added {formatDateYear(added)}{s0 !== null && <span style={{ color: gainColor(s0) }}> · {pct(s0)} since</span>}
                  </div>
                )}
                {sec === 'owned' && (() => {
                  const h = portfolio.holdings.find(x => x.symbol === a.symbol);
                  return h ? <div style={{ fontSize: 11, color: T.khaki }}>You own {qtyFmt(h.qty)} · {pct(h.unrealizedPct)}</div> : null;
                })()}
                {sec === 'sold' && (() => {
                  const c = portfolio.closed.find(x => x.symbol === a.symbol);
                  return c?.lastExit ? <div style={{ fontSize: 11, color: T.muted }}>Sold {formatDateYear(c.lastExit.date)} @ {money(c.lastExit.avgSell, hide)}</div> : null;
                })()}
                <TargetLine target={a.priceTarget} analyst={a.analyst?.targetMean} price={a.price} hide={hide} />
              </button>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ fontSize: 14, color: T.text }}>{money(a.price, hide)}</div>
                <div style={{ fontSize: 12, color: gainColor(day) }}>{pct(day)}</div>
                {ext && <div style={{ fontSize: 11, color: gainColor(ext.pct) }}>{ext.label} {pct(ext.pct)}</div>}
              </div>
              <button
                onClick={() => setAsking({
                  title: `Remove ${a.symbol} from ${isLoose ? 'your watchlist' : `“${title}”`}?`,
                  message: (a.lists || []).filter(x => x !== listId).length
                    ? 'It stays in your other lists.'
                    : 'It isn\'t in any other list, so it leaves your watchlist. Its chart marks and targets are kept.',
                  label: 'Remove',
                  action: () => removeFromList(a.symbol, isLoose ? null : listId),
                })}
                aria-label={`Remove ${a.symbol}`} style={{ fontSize: 16, color: T.subtle }}
              >×</button>
            </div>
          );
        
  };

  const add = async () => {
    const s = sym.trim().toUpperCase();
    if (!s || busy) return;
    if (rows.some(a => a.symbol === s)) { setMsg(`${s} is already in this list.`); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await refreshPrices([s]);
      if (res.notFound?.includes(s)) { setMsg(`Couldn't find a price for ${s}. Check the ticker.`); return; }
      await addToList(s, isLoose ? null : listId, res.prices?.[s]?.price || null);
      setSym('');
    } catch (e) {
      setMsg(e.message || 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  if (!list && !isLoose) return <div style={{ fontSize: 13, color: T.muted }}>This list was deleted. <button onClick={onBack} style={{ color: T.khaki }}>Back</button></div>;
  const title = isLoose ? 'Not in a list' : list.name;

  return (
    <>
      {!isLoose && (
        <SubBar items={[
          { value: 'rename', label: renaming ? 'Cancel rename' : 'Rename', onPress: () => { setNewName(list.name); setRenaming(r => !r); } },
          { value: 'delete', label: 'Delete list', icon: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', onPress: () => setAsking({
            title: `Delete “${list.name}”?`,
            message: `The list is removed. Its ${rows.length} stock${rows.length !== 1 ? 's stay' : ' stays'} on your watchlist${rows.length ? ' (under “Not in a list” unless in another list)' : ''}.`,
            action: async () => { await deleteWatchList(listId); onBack(); },
          }) },
        ]} />
      )}

      <Card>
        {renaming ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus style={{ ...inputStyle, flex: 1 }} />
            <button onClick={async () => { if (newName.trim()) { await renameWatchList(listId, newName); setRenaming(false); } }} style={{ padding: '0 14px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}>Save</button>
          </div>
        ) : (
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{title}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SymbolInput hook={hook} value={sym} onChange={setSym} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add a ticker or company, e.g. NVDA" />
          </div>
          <button onClick={add} disabled={busy} style={{ height: 44, padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}>{busy ? '…' : 'Add'}</button>
        </div>
        {msg && <div style={{ fontSize: 13, color: T.red, marginTop: 8 }}>{msg}</div>}
      </Card>

      <Card style={{ padding: '10px 16px' }}>
        {rows.length > 1 && <Chips small options={LIST_SORTS.filter(o => !isLoose || (o.value !== 'since' && o.value !== 'added'))} value={sort} onChange={setSort} />}
        {rows.length === 0 && <div style={{ fontSize: 13, color: T.muted, padding: '6px 0' }}>Nothing here yet — add a ticker above.</div>}
        {sections.map(sec => sec.items.length > 0 && (
          <div key={sec.key}>
            {sections.filter(x => x.items.length).length > 1 && (
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14 }}>
                {sec.title} · {sec.items.length}
              </div>
            )}
            {sec.items.map((a, i) => renderRow(a, i, sec.key))}
          </div>
        ))}
      </Card>
      <div style={{ fontSize: 11, color: T.muted, textAlign: 'center' }}>Swipe right from the left edge to go back</div>
      {asking && <ConfirmDialog title={asking.title} message={asking.message} confirmLabel={asking.label || 'Delete'} onConfirm={asking.action} onClose={() => setAsking(null)} />}
    </>
  );
}

// Cash: every Budget account, folded like the other accounts; tap to see each one.
// Credit cards show as what's owed.
function BudgetCashCard({ budget, hide }) {
  const { accounts, balances } = budget;
  const [open, setOpen] = useState(false);
  const cash = accounts.reduce((s, a) => s + (balances[a.id] || 0), 0) / 100;
  return (
    <Card style={{ padding: '12px 16px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left' }}>
        <span style={{ fontSize: 18 }} aria-hidden="true">💵</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: T.text }}>Cash</span>
          <span style={{ display: 'block', fontSize: 12, color: T.muted }}>{accounts.length} Budget account{accounts.length === 1 ? '' : 's'}</span>
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: cash < 0 ? T.red : T.text, fontVariantNumeric: 'tabular-nums' }}>{money(cash, hide)}</span>
        <span style={{ color: T.muted, fontSize: 12 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && accounts.map(a => {
        const b = (balances[a.id] || 0) / 100;
        const credit = a.type === 'credit';
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0 0', marginTop: 7, borderTop: `1px solid ${T.cardBorder}`, fontSize: 14 }}>
            <span style={{ flex: 1, minWidth: 0, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            <span style={{ fontSize: 11, color: T.muted }}>{credit ? (b < 0 ? 'owed' : 'credit card') : a.type === 'savings' ? 'savings' : a.type === 'cash' ? 'cash' : 'debit'}</span>
            <span style={{ minWidth: 86, textAlign: 'right', fontWeight: 600, color: b < 0 ? T.red : T.text }}>{b < 0 ? '−' : ''}{money(Math.abs(b), hide)}</span>
          </div>
        );
      })}
    </Card>
  );
}

// Running total of all Budget money by date: [{ date, total (cents) }], one step per day
function cashTimeline(accounts, txs) {
  const ids = new Set(accounts.map(a => a.id));
  const byDay = {};
  for (const t of txs) {
    let d = 0;
    if (t.type === 'expense' && ids.has(t.accountId)) d = -t.amount;
    else if (t.type === 'income' && ids.has(t.accountId)) d = t.amount;
    else if (t.type === 'transfer') d = (ids.has(t.toAccountId) ? t.amount : 0) - (ids.has(t.accountId) ? t.amount : 0);
    if (d) byDay[t.date] = (byDay[t.date] || 0) + d;
  }
  let total = 0;
  return Object.keys(byDay).sort().map(date => ({ date, total: (total += byDay[date]) }));
}

// The account's cash fund: where money from the bank lands and what buys are paid from
function CoreFundRow({ g, coreFund, onSetCore, hide }) {
  const [editing, setEditing] = useState(false);
  const [other, setOther] = useState('');
  const [err, setErr] = useState(null);
  const held = g.positions.find(p => p.symbol === coreFund);
  const choices = [...new Set(g.positions.map(p => p.symbol))];
  const pick = async sym => {
    setErr(null);
    try { await onSetCore(sym); setEditing(false); setOther(''); } catch (e) { setErr(e.message || 'Could not save'); }
  };
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }} aria-hidden="true">💵</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
            Cash fund{coreFund ? `: ${coreFund}` : ''}
            {held && <span style={{ fontWeight: 400, color: T.muted }}> · {money(held.value, hide)}</span>}
          </div>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
            {coreFund ? 'Money from the bank lands here; buys are paid from it.' : 'Pick the fund this account keeps its cash in, like FDRXX or VMFXX.'}
          </div>
        </div>
        <button onClick={() => setEditing(v => !v)} style={{ fontSize: 13, fontWeight: 600, color: T.khaki }}>{editing ? 'Done' : coreFund ? 'Change' : 'Choose'}</button>
      </div>
      {editing && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {choices.length > 0 && (
            <Chips small options={choices.map(sym => ({ value: sym, label: sym }))} value={coreFund} onChange={pick} />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={other} onChange={e => setOther(e.target.value.toUpperCase())} placeholder="Another fund, e.g. SPAXX" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => other.trim() && pick(other.trim())} style={{ padding: '0 14px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}>Set</button>
          </div>
          {coreFund && <button onClick={() => pick(null)} style={{ alignSelf: 'flex-start', fontSize: 12, color: T.muted }}>Clear cash fund</button>}
          {err && <div style={{ fontSize: 12, color: T.red }}>{err}</div>}
        </div>
      )}
    </Card>
  );
}

// Calendar tab: the events you asked to be reminded of, and everything coming
// up for what you hold or watch (plus Fed, CPI and jobs dates), each with a 🔔
function EventsCalendar({ hook, today, onOpen }) {
  const { assets, portfolio, eventAlerts = [], removeEventAlert, marketEvents } = hook;
  const [tab, setTab] = useState('reminders');
  const [market, setMarket] = useState([]);
  useEffect(() => {
    let live = true;
    marketEvents?.().then(ev => live && setMarket(ev)).catch(() => {});
    return () => { live = false; };
  }, [marketEvents]);

  const held = new Set(portfolio.holdings.filter(h => h.qty > 0).map(h => h.symbol));
  const followed = Object.values(assets).filter(a => held.has(a.symbol) || a.watch || (a.lists || []).length > 0);
  const horizon = addDays(today, 75);
  const allEvents = [
    ...followed.flatMap(a => stockEvents(a).map(e => ({ ...e, symbol: a.symbol }))),
    ...market.map((e, i) => ({ ...e, id: `mkt-${e.date}-${i}`, symbol: null })),
  ];
  const upcoming = [
    ...followed.flatMap(a => stockEvents(a).filter(e => e.date >= today && e.date <= horizon).map(e => ({ ...e, symbol: a.symbol }))),
    ...market.filter(e => e.date >= today && e.date <= horizon).map((e, i) => ({ ...e, id: `mkt-${e.date}-${i}`, symbol: null })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.symbol || '').localeCompare(b.symbol || ''));
  const reminders = eventAlerts.filter(a => !a.done && a.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  const dayTitle = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const byDay = list => list.reduce((g, e) => { (g[e.date] = g[e.date] || []).push(e); return g; }, {});
  const renderDays = (list, row) => Object.entries(byDay(list)).map(([date, items]) => (
    <div key={date}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.khaki, margin: '4px 0 6px' }}>{date === today ? 'Today' : dayTitle(date)}</div>
      <Card style={{ padding: '2px 14px' }}>{items.map((e, i) => row(e, i))}</Card>
    </div>
  ));
  const line = (e, right, i) => (
    <div key={e.id || `${e.symbol}-${e.date}-${e.label}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: e.symbol ? colorOf(e) : '#5AC8FA', flexShrink: 0 }} />
      <button onClick={() => e.symbol && onOpen(e.symbol)} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 14, color: T.text, fontWeight: 600 }}>
          {e.symbol ? <span style={{ color: T.khaki }}>{e.symbol} </span> : <span style={{ color: '#5AC8FA' }}>Market </span>}{e.label}
        </span>
        {(e.details || []).slice(0, 1).map(d => <span key={d} style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 1 }}>{d}</span>)}
        {(e.note || e.notifyOn) && (
          <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 1 }}>
            {[e.note, e.notifyOn ? `Reminders ${e.notifyOn === today ? 'today' : new Date(e.notifyOn + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })} 9 AM + ${e.date === today ? 'today' : 'that day'} 8 AM` : null].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>
      {right}
    </div>
  );

  return (
    <>
      <SubBar
        items={[
          { value: 'reminders', label: `Reminders${reminders.length ? ` (${reminders.length})` : ''}`, icon: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0' },
          { value: 'upcoming', label: 'Upcoming', icon: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
          { value: 'calendar', label: 'Calendar', icon: ICONS.calendar },
        ]}
        value={tab} onChange={v => { setTab(v); scrollToTop(); }}
      />
      {tab === 'reminders' && (
        reminders.length === 0 ? (
          <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, padding: '8px 2px' }}>
            No reminders yet. Tap 🔔 on any date in Upcoming (or in a stock's calendar or earnings) to be notified at 9 AM the business day before and at 8 AM on the day.
          </div>
        ) : renderDays(reminders, (a, i) => line(a, (
          <button onClick={() => removeEventAlert(a.id)} aria-label="Remove reminder" style={{ fontSize: 18, color: T.muted, padding: '0 6px' }}>×</button>
        ), i))
      )}
      {tab === 'calendar' && (
        <MonthEvents events={allEvents} today={today} renderDay={(date, items) => (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.khaki, margin: '4px 0 6px' }}>{date === today ? 'Today' : dayTitle(date)}</div>
            {items.length === 0
              ? <div style={{ fontSize: 13, color: T.muted }}>Nothing on this day.</div>
              : <Card style={{ padding: '2px 14px' }}>{items.map((e, i) => line(e, <EventBell hook={hook} event={e} symbol={e.symbol} />, i))}</Card>}
          </div>
        )} />
      )}
      {tab === 'upcoming' && (
        upcoming.length === 0 ? (
          <div style={{ fontSize: 14, color: T.muted, padding: '8px 2px' }}>Nothing in the next few weeks for what you hold or watch.</div>
        ) : <>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.4 }}>The next 10 weeks for what you hold or watch, plus Fed decisions, CPI and jobs reports. 🔔 = notify me 9 AM the business day before and 8 AM on the day.</div>
          {renderDays(upcoming, (e, i) => line(e, <EventBell hook={hook} event={e} symbol={e.symbol} />, i))}
        </>
      )}
    </>
  );
}

// A month grid of events: a colored dot per event (up to 3, then +n). Tap a day
// to list everything on it; swipe or ‹ › to change month.
function MonthEvents({ events, today, renderDay }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState(today);
  const swipe = useRef(null);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const byDay = {};
  events.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
  const shift = n => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };
  const dayItems = (byDay[picked] || []).slice().sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
  return (
    <>
      <Card style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <button onClick={() => shift(-1)} aria-label="Previous month" style={{ color: T.khaki, fontSize: 20, padding: '0 10px' }}>‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: T.text }}>
            {new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => shift(1)} aria-label="Next month" style={{ color: T.khaki, fontSize: 20, padding: '0 10px' }}>›</button>
        </div>
        <div
          data-no-swipe-back
          onTouchStart={e => { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY }; }}
          onTouchEnd={e => {
            const s0 = swipe.current; swipe.current = null;
            if (!s0) return;
            const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', touchAction: 'pan-y' }}
        >
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} style={{ fontSize: 10, color: T.muted, padding: '2px 0' }}>{d}</span>)}
          {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const ds = `${month}-${pad(i + 1)}`;
            const evs = byDay[ds] || [];
            const on = picked === ds;
            return (
              <button key={ds} onClick={() => setPicked(ds)}
                style={{ padding: '6px 0 4px', borderRadius: 8, background: on ? '#2A3A1A' : 'transparent', border: `1px solid ${ds === today ? T.olive : 'transparent'}` }}>
                <span style={{ display: 'block', fontSize: 13, color: ds < today ? T.muted : T.text, fontWeight: evs.length ? 700 : 400 }}>{i + 1}</span>
                <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, height: 7, marginTop: 2 }}>
                  {evs.slice(0, 3).map((e, k) => <span key={k} style={{ width: 5, height: 5, borderRadius: 3, background: e.symbol ? colorOf(e) : '#5AC8FA' }} />)}
                  {evs.length > 3 && <span style={{ fontSize: 8, color: T.muted, lineHeight: 1 }}>+{evs.length - 3}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      {renderDay(picked, dayItems)}
    </>
  );
}
