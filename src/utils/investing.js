import { toDateStr, addDays } from './dateUtils';

// Transactions (users/{uid}/invTransactions):
//   deposit / withdraw: { type, date, amount, note? }      — salary in, cash out
//   buy / sell:         { type, date, symbol, quantity, price, fee?, fromCash? }
//                       fromCash: false on a buy = shares already owned before using the app
//                       (or moved in from elsewhere): cash isn't touched and the cost counts
//                       as money brought in, like a deposit of shares
//   dividend:           { type, date, symbol, amount }       — paid into cash
//   interest:           { type, date, amount }               — earned on cash itself (e.g. Vanguard's
//                                                              VMFXX settlement fund, which stays at $1/share)
// Deposits/withdrawals (and already-owned buys) are external money, so they never count as return.
// Buys/sells/dividends/interest move money between cash and holdings and do count.

export const CASH_ID = 'cash'; // invAssets doc holding the cash target %
export const BENCHMARK = 'SPY'; // S&P 500 ETF; its price is saved with each daily snapshot

// Pre-market / after-hours price saved on an invAssets doc (extPrice, extSession,
// extTime), compared with the last regular-session price. Null during the
// regular session (weekdays 9:30–16:00 ET) or when it's older than 4 days.
export function extendedPrice(a, now = new Date()) {
  if (!a?.extPrice || !a.price || !a.extTime) return null;
  if (now - new Date(a.extTime) > 4 * 864e5) return null;
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const m = et.getHours() * 60 + et.getMinutes();
  if (et.getDay() >= 1 && et.getDay() <= 5 && m >= 9 * 60 + 30 && m < 16 * 60) return null;
  return {
    price: a.extPrice,
    session: a.extSession,
    label: a.extSession === 'pre' ? 'Pre-market' : 'After hours',
    change: a.extPrice - a.price,
    pct: (a.extPrice - a.price) / a.price,
    time: a.extTime,
  };
}

