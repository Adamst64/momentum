import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { toDateStr, formatShortDate, formatDateYear, addDays } from '../../utils/dateUtils';
import { isMarketDay, priceDate, marketStatus } from '../../utils/marketCalendar';
import { money, signedMoney, pct, qtyFmt, soldPositions, accountGroups, txEditInit, isLegacyCash, buildValueHistory, sortTx, periodReturn, monthlyFlows, benchmarkReturn, sectorBreakdown, PERIODS, BENCHMARK, extendedPrice } from '../../utils/investing';
import { Card, SectionTitle, Chips, inputStyle, gainColor, noSelect, ConfirmDialog } from './ui';
import { ValueChart, AllocationDonut, AllocationLegend, allocationSlices, MonthlyFlows, Performers } from './Charts';
import TxModal from './TxModal';
import SymbolInput from './SymbolInput';
import HoldingModal, { TxList } from './HoldingModal';
import { ANALYST_COLOR } from './StockInfo';

const HIDE_KEY = 'momentum_hide_amounts';
const readHide = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const writeHide = v => { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ } };

const VIEWS = [
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'insights',  label: 'Insights' },
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

export default function InvestingTab({ hook, userId }) {
  const { txs, portfolio, assets, snapshots, accounts, refreshPrices, deleteTx, setTxAccount, setAsset } = hook;
  const [view, setViewState] = useState('portfolio');
  const setView = v => { setViewState(v); setOpenAccounts(new Set()); };
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
  // Account cards always start folded: leaving the Investing tab (or switching
  // to Watchlist/Insights) folds them all again. Nothing is remembered.
  const [openAccounts, setOpenAccounts] = useState(() => new Set());
  const toggleAccount = id => setOpenAccounts(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
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
    return txs.length ? [...pts, { date: nowDate, value: portfolio.value, netDeposits: portfolio.netDeposits, label: 'Now' }] : [];
  }, [series, period, today, portfolio.value, portfolio.netDeposits, txs.length]);

  const lastUpdate = Object.values(assets).map(a => a.priceUpdatedAt).filter(Boolean).sort().pop();
  const hasAuto = Object.values(assets).some(a => a.source === 'finnhub');

  const update = useCallback(async () => {
    setUpdating(true);
    setUpdateErr(null);
    try { await refreshPrices(); }
    catch (e) { setUpdateErr(e.message || 'Could not update prices'); }
    finally { setUpdating(false); }
  }, [refreshPrices]);

  // Refresh on open when prices are stale: 15 minutes while anything trades,
  // 12 hours while the market is fully closed
  useEffect(() => {
    if (autoTried.current || !hasAuto) return;
    autoTried.current = true;
    const age = lastUpdate ? Date.now() - new Date(lastUpdate) : Infinity;
    if (age > (status.session === 'closed' ? STALE_CLOSED_MS : STALE_OPEN_MS)) update();
  }, [hasAuto, lastUpdate, status.session, update]);

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
  const watch = Object.values(assets).filter(a => a.watch && !portfolio.holdings.some(h => h.symbol === a.symbol));
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

  // Owned stocks don't belong on the watchlist (catches ones bought before this rule)
  const ownedWatched = portfolio.holdings.filter(h => assets[h.symbol]?.watch).map(h => h.symbol).join(',');
  useEffect(() => {
    if (!ownedWatched) return;
    ownedWatched.split(',').forEach(s => setAsset(s, { watch: false }).catch(e => console.error('Unwatch failed:', e)));
  }, [ownedWatched, setAsset]);

  // Headline: the touched chart point, else the current value
  const first = chartPoints[0];
  const headValue = span ? span.to.value : scrub ? scrub.value : portfolio.value;
  const scrubChange = scrub && first ? scrub.value - first.value : null;
  const periodLabel = PERIODS.find(p => p.key === period)?.label;

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

      {/* Hero: value, period change, chart */}
      <Card style={noSelect}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
            color: status.session === 'open' ? T.green : status.session === 'closed' ? T.muted : T.khaki,
            background: status.session === 'open' ? 'rgba(48,209,88,0.12)' : T.bg,
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

        <div style={{ marginTop: 10, fontSize: 34, fontWeight: 800, color: T.text, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>
          {money(headValue, hide)}
        </div>

        {span ? (() => {
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
            {scrubChange !== null && first !== scrub && (
              <span style={{ color: gainColor(scrubChange) }}> · {signedMoney(scrubChange, hide)} since {formatDateYear(first.date)}</span>
            )}
          </div>
        ) : (
          <>
            {ret && !ret.unavailable && (
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: gainColor(ret.gain) }}>
                {signedMoney(ret.gain, hide)} ({pct(ret.pct)}) <span style={{ color: T.muted, fontWeight: 400 }}>· {period === 'ALL' ? 'all time' : periodLabel}</span>
              </div>
            )}
            {txs.length > 0 && (
              <div style={{ fontSize: 12, marginTop: 2, color: gainColor(portfolio.dayChange) }}>
                {signedMoney(portfolio.dayChange, hide)} today
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
            <div style={{ fontSize: 12, color: T.muted, marginTop: 10, lineHeight: 1.45 }}>
              {ret?.unavailable
                ? `Not enough history for ${periodLabel} yet${ret.trackingSince ? ` (values saved since ${formatShortDate(ret.trackingSince)})` : ''}.`
                : bench !== null && ret?.pct !== null && ret?.pct !== undefined
                  ? <>S&P 500 <span style={{ color: gainColor(bench) }}>{pct(bench)}</span> · you're {ret.pct >= bench ? 'ahead' : 'behind'} by {Math.abs((ret.pct - bench) * 100).toFixed(1)} pts</>
                  : !history ? 'Building your history from past prices…' : 'S&P 500 comparison appears once there\'s enough history.'}
              <span style={{ fontSize: 11, display: 'block', marginTop: 2 }}>Returns exclude money you add or withdraw.</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.cardBorder}`, fontSize: 12, color: T.muted }}>
              <span>Invested <b style={{ color: T.text, fontWeight: 600 }}>{money(portfolio.holdingsValue, hide)}</b></span>
              <span>All-time <b style={{ color: gainColor(portfolio.totalGain), fontWeight: 600 }}>{signedMoney(portfolio.totalGain, hide)}</b></span>
            </div>
          </>
        )}

        {hasAuto && (
          <button onClick={update} disabled={updating} style={{ marginTop: 8, padding: 0, fontSize: 11, color: updateErr ? T.red : T.muted, textAlign: 'left' }}>
            {updating ? 'Updating prices…' : updateErr ? `${updateErr} · tap to retry` : lastUpdate ? `Prices updated ${ago(lastUpdate)} · ↻` : 'Tap to update prices ↻'}
          </button>
        )}
      </Card>

      <Chips options={VIEWS} value={view} onChange={setView} />

      {txs.length === 0 && view !== 'watchlist' && (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '24px 12px', lineHeight: 1.5 }}>
          Tap <b style={{ color: T.text }}>+</b> to get started. For what you already own, choose <b style={{ color: T.text }}>Buy</b> → <b style={{ color: T.text }}>Already owned</b> — that includes
          money market funds like FDRXX. New money goes in with <b style={{ color: T.text }}>Add money</b> (into a fund), and buys are paid from that fund. Past trades are fine — just pick their real date.
        </div>
      )}

      {view === 'portfolio' && txs.length > 0 && (
        <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {groupMode && <Chips small options={[{ value: 'account', label: 'By account' }, { value: 'all', label: 'All' }]} value={byAccount ? 'account' : 'all'} onChange={v => setByAccountPref(v === 'account')} />}
          <span style={{ flex: 1 }} />
          <button onClick={() => setManageAccounts(true)} style={{ fontSize: 12, color: T.khaki, padding: '4px 0' }}>
            {accounts.length ? 'Accounts' : '+ Set up accounts'}
          </button>
        </div>
        {byAccount ? groups.map(g => (
          <AccountCard
            key={g.id || 'none'} g={g} hide={hide} open={openAccounts.has(g.id)} onToggle={() => toggleAccount(g.id)}
            onAssign={() => setManageAccounts(true)}
            renderRow={pos => <HoldingRow key={pos.key} h={pos} first={false} {...rowProps} inAccounts={acctCount[pos.symbol]} share={allocTotal > 0 && pos.value ? pos.value / allocTotal : 0} />}
            onOpenSold={sym => setOpen({ symbol: sym, account: g.id })}
          />
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

      {view === 'watchlist' && (
        <Watchlist hook={hook} items={watch} hide={hide} onOpen={setOpen} />
      )}

      {view === 'insights' && txs.length > 0 && (
        <>
          <Card>
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

          <Card>
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

          <Card>
            <SectionTitle>Top & bottom performers</SectionTitle>
            <Performers holdings={portfolio.holdings} hide={hide} onOpen={setOpen} />
          </Card>

          <Card>
            <SectionTitle>Monthly: deposited vs invested</SectionTitle>
            <MonthlyFlows months={monthlyFlows(txs.filter(t => t.note !== 'Cleared leftover cash'))} hide={hide} />
          </Card>

          <Card>
            <SectionTitle>Totals</SectionTitle>
            <TotalRow label="Money added (net)" value={money(portfolio.netDeposits, hide)} />
            <TotalRow label="Realized gains (sells)" value={signedMoney(portfolio.realized, hide)} color={gainColor(portfolio.realized)} />
            <TotalRow label="Dividends received" value={money(portfolio.dividends, hide)} />
            <TotalRow label="Unrealized gains" value={signedMoney(portfolio.holdings.reduce((a, h) => a + (h.unrealized || 0), 0), hide)} />
          </Card>

          <Card>
            <SectionTitle>All transactions</SectionTitle>
            <TxList txs={txs} hide={hide} onDelete={deleteTx} onEdit={t => { const e = txEditInit(t, txs); if (e) setEditing(e); }} accounts={accounts} onSetAccount={setTxAccount} />
          </Card>
        </>
      )}

      {adding && (
        <Modal title="Add" onClose={() => setAdding(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ADD_ACTIONS.map(a => (
              <button
                key={a.type}
                onClick={() => { setAdding(false); setTrade({ type: a.type }); }}
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
      {trade && <TxModal hook={hook} initialType={trade.type} initialSymbol={trade.symbol || ''} onClose={() => setTrade(null)} />}
      {manageAccounts && <AccountsModal hook={hook} onClose={() => setManageAccounts(false)} />}
      {editing && <TxModal hook={hook} editing={editing} onClose={() => setEditing(null)} />}
      {open && (
        <HoldingModal
          key={openSym}
          hook={hook} symbol={openSym} account={typeof open === 'object' ? open.account : undefined} hide={hide} userId={userId}
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
    </div>
  );
}

// One holding (or one account's position) in the Portfolio list
function HoldingRow({ h, first, share, inAccounts, assets, today, soonDate, laterDate, hide, sliceColor, onOpen }) {
  const next = assets[h.symbol]?.nextEarnings;
  const showEarn = next && next.date >= today && next.date <= laterDate;
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
                Earnings {earningsBadge(next.date, today)}
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
          <div style={{ fontSize: 12, color: gainColor(h.unrealized) }}>
            {pct(h.unrealizedPct)}{h.dayPct !== null && <span style={{ color: gainColor(h.dayPct) }}> · {pct(h.dayPct)} today</span>}
          </div>
          {h.ext && <div style={{ fontSize: 11, color: gainColor(h.ext.pct) }}>{h.ext.label} {pct(h.ext.pct)}</div>}
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
        <input value={v} onChange={e => setV(e.target.value)} inputMode="decimal" placeholder="% of portfolio, e.g. 25" autoFocus style={inputStyle} />
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

// One account in the Portfolio: tap the header to fold/unfold its holdings
function AccountCard({ g, hide, open, onToggle, onAssign, renderRow, onOpenSold }) {
  const n = g.positions.length;
  return (
    <Card style={{ padding: '4px 16px' }}>
      <button onClick={onToggle} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', textAlign: 'left' }}>
        <span style={{ fontSize: 12, color: T.muted, width: 12, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
          <span style={{ display: 'block', fontSize: 11, color: T.muted }}>
            {n} holding{n !== 1 ? 's' : ''}{g.sold.length ? ` · ${g.sold.length} sold` : ''}
          </span>
        </span>
        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: T.text }}>{money(g.value, hide)}</span>
          {Math.abs(g.dayChange) > 0.005 && <span style={{ display: 'block', fontSize: 11, color: gainColor(g.dayChange) }}>{signedMoney(g.dayChange, hide)} today</span>}
        </span>
      </button>

      {open && (
        <div style={{ paddingBottom: 6 }}>
          {g.id === '' && (
            <button onClick={onAssign} style={{ fontSize: 12, color: T.khaki, padding: '0 0 6px', textAlign: 'left' }}>Assign these to accounts →</button>
          )}
          {g.positions.map(renderRow)}
          {n === 0 && <div style={{ fontSize: 12, color: T.muted, padding: '6px 0 8px', borderTop: `1px solid ${T.cardBorder}` }}>Nothing held here right now.</div>}
          {g.sold.length > 0 && (
            <div style={{ borderTop: `1px solid ${T.cardBorder}`, paddingTop: 10, marginTop: 2 }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Sold</div>
              <SoldRows items={g.sold} hide={hide} onOpen={onOpenSold} />
            </div>
          )}
        </div>
      )}
    </Card>
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

function Watchlist({ hook, items, hide, onOpen }) {
  const { portfolio, setAsset, removeAsset, refreshPrices } = hook;
  const [asking, setAsking] = useState(null); // symbol waiting for "are you sure?"
  const [sym, setSym] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const add = async () => {
    const s = sym.trim().toUpperCase();
    if (!s || busy) return;
    if (portfolio.holdings.some(h => h.symbol === s)) { setMsg(`You already own ${s} — it's in your portfolio.`); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await refreshPrices([s]);
      if (res.notFound?.includes(s)) { setMsg(`Couldn't find a price for ${s}. Check the ticker.`); return; }
      await setAsset(s, { watch: true });
      setSym('');
    } catch (e) {
      setMsg(e.message || 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Watchlist</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SymbolInput hook={hook} value={sym} onChange={setSym} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Ticker or company, e.g. NVDA" />
        </div>
        <button onClick={add} disabled={busy} style={{ height: 44, padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}>{busy ? '…' : 'Add'}</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: T.red, marginBottom: 8 }}>{msg}</div>}
      {items.length === 0 && <div style={{ fontSize: 13, color: T.muted }}>Track stocks you don't own yet. Prices refresh automatically, or pull down to update.</div>}
      {items.map((a, i) => {
        const day = a.price && a.prevClose ? (a.price - a.prevClose) / a.prevClose : null;
        const ext = extendedPrice(a);
        return (
          <div key={a.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
            <button onClick={() => onOpen(a.symbol)} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{a.symbol}</div>
              {a.name && <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>}
              <TargetLine target={a.priceTarget} analyst={a.analyst?.targetMean} price={a.price} hide={hide} />
            </button>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ fontSize: 14, color: T.text }}>{money(a.price, hide)}</div>
              <div style={{ fontSize: 12, color: gainColor(day) }}>{pct(day)}</div>
              {ext && <div style={{ fontSize: 11, color: gainColor(ext.pct) }}>{ext.label} {pct(ext.pct)}</div>}
            </div>
            <button onClick={() => setAsking(a.symbol)} aria-label={`Remove ${a.symbol}`} style={{ fontSize: 16, color: T.subtle }}>×</button>
          </div>
        );
      })}
      {asking && (
        <ConfirmDialog
          title={`Remove ${asking} from your watchlist?`}
          message="It stops showing here. You can add it back any time."
          confirmLabel="Remove"
          onConfirm={() => removeAsset(asking)}
          onClose={() => setAsking(null)}
        />
      )}
    </Card>
  );
}
