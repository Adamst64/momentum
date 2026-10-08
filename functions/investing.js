const { HttpsError } = require('firebase-functions/v2/https');
const { isMarketDay } = require('./marketCalendar');

// Finnhub API key lives in Firestore at config/finnhub { key }. Clients can't
// read it (no rule matches config/), only these functions via the Admin SDK.
async function getFinnhubKey(db) {
  const snap = await db.doc('config/finnhub').get();
  return snap.exists ? snap.data().key : null;
}

async function finnhub(path, key) {
  const res = await fetch(`https://finnhub.io/api/v1/${path}&token=${encodeURIComponent(key)}`);
  if (res.status === 429) throw new HttpsError('resource-exhausted', 'Price service rate limit hit. Try again in a minute.');
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

// Returns { price, prevClose } or null when Finnhub doesn't know the symbol
async function quote(symbol, key) {
  const q = await finnhub(`quote?symbol=${encodeURIComponent(symbol)}`, key);
  return q && q.c > 0 ? { price: q.c, prevClose: q.pc || null } : null;
}

// Fetch quotes for symbols (sequential: free tier allows ~60 calls/minute)
async function fetchQuotes(symbols, key) {
  const out = {};
  for (const s of symbols) out[s] = await quote(s, key);
  return out;
}

// ── Extended hours (pre-market 4:00–9:30, after hours 16:00–20:00 ET) ─────────
// Finnhub's free quote only covers the regular session, so outside it we read
// Yahoo's chart endpoint (unofficial and keyless; can change without notice).
// The extended price is stored apart from price/prevClose so day change,
// returns and snapshots stay tied to the official close.

// Latest pre/after-hours trade: { extPrice, extSession: 'pre'|'post', extTime },
// or null when the latest trade is from the regular session or there is none
async function extendedQuote(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=true`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  const ts = r?.timestamp || [];
  const closes = r?.indicators?.quote?.[0]?.close || [];
  for (let i = ts.length - 1; i >= 0; i--) {
    if (!(closes[i] > 0)) continue;
    const when = new Date(ts[i] * 1000);
    const m = easternNow(when).minutes;
    const session = m < 9 * 60 + 30 ? 'pre' : m >= 16 * 60 ? 'post' : null;
    return session ? { extPrice: Math.round(closes[i] * 1e4) / 1e4, extSession: session, extTime: when.toISOString() } : null;
  }
  return null;
}

const NO_EXT = { extPrice: null, extSession: null, extTime: null };

// Fields to merge into an invAssets doc: the extended price outside the regular
// session, cleared during it. Errors leave the existing values alone.
async function extendedFields(symbol, et) {
  if (isRegularSession(et)) return NO_EXT;
  try { return (await extendedQuote(symbol)) || NO_EXT; }
  catch (e) { console.warn(`Extended quote for ${symbol} failed:`, e.message); return {}; }
}

// ── Portfolio math (mirrors src/utils/investing.js, kept minimal) ────────────

function sortTx(txs) {
  return [...txs].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

function summarize(txs, prices) {
  let cash = 0, netDeposits = 0;
  const qty = {};
  for (const t of sortTx(txs)) {
    if (t.type === 'deposit')  { cash += t.amount; netDeposits += t.amount; }
    if (t.type === 'withdraw') { cash -= t.amount; netDeposits -= t.amount; }
    if (t.type === 'buy') {
      const total = t.quantity * t.price + (t.fee || 0);
      // fromCash: false = shares already owned before using the app; cash untouched
      if (t.fromCash === false) netDeposits += total;
      else cash -= total;
      qty[t.symbol] = (qty[t.symbol] || 0) + t.quantity;
    }
    if (t.type === 'sell')     { cash += t.quantity * t.price - (t.fee || 0); qty[t.symbol] = (qty[t.symbol] || 0) - t.quantity; }
    if (t.type === 'dividend' || t.type === 'interest') { cash += t.amount; }
  }
  let holdingsValue = 0;
  for (const [sym, q] of Object.entries(qty)) {
    if (q > 1e-9) holdingsValue += q * (prices[sym] || 0);
  }
  return { cash, netDeposits, holdingsValue, value: cash + holdingsValue, qty };
}

// ── Extra data kept on each invAssets doc ───────────────────────────────────

const HOURS = h => h * 3600 * 1000;
const isStale = (iso, ms) => !iso || Date.now() - new Date(iso).getTime() > ms;
const ymd = d => d.toISOString().slice(0, 10);
const BENCHMARK = 'SPY'; // S&P 500 ETF, used to compare returns

// Name, industry (sector) and logo. Finnhub's free profile covers stocks, not ETFs.
async function fetchProfile(sym, key) {
  const p = await finnhub(`stock/profile2?symbol=${encodeURIComponent(sym)}`, key);
  return {
    ...(p?.name ? { name: p.name } : {}),
    industry: p?.finnhubIndustry || null,
    logo: p?.logo || null,
    weburl: p?.weburl || null,
    profileCheckedAt: new Date().toISOString(),
  };
}

// Next earnings report within ~5 weeks, or null
async function fetchNextEarnings(sym, key) {
  const from = new Date();
  const to = new Date(Date.now() + 35 * 864e5);
  const res = await finnhub(`calendar/earnings?from=${ymd(from)}&to=${ymd(to)}&symbol=${encodeURIComponent(sym)}`, key);
  const next = (res?.earningsCalendar || [])
    .filter(e => e.symbol === sym && e.date >= ymd(from))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    nextEarnings: next ? { date: next.date, hour: next.hour || null, epsEstimate: next.epsEstimate ?? null } : null,
    earningsCheckedAt: new Date().toISOString(),
  };
}

// ── Callable: refresh prices for the signed-in user ──────────────────────────

async function refreshPrices(db, request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const key = await getFinnhubKey(db);
  if (!key) throw new HttpsError('failed-precondition', 'Price service is not set up yet (missing Finnhub key).');

  const assetsCol = db.collection('users').doc(uid).collection('invAssets');
  const explicit = Array.isArray(request.data?.symbols);
  let symbols = explicit
    ? request.data.symbols.map(s => String(s).trim().toUpperCase()).filter(Boolean)
    : (await assetsCol.where('source', '==', 'finnhub').get()).docs.map(d => d.id);
  if (!explicit) symbols.push(BENCHMARK);
  symbols = [...new Set(symbols)].slice(0, 40);

  // Free tier allows ~60 calls/minute: quotes first, then profile/earnings
  // refreshes while budget remains (the rest catch up on the next update)
  let budget = 55;
  const call = async fn => { budget--; return fn(); };

  const now = new Date().toISOString();
  const et = easternNow();
  const prices = {};
  const notFound = [];
  for (const sym of symbols) {
    const q = await call(() => quote(sym, key));
    if (!q) { notFound.push(sym); continue; }
    prices[sym] = q;
    const ref = assetsCol.doc(sym);
    const existing = (await ref.get()).data() || {};
    const update = { symbol: sym, source: 'finnhub', price: q.price, prevClose: q.prevClose, priceUpdatedAt: now,
      ...(await extendedFields(sym, et)) };
    if (sym === BENCHMARK && !existing.watch) update.benchmark = true;

    if (sym !== BENCHMARK || existing.watch) {
      if (budget > symbols.length && (!existing.name || isStale(existing.profileCheckedAt, HOURS(24 * 7)))) {
        try { Object.assign(update, await call(() => fetchProfile(sym, key))); } catch { /* optional */ }
      }
      if (budget > symbols.length && isStale(existing.earningsCheckedAt, HOURS(20))) {
        try { Object.assign(update, await call(() => fetchNextEarnings(sym, key))); } catch { /* optional */ }
      }
    }
    await ref.set(update, { merge: true });
  }
  return { prices, notFound, updatedAt: now };
}

// ── Callable: details for one stock (stats, past earnings) ───────────────────

async function stockInfo(db, request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const sym = String(request.data?.symbol || '').trim().toUpperCase();
  if (!sym) throw new HttpsError('invalid-argument', 'Symbol required');
  const key = await getFinnhubKey(db);
  if (!key) throw new HttpsError('failed-precondition', 'Price service is not set up yet (missing Finnhub key).');

  const ref = db.collection('users').doc(uid).collection('invAssets').doc(sym);
  const cached = (await ref.get()).data() || {};
  const update = {};

  // Key stats and past earnings change at most daily, so cache them
  if (isStale(cached.metricsAt, HOURS(20))) {
    try {
      const m = (await finnhub(`stock/metric?symbol=${encodeURIComponent(sym)}&metric=all`, key))?.metric || {};
      update.metrics = {
        high52: m['52WeekHigh'] ?? null,
        low52: m['52WeekLow'] ?? null,
        pe: m.peTTM ?? m.peBasicExclExtraTTM ?? null,
        marketCap: m.marketCapitalization ?? null, // millions of USD
        dividendYield: m.currentDividendYieldTTM ?? m.dividendYieldIndicatedAnnual ?? null, // percent
        beta: m.beta ?? null,
      };
      const e = await finnhub(`stock/earnings?symbol=${encodeURIComponent(sym)}`, key);
      update.earningsHistory = (Array.isArray(e) ? e : []).slice(0, 4).map(x => ({
        period: x.period, actual: x.actual ?? null, estimate: x.estimate ?? null, surprisePercent: x.surprisePercent ?? null,
      }));
      update.metricsAt = new Date().toISOString();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
    }
  }
  if (!cached.profileCheckedAt) {
    try { Object.assign(update, await fetchProfile(sym, key)); } catch { /* optional */ }
  }
  if (isStale(cached.earningsCheckedAt, HOURS(20))) {
    try { Object.assign(update, await fetchNextEarnings(sym, key)); } catch { /* optional */ }
  }
  if (Object.keys(update).length) await ref.set({ symbol: sym, ...update }, { merge: true });

  const merged = { ...cached, ...update };
  return {
    metrics: merged.metrics || null,
    earningsHistory: merged.earningsHistory || [],
    nextEarnings: merged.nextEarnings || null,
    profile: { name: merged.name || null, industry: merged.industry || null, logo: merged.logo || null, weburl: merged.weburl || null },
  };
}

// ── Scheduled per-user work, called from the every-5-minutes job ─────────────

function easternNow(date = new Date()) {
  const now = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = `${ym}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    today,
    minutes: now.getHours() * 60 + now.getMinutes(),
    weekday: isMarketDay(today), // false on weekends and market holidays
  };
}