export function sortTx(txs) {
  return [...txs].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

// Replays every transaction in date order. Average-cost method: a sell removes
// cost at the current average, so the average itself doesn't change on sells.
export function replay(txs) {
  let cash = 0, netDeposits = 0, minCash = 0, interest = 0;
  const h = {};
  const hold = sym => (h[sym] = h[sym] || { symbol: sym, qty: 0, cost: 0, realized: 0, dividends: 0, firstDate: null, lot: null, lastExit: null });
  // lot: the current position since it last opened from zero (cost basis in, sells out).
  // lastExit: that lot's summary once it's fully sold — for the "Sold" list.
  const problems = [];

  for (const t of sortTx(txs)) {
    if (t.type === 'deposit')  { cash += t.amount; netDeposits += t.amount; }
    if (t.type === 'withdraw') { cash -= t.amount; netDeposits -= t.amount; }
    if (t.type === 'dividend') { cash += t.amount; hold(t.symbol).dividends += t.amount; }
    if (t.type === 'interest') { cash += t.amount; interest += t.amount; }
    if (t.type === 'buy') {
      const x = hold(t.symbol);
      const total = t.quantity * t.price + (t.fee || 0);
      if (t.fromCash === false) netDeposits += total;
      else cash -= total;
      if (x.qty < 1e-9) x.lot = { start: t.date, cost: 0, sold: 0, proceeds: 0, realized: 0 };
      x.lot.cost += total;
      x.qty += t.quantity;
      x.cost += total;
      x.firstDate = x.firstDate || t.date;
    }
    if (t.type === 'sell') {
      const x = hold(t.symbol);
      if (t.quantity > x.qty + 1e-9) problems.push({ tx: t, msg: `Sells more ${t.symbol} than held on ${t.date}` });
      const avg = x.qty > 0 ? x.cost / x.qty : 0;
      const sold = Math.min(t.quantity, x.qty);
      cash += t.quantity * t.price - (t.fee || 0);
      x.realized += sold * (t.price - avg) - (t.fee || 0);
      if (x.lot) {
        x.lot.sold += sold;
        x.lot.proceeds += sold * t.price - (t.fee || 0);
        x.lot.realized += sold * (t.price - avg) - (t.fee || 0);
      }
      x.cost -= avg * sold;
      x.qty -= sold;
      if (x.qty < 1e-9) {
        x.qty = 0; x.cost = 0;
        if (x.lot && x.lot.sold > 0) {
          x.lastExit = {
            date: t.date,          // when the last shares went
            bought: x.lot.start,
            qty: x.lot.sold,
            avgSell: x.lot.proceeds / x.lot.sold, // net of fees, per share
            proceeds: x.lot.proceeds,
            cost: x.lot.cost,
            realized: x.lot.realized,
          };
        }
        x.lot = null;
      }
    }
    minCash = Math.min(minCash, cash);
  }
  return { cash, netDeposits, minCash, interest, holdings: h, problems };
}

// Full picture with current prices. assets: { [symbol]: { price, prevClose, name, ... } }
export function computePortfolio(txs, assets) {
  const { cash, netDeposits, interest, holdings } = replay(txs);
  let holdingsValue = 0, dayChange = 0, realized = 0, dividends = 0;
  let extChange = 0, extLabel = null;

  const rows = Object.values(holdings).map(x => {
    const a = assets[x.symbol] || {};
    const price = a.price ?? null;
    const value = price !== null ? x.qty * price : null;
    const unrealized = value !== null ? value - x.cost : null;
    const ext = extendedPrice(a);
    realized += x.realized;
    dividends += x.dividends;
    if (x.qty > 0 && value !== null) {
      holdingsValue += value;
      if (a.prevClose) dayChange += x.qty * (price - a.prevClose);
      if (ext) { extChange += x.qty * ext.change; extLabel = ext.label; }
    }
    return {
      ...x,
      name: a.name || null,
      source: a.source || 'manual',
      price, prevClose: a.prevClose ?? null, priceUpdatedAt: a.priceUpdatedAt || null,
      avgCost: x.qty > 0 ? x.cost / x.qty : null,
      value, unrealized,
      unrealizedPct: unrealized !== null && x.cost > 0 ? unrealized / x.cost : null,
      dayPct: price && a.prevClose ? (price - a.prevClose) / a.prevClose : null,
      ext,
    };
  });

  const open = rows.filter(r => r.qty > 0).sort((a, b) => (b.value || 0) - (a.value || 0));
  const value = cash + holdingsValue;
  return {
    cash, netDeposits, holdingsValue, value, dayChange, realized, dividends, interest,
    // Pre-market / after-hours move on top of the last close (not part of value)
    ext: extLabel ? { label: extLabel, change: extChange } : null,
    totalGain: value - netDeposits,
    holdings: open,
    closed: rows.filter(r => r.qty === 0),
  };
}

// Fully sold positions with how the price moved since. "If held" is what the
// sold shares would be worth now versus what you got for them: positive means
// the price kept rising after you sold, negative means selling saved you that.
export function soldPositions(closed, assets) {
  return closed
    .filter(c => c.lastExit)
    .map(c => {
      const e = c.lastExit;
      const price = assets[c.symbol]?.price ?? null;
      const sinceSell = price !== null && e.avgSell > 0 ? price / e.avgSell - 1 : null;
      return {
        symbol: c.symbol, name: c.name, ...e, price,
        realizedPct: e.cost > 0 ? e.realized / e.cost : null,
        sinceSell,
        ifHeld: price !== null ? e.qty * price - e.proceeds : null,
        dividends: c.dividends,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Checks a new/edited transaction against the rest before saving
export function validateTx(txs, tx) {
  const before = replay(txs);
  const after  = replay([...txs, tx]);
  const errors = after.problems.filter(p => !before.problems.some(b => b.tx === p.tx)).map(p => p.msg);
  const cashShort = after.minCash < -0.005 && after.minCash < before.minCash - 0.005;
  return { errors, cashShort, cashAfter: after.cash };
}

export const PERIODS = [
  { key: '1W',  label: '1W',  start: t => addDays(t, -7) },
  { key: '1M',  label: '1M',  start: t => shiftMonths(t, -1) },
  { key: '3M',  label: '3M',  start: t => shiftMonths(t, -3) },
  { key: 'YTD', label: 'YTD', start: t => `${Number(t.slice(0, 4)) - 1}-12-31` },
  { key: '1Y',  label: '1Y',  start: t => shiftMonths(t, -12) },
  { key: 'ALL', label: 'All', start: null },
];

function shiftMonths(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + n);
  return toDateStr(d);
}

const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

// Modified Dietz return: gain excluding deposits/withdrawals, divided by the
// average money at work. Needs the portfolio value at the period start, from a
// saved daily snapshot — or zero when the period starts before the first trade.
export function periodReturn(txs, snapshots, currentValue, periodKey, today = toDateStr(new Date())) {
  const sorted = sortTx(txs);
  if (!sorted.length) return null;
  const first = sorted[0].date;
  const p = PERIODS.find(x => x.key === periodKey);
  let start = p.start ? p.start(today) : addDays(first, -1);

  let startValue;
  if (start < first) {
    start = addDays(first, -1);
    startValue = 0;
  } else {
    const snap = [...snapshots].filter(s => s.date <= start).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!snap) {
      const firstSnap = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))[0];
      return { unavailable: true, trackingSince: firstSnap?.date || null };
    }
    startValue = snap.value;
  }

  const span = Math.max(1, daysBetween(start, today));
  let flows = 0, weighted = 0;
  for (const t of sorted) {
    if (t.date <= start || t.date > today) continue;
    const f = externalFlow(t);
    if (!f) continue;
    flows += f;
    weighted += f * (daysBetween(t.date, today) / span);
  }
  const gain  = currentValue - startValue - flows;
  const basis = startValue + weighted;
  return { gain, pct: basis > 0 ? gain / basis : null, start, startValue };
}

// Money coming in from outside (+) or leaving (−); zero for everything else
export function externalFlow(t) {
  if (t.type === 'deposit')  return t.amount;
  if (t.type === 'withdraw') return -t.amount;
  if (t.type === 'buy' && t.fromCash === false) return t.quantity * t.price + (t.fee || 0);
  return 0;
}

// Per month: money deposited (net of withdrawals), net invested in assets, dividends
export function monthlyFlows(txs) {
  const m = {};
  for (const t of txs) {
    const k = t.date.slice(0, 7);
    const x = (m[k] = m[k] || { month: k, deposited: 0, invested: 0, dividends: 0 });
    x.deposited += externalFlow(t);
    if (t.type === 'buy')      x.invested  += t.quantity * t.price + (t.fee || 0);
    if (t.type === 'sell')     x.invested  -= t.quantity * t.price - (t.fee || 0);
    if (t.type === 'dividend' || t.type === 'interest') x.dividends += t.amount;
  }
  return Object.values(m).sort((a, b) => b.month.localeCompare(a.month));
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = (n, hide = false) => (hide ? '••••' : n === null || n === undefined ? '—' : usd.format(n));
export const signedMoney = (n, hide = false) => (hide ? '••••' : n === null ? '—' : (n > 0 ? '+' : '') + usd.format(n));
export const pct = (r) => (r === null || r === undefined ? '—' : `${r > 0 ? '+' : ''}${(r * 100).toFixed(2)}%`);
export const qtyFmt = (q) => Number(q.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });

// Interest on cash over the last 12 months, and that as a rough yield on today's cash
export function cashInterestYear(txs, cash, today = toDateStr(new Date())) {
  const from = shiftMonths(today, -12);
  const total = txs.filter(t => t.type === 'interest' && t.date > from).reduce((a, t) => a + t.amount, 0);
  return { total, approxYield: cash > 0 && total > 0 ? total / cash : null };
}

// S&P 500 (SPY) price change over the same window as periodReturn, or null
// until a snapshot with a saved SPY price exists at the period start
export function benchmarkReturn(snapshots, start, spyNow) {
  if (!start || !spyNow) return null;
  const snap = [...snapshots].filter(s => s.date <= start && s.spy).sort((a, b) => b.date.localeCompare(a.date))[0];
  return snap ? spyNow / snap.spy - 1 : null;
}

// Holdings value grouped by industry; ETFs and anything without a profile share a bucket
export function sectorBreakdown(holdings, assets) {
  const by = {};
  let total = 0;
  for (const h of holdings) {
    if (!h.value) continue;
    const sector = assets[h.symbol]?.industry || 'ETFs & other';
    by[sector] = (by[sector] || 0) + h.value;
    total += h.value;
  }
  return Object.entries(by)
    .map(([sector, value]) => ({ sector, value, pct: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}