// Market day 9:30–16:00 ET
const isRegularSession = et => et.weekday && et.minutes >= 9 * 60 + 30 && et.minutes < 16 * 60;
// Market day 4:00–20:00 ET: regular session plus pre-market and after hours
const isTradingDay = et => et.weekday && et.minutes >= 4 * 60 && et.minutes <= 20 * 60;

// Pre-market and after hours: refresh extended prices of auto-priced assets every 15 minutes
async function maybeRefreshExtended(userDoc, et) {
  if (!isTradingDay(et) || isRegularSession(et)) return;
  if (et.minutes % 15 >= 5) return;
  const assets = (await userDoc.ref.collection('invAssets').where('source', '==', 'finnhub').get()).docs.slice(0, 40);
  for (const a of assets) {
    const fields = await extendedFields(a.id, et);
    if (Object.keys(fields).length) await a.ref.set(fields, { merge: true });
  }
}

// Daily snapshot after US market close (16:30–17:30 ET), for the value chart.
// Skipped on weekends and holidays so the chart has no flat closed-market days.
async function maybeSnapshot(db, userDoc, key, et) {
  if (!et.weekday) return;
  if (et.minutes < 16 * 60 + 30 || et.minutes >= 17 * 60 + 30) return;
  if (userDoc.data().investing?.lastSnapshotDate === et.today) return;

  const userRef = userDoc.ref;
  const txSnap = await userRef.collection('invTransactions').get();
  if (txSnap.empty) return;
  await userRef.set({ investing: { lastSnapshotDate: et.today } }, { merge: true });

  const txs = txSnap.docs.map(d => d.data());
  const assets = (await userRef.collection('invAssets').get()).docs.map(d => d.data());
  const prices = Object.fromEntries(assets.map(a => [a.symbol, a.price || 0]));

  // Refresh auto-priced holdings first so the snapshot uses closing prices
  const held = Object.entries(summarize(txs, prices).qty).filter(([, q]) => q > 1e-9).map(([s]) => s);
  const auto = assets.filter(a => a.source === 'finnhub' && held.includes(a.symbol)).map(a => a.symbol);
  if (key && auto.length) {
    const quotes = await fetchQuotes(auto, key);
    const now = new Date().toISOString();
    for (const [sym, q] of Object.entries(quotes)) {
      if (!q) continue;
      prices[sym] = q.price;
      await userRef.collection('invAssets').doc(sym).set(
        { price: q.price, prevClose: q.prevClose, priceUpdatedAt: now }, { merge: true });
    }
  }

  let spy = null;
  if (key) {
    try {
      const q = await quote(BENCHMARK, key);
      if (q) {
        spy = q.price;
        await userRef.collection('invAssets').doc(BENCHMARK).set(
          { symbol: BENCHMARK, source: 'finnhub', price: q.price, prevClose: q.prevClose, priceUpdatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch { /* benchmark is optional */ }

    // Keep upcoming earnings dates fresh for holdings
    for (const a of assets.filter(x => x.source === 'finnhub' && held.includes(x.symbol) && isStale(x.earningsCheckedAt, HOURS(20)))) {
      try { await userRef.collection('invAssets').doc(a.symbol).set(await fetchNextEarnings(a.symbol, key), { merge: true }); }
      catch { /* optional */ }
    }
  }

  const s = summarize(txs, prices);
  await userRef.collection('invSnapshots').doc(et.today).set({
    date: et.today, value: s.value, cash: s.cash, netDeposits: s.netDeposits, spy, updatedAt: new Date().toISOString(),
  });
}

// Price alerts: every 15 minutes, 4:00–20:00 ET on market days. The regular session
// uses Finnhub; pre-market and after hours use the extended price.
async function maybeCheckAlerts(db, userDoc, key, et, notify) {
  if (!isTradingDay(et)) return;
  if (et.minutes % 15 >= 5) return;
  const regular = isRegularSession(et);
  if (regular && !key) return;

  const alertsSnap = await userDoc.ref.collection('invAlerts').where('enabled', '==', true).get();
  if (alertsSnap.empty) return;
  const alerts = alertsSnap.docs;
  const symbols = [...new Set(alerts.map(a => a.data().symbol))];
  let quotes = {};
  if (regular) quotes = await fetchQuotes(symbols, key);
  else {
    for (const s of symbols) {
      try {
        const x = await extendedQuote(s);
        quotes[s] = x && { price: x.extPrice, session: x.extSession };
      } catch (e) { console.warn(`Extended quote for ${s} failed:`, e.message); }
    }
  }

  for (const a of alerts) {
    const { symbol, direction, target } = a.data();
    const q = quotes[symbol];
    if (!q) continue;
    const hit = direction === 'above' ? q.price >= target : q.price <= target;
    if (!hit) continue;
    // One-shot: disable before sending so it can't fire twice
    await a.ref.update({ enabled: false, triggeredAt: new Date().toISOString(), triggeredPrice: q.price });
    const label = q.session === 'pre' ? ' (pre-market)' : q.session === 'post' ? ' (after hours)' : '';
    await notify(`📈 ${symbol} ${direction === 'above' ? 'rose above' : 'fell below'} $${target}`,
      `Now $${q.price.toFixed(2)}${label}`);
  }
}

// Evening before a holding reports earnings (7:00–8:00 PM ET), one push per day
async function maybeEarningsReminder(userDoc, et, notify) {
  if (et.minutes < 19 * 60 || et.minutes >= 20 * 60) return;
  if (userDoc.data().investing?.lastEarningsReminder === et.today) return;

  const tomorrow = new Date(et.today + 'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tmr = tomorrow.toISOString().slice(0, 10);

  const assets = (await userDoc.ref.collection('invAssets').where('nextEarnings.date', '==', tmr).get()).docs.map(d => d.data());
  if (!assets.length) return;
  const txs = (await userDoc.ref.collection('invTransactions').get()).docs.map(d => d.data());
  const { qty } = summarize(txs, {});
  const reporting = assets.filter(a => (qty[a.symbol] || 0) > 1e-9);
  if (!reporting.length) return;

  await userDoc.ref.set({ investing: { lastEarningsReminder: et.today } }, { merge: true });
  const when = h => (h === 'bmo' ? 'before the open' : h === 'amc' ? 'after the close' : '');
  const list = reporting.map(a => `${a.symbol}${when(a.nextEarnings.hour) ? ' ' + when(a.nextEarnings.hour) : ''}`).join(', ');
  await notify('📊 Earnings tomorrow', `${list} report${reporting.length === 1 ? 's' : ''} tomorrow.`);
}

async function runInvestingJobs(db, userDoc, notify) {
  const et = easternNow();
  const key = await getFinnhubKey(db);
  try { await maybeSnapshot(db, userDoc, key, et); }
  catch (e) { console.error(`Snapshot for ${userDoc.id} failed:`, e.message); }
  try { await maybeRefreshExtended(userDoc, et); }
  catch (e) { console.error(`Extended prices for ${userDoc.id} failed:`, e.message); }
  if (notify) {
    try { await maybeCheckAlerts(db, userDoc, key, et, notify); }
    catch (e) { console.error(`Alerts for ${userDoc.id} failed:`, e.message); }
    try { await maybeEarningsReminder(userDoc, et, notify); }
    catch (e) { console.error(`Earnings reminder for ${userDoc.id} failed:`, e.message); }
  }
}

// Ticker suggestions while typing. US-listed stocks, ETFs and ADRs only.
// `exact` says whether what was typed is itself a real ticker, so the app can
// refuse made-up ones (e.g. a company name typed in the symbol box).
const SEARCH_TYPES = new Set(['Common Stock', 'ETP', 'ADR', 'REIT', 'Closed-End Fund']);
// ── Callable: daily price history for a stock's chart ─────────────────────────
// Yahoo's chart endpoint (keyless, unofficial — same one as extended hours).
// Daily candles only exist for trading days, so weekends and holidays never show.

const HISTORY_RANGES = { '1mo': '1d', '3mo': '1d', '6mo': '1d', '1y': '1d', '5y': '1wk' };

async function priceHistory(db, request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const sym = String(request.data?.symbol || '').trim().toUpperCase();
  const range = String(request.data?.range || '6mo');
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(sym)) throw new HttpsError('invalid-argument', 'Symbol required');
  if (!HISTORY_RANGES[range]) throw new HttpsError('invalid-argument', 'Unknown range');

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${HISTORY_RANGES[range]}&range=${range}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.status === 404) return { points: [] };
  if (!res.ok) throw new HttpsError('unavailable', 'Price history is unavailable right now.');
  const r = (await res.json())?.chart?.result?.[0];
  const ts = r?.timestamp || [];
  const closes = r?.indicators?.quote?.[0]?.close || [];
  const points = [];
  for (let i = 0; i < ts.length; i++) {
    if (!(closes[i] > 0)) continue;
    const date = easternNow(new Date(ts[i] * 1000)).today;
    const value = Math.round(closes[i] * 1e4) / 1e4;
    // The live (unfinished) candle can share a date with the last one; keep the newest
    if (points.length && points[points.length - 1].date === date) points[points.length - 1].value = value;
    else points.push({ date, value });
  }
  return { points };
}

async function searchSymbols(db, request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const q = String(request.data?.query || '').trim().slice(0, 30);
  if (!q) return { results: [], exact: false };
  const key = await getFinnhubKey(db);
  if (!key) throw new HttpsError('failed-precondition', 'Price service is not set up yet (missing Finnhub key).');
  const res = await finnhub(`search?q=${encodeURIComponent(q)}&exchange=US`, key);
  const upper = q.toUpperCase();
  const all = res?.result || [];
  let exact = all.some(r => r.symbol === upper);
  // Search is fuzzy and can miss a real ticker; a live price settles it
  if (!exact && /^[A-Z][A-Z.-]{0,6}$/.test(upper)) exact = !!(await quote(upper, key));
  const results = all
    .filter(r => r.symbol && (!r.type || SEARCH_TYPES.has(r.type)))
    .map(r => ({ symbol: r.symbol, name: r.description || '' }))
    // Exact ticker first, then tickers starting with what was typed
    .sort((a, b) => (b.symbol === upper) - (a.symbol === upper) || b.symbol.startsWith(upper) - a.symbol.startsWith(upper))
    .slice(0, 8);
  return { results, exact };
}

module.exports = { refreshPrices, stockInfo, priceHistory, searchSymbols, runInvestingJobs, BENCHMARK };
