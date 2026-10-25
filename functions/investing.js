const { HttpsError } = require('firebase-functions/v2/https');
const { isMarketDay, closeMinutes } = require('./marketCalendar');

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
// Finnhub first; anything it doesn't price (mutual funds like FXAIX, many
// non-US listings) falls back to Yahoo's daily chart data.
async function quote(symbol, key) {
  let q = null;
  try { q = await finnhub(`quote?symbol=${encodeURIComponent(symbol)}`, key); }
  catch (e) {
    // The free plan answers 403 for symbols it doesn't cover (mutual funds);
    // only the rate limit should stop us — everything else tries Yahoo
    if (e instanceof HttpsError) throw e;
  }
  if (q && q.c > 0) return { price: q.c, prevClose: q.pc || null, priceDate: q.t ? easternNow(new Date(q.t * 1000)).today : null };
  try { return await yahooQuote(symbol); }
  catch (e) { console.warn(`Yahoo quote for ${symbol} failed:`, e.message); return null; }
}

// Latest price, previous close and name from Yahoo (keyless). Mutual funds
// have one price a day (NAV, published in the evening).
const isFund = r => r.meta?.instrumentType === 'MUTUALFUND';

async function yahooQuote(symbol) {
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) return null;
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  if (!r) return null;
  // Daily closes with their dates. Yahoo's quote time can't be trusted for funds:
  // it stamps yesterday's NAV with this morning's time, and once tonight's NAV is
  // out the price updates before today's row gets its close. So compare the price
  // with the last real close: the same → that's the price's day (no move today
  // yet); different → it's a newer price, and that close is its previous close.
  const ts = r.timestamp || [];
  const raw = r.indicators?.quote?.[0]?.close || [];
  const days = ts.map((t, i) => ({ t, c: raw[i] })).filter(x => x.c > 0);
  const last = days[days.length - 1];
  const before = days[days.length - 2];
  const price = r.meta?.regularMarketPrice > 0 ? r.meta.regularMarketPrice : last?.c;
  if (!(price > 0)) return null;
  const round = n => (n ? Math.round(n * 1e4) / 1e4 : null);
  const etDate = t => easternNow(new Date(t * 1000)).today;
  let prevClose, priceDate;
  const qt = r.meta?.regularMarketTime;
  // Same price as the last close, or that close is today's (a stock mid-session)
  if (last && (Math.abs(price - last.c) < 0.00005 || (qt && etDate(qt) === etDate(last.t) && !isFund(r)))) {
    prevClose = before ? before.c : (r.meta?.chartPreviousClose || null);
    priceDate = etDate(last.t);
  } else {
    prevClose = last ? last.c : (r.meta?.chartPreviousClose || null);
    priceDate = qt ? etDate(qt) : null;
    // A newer price can't be from the same day as the close it's compared with
    if (last && priceDate && priceDate <= etDate(last.t)) priceDate = null;
  }
  return { price: round(price), prevClose: round(prevClose), priceDate, name: r.meta?.longName || r.meta?.shortName || null, provider: 'yahoo' };
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
    const { minutes: m, today } = easternNow(when);
    const session = m < 9 * 60 + 30 ? 'pre' : m >= closeMinutes(today) ? 'post' : null;
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
    if (t.type === 'sell') {
      const proceeds = t.quantity * t.price - (t.fee || 0);
      // toCash: false = the money was withdrawn from the account
      if (t.toCash === false) netDeposits -= proceeds;
      else cash += proceeds;
      qty[t.symbol] = (qty[t.symbol] || 0) - t.quantity;
    }
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
    const update = { symbol: sym, source: 'finnhub', price: q.price, prevClose: q.prevClose, priceUpdatedAt: now, priceDate: q.priceDate || null,
      ...(q.provider === 'yahoo' ? { priceProvider: 'yahoo', ...(!existing.name && q.name ? { name: q.name } : {}) } : {}),
      ...(q.provider === 'yahoo' ? {} : await extendedFields(sym, et)) };
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

// ── Analyst price targets and ratings ────────────────────────────────────────
// Three free sources, best first:
//  1. Yahoo quoteSummary (unofficial, keyless): mean/high/low target, analyst
//     count, rating and Buy/Hold/Sell counts. Needs a session cookie + "crumb".
//  2. Finnhub /stock/recommendation (free tier): Buy/Hold/Sell counts only.
//  3. Nasdaq.com analyst endpoint (keyless): consensus target and counts.
//  4. Alpha Vantage OVERVIEW (free key at config/alphavantage { key }, ~25/day):
//     mean target and rating counts — only used when Yahoo gives no target.

let yahooSession = null; // { cookie, crumb, at }

async function getYahooSession() {
  if (yahooSession && Date.now() - yahooSession.at < HOURS(6)) return yahooSession;
  const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' };
  const first = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' });
  const setCookie = typeof first.headers.getSetCookie === 'function' ? first.headers.getSetCookie() : [first.headers.get('set-cookie') || ''];
  const cookie = setCookie.map(c => c.split(';')[0]).filter(Boolean).join('; ');
  if (!cookie) throw new Error('Yahoo cookie missing');
  const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, Cookie: cookie } });
  const crumb = (await res.text()).trim();
  if (!res.ok || !crumb || crumb.includes('<')) throw new Error(`Yahoo crumb ${res.status}`);
  yahooSession = { cookie, crumb, at: Date.now(), UA };
  return yahooSession;
}

const raw = v => (v && typeof v === 'object' ? v.raw ?? null : v ?? null);
const counts = t => (t ? {
  strongBuy: t.strongBuy || 0, buy: t.buy || 0, hold: t.hold || 0, sell: t.sell || 0, strongSell: t.strongSell || 0,
} : null);
const hasCounts = c => c && c.strongBuy + c.buy + c.hold + c.sell + c.strongSell > 0;

async function yahooAnalyst(sym) {
  const s = await getYahooSession();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,recommendationTrend&crumb=${encodeURIComponent(s.crumb)}`;
  const res = await fetch(url, { headers: { ...s.UA, Cookie: s.cookie } });
  if (res.status === 401 || res.status === 403) { yahooSession = null; throw new Error(`Yahoo ${res.status}`); }
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const r = (await res.json())?.quoteSummary?.result?.[0] || {};
  const f = r.financialData || {};
  const trend = (r.recommendationTrend?.trend || []).find(t => t.period === '0m');
  return {
    targetMean: raw(f.targetMeanPrice), targetHigh: raw(f.targetHighPrice), targetLow: raw(f.targetLowPrice),
    analysts: raw(f.numberOfAnalystOpinions), rating: f.recommendationKey && f.recommendationKey !== 'none' ? f.recommendationKey : null,
    counts: counts(trend),
  };
}

async function finnhubCounts(sym, key) {
  const rows = await finnhub(`stock/recommendation?symbol=${encodeURIComponent(sym)}`, key);
  return Array.isArray(rows) && rows.length ? counts(rows[0]) : null;
}

async function alphaVantageAnalyst(sym, avKey) {
  const res = await fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(avKey)}`);
  if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);
  const o = await res.json();
  if (o?.Note || o?.Information) throw new Error((o.Note || o.Information).slice(0, 60)); // rate limit / bad key
  if (!o || !o.Symbol) return null; // unknown symbol
  const n = v => (v && v !== 'None' && v !== '-' ? Number(v) : null);
  return {
    targetMean: n(o.AnalystTargetPrice),
    counts: counts({
      strongBuy: n(o.AnalystRatingStrongBuy), buy: n(o.AnalystRatingBuy), hold: n(o.AnalystRatingHold),
      sell: n(o.AnalystRatingSell), strongSell: n(o.AnalystRatingStrongSell),
    }),
  };
}

// Nasdaq.com's own analyst endpoint (keyless, unofficial): consensus target
// with low/high and Buy/Hold/Sell counts. Wants browser-like headers.
const num = v => {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  const n = Number(String(v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function nasdaqAnalyst(sym) {
  const res = await fetch(`https://api.nasdaq.com/api/analyst/${encodeURIComponent(sym)}/targetprice`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://www.nasdaq.com',
      Referer: 'https://www.nasdaq.com/',
    },
  });
  if (!res.ok) throw new Error(`Nasdaq ${res.status}`);
  const c = (await res.json())?.data?.consensusOverview;
  if (!c) return null;
  const buy = num(c.buy) || 0, hold = num(c.hold) || 0, sell = num(c.sell) || 0;
  return {
    targetMean: num(c.priceTarget), targetHigh: num(c.highPriceTarget), targetLow: num(c.lowPriceTarget),
    counts: buy + hold + sell ? { strongBuy: 0, buy, hold, sell, strongSell: 0 } : null,
  };
}

// Fields for the invAssets doc: { analyst: {...} | null, analystAt }.
// analyst.tried notes what each source did, shown under the section so a
// failing source is visible in the app.
async function fetchAnalyst(db, sym, key) {
  let out = { targetMean: null, targetHigh: null, targetLow: null, analysts: null, rating: null, counts: null, source: null };
  const tried = [];
  const note = (name, e, gotTarget) => tried.push(`${name}: ${e ? e.message || 'failed' : gotTarget ? 'ok' : 'no target'}`);

  try {
    const y = await yahooAnalyst(sym);
    out = { ...out, ...y, source: y.targetMean ? 'Yahoo Finance' : null };
    note('Yahoo', null, !!y.targetMean);
  } catch (e) { note('Yahoo', e); }

  if (!out.targetMean) {
    try {
      const n = await nasdaqAnalyst(sym);
      if (n?.targetMean) Object.assign(out, { targetMean: n.targetMean, targetHigh: n.targetHigh, targetLow: n.targetLow, source: 'Nasdaq' });
      if (n && !hasCounts(out.counts) && hasCounts(n.counts)) out.counts = n.counts;
      note('Nasdaq', null, !!n?.targetMean);
    } catch (e) { note('Nasdaq', e); }
  }

  if (!out.targetMean) {
    const avSnap = await db.doc('config/alphavantage').get();
    const avKey = avSnap.exists ? String(avSnap.data().key || '').trim() : '';
    if (!avKey) tried.push('Alpha Vantage: no key');
    else {
      try {
        const av = await alphaVantageAnalyst(sym, avKey);
        if (av?.targetMean) { out.targetMean = av.targetMean; out.source = 'Alpha Vantage'; }
        if (av && !hasCounts(out.counts) && hasCounts(av.counts)) out.counts = av.counts;
        note('Alpha Vantage', null, !!av?.targetMean);
      } catch (e) { note('Alpha Vantage', e); }
    }
  }

  if (!hasCounts(out.counts) && key) {
    try { out.counts = await finnhubCounts(sym, key); } catch { /* optional */ }
  }
  if (!hasCounts(out.counts)) out.counts = null;
  if (!out.analysts && out.counts) {
    const c = out.counts;
    out.analysts = c.strongBuy + c.buy + c.hold + c.sell + c.strongSell;
  }
  if (!out.targetMean) console.warn(`No analyst target for ${sym}:`, tried.join('; '));
  out.tried = tried;
  const any = out.targetMean || out.counts;
  return { analyst: any ? out : null, analystAt: new Date().toISOString() };
}

// Analyst data is refreshed daily, but retried after 2 hours when the last try found no target
// (results saved before sources were noted in `tried` are retried right away)
const analystStale = a => {
  if (a.analyst && !a.analyst.targetMean && !a.analyst.tried) return true;
  return isStale(a.analystAt, a.analyst?.targetMean ? HOURS(20) : HOURS(2));
};

// ── Callable: details for one stock (stats, past earnings, analysts) ─────────

// ── Company / fund details for the holding screen ───────────────────────────
// Bump to refetch cached docs after adding fields
const METRICS_V = 2;
const ABOUT_V = 4;

// Today's open / high / low / volume and the 30-day average volume, from
// Yahoo's chart endpoint (keyless; also works for ETFs and funds)
async function yahooDayStats(sym) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return null;
  const r = (await res.json())?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0] || {};
  const n = (r?.timestamp || []).length;
  if (!n) return null;
  const last = n - 1;
  const vols = (q.volume || []).slice(-31, -1).filter(v => v > 0);
  return {
    open: q.open?.[last] ?? null,
    high: q.high?.[last] ?? r.meta?.regularMarketDayHigh ?? null,
    low: q.low?.[last] ?? r.meta?.regularMarketDayLow ?? null,
    volume: q.volume?.[last] ?? r.meta?.regularMarketVolume ?? null,
    avgVolume: vols.length ? Math.round(vols.reduce((a, b) => a + b, 0) / vols.length) : null,
  };
}

// Yahoo quoteSummary: business summary, employees, HQ, CEO; for funds also the
// expense ratio, net assets, fund family and category
async function yahooAbout(sym) {
  const s = await getYahooSession();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=assetProfile,summaryProfile,fundProfile,summaryDetail,defaultKeyStatistics,price,topHoldings,fundPerformance&crumb=${encodeURIComponent(s.crumb)}`;
  const res = await fetch(url, { headers: { ...s.UA, Cookie: s.cookie } });
  if (res.status === 401 || res.status === 403) { yahooSession = null; throw new Error(`Yahoo ${res.status}`); }
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const r = (await res.json())?.quoteSummary?.result?.[0] || {};
  const a = r.assetProfile || r.summaryProfile || {};
  const f = r.fundProfile || {};
  const k = r.defaultKeyStatistics || {};
  const d = r.summaryDetail || {};
  const ceo = (a.companyOfficers || []).find(o => /chief executive|ceo/i.test(o.title || ''));
  const inception = raw(k.fundInceptionDate);
  return {
    description: a.longBusinessSummary || null,
    employees: a.fullTimeEmployees ?? null,
    hq: [a.city, a.state || a.country].filter(Boolean).join(', ') || null,
    ceo: ceo?.name || null,
    sector: a.sector || null,
    industry: a.industry || null,
    website: a.website || null,
    fundFamily: f.family || null,
    category: f.categoryName || null,
    expenseRatio: raw(f.feesExpensesInvestment?.annualReportExpenseRatio) ?? raw(k.annualReportExpenseRatio) ?? null, // fraction
    netAssets: raw(d.totalAssets) ?? raw(k.totalAssets) ?? null,
    fundInception: inception ? new Date(inception * 1000).getUTCFullYear() : null,
    forwardPE: raw(d.forwardPE) ?? raw(k.forwardPE) ?? null,
    sharesOutstanding: raw(k.sharesOutstanding) ?? null,
    shortPercentFloat: raw(k.shortPercentOfFloat) ?? null, // fraction
    fund: fundDetails(r),
  };
}

// What's inside an ETF or mutual fund (null for stocks): top holdings, sector and
// asset mix, yield and returns. Percentages are fractions (0.07 = 7%).
const SECTOR_NAMES = {
  realestate: 'Real estate', consumer_cyclical: 'Consumer cyclical', basic_materials: 'Basic materials',
  consumer_defensive: 'Consumer defensive', technology: 'Technology', communication_services: 'Communication',
  financial_services: 'Financials', utilities: 'Utilities', industrials: 'Industrials', energy: 'Energy', healthcare: 'Healthcare',
};
function fundDetails(r) {
  const type = r.price?.quoteType;
  const t = r.topHoldings;
  if (!t && type !== 'ETF' && type !== 'MUTUALFUND') return null;
  const k = r.defaultKeyStatistics || {};
  const d = r.summaryDetail || {};
  const fees = r.fundProfile?.feesExpensesInvestment || {};
  const perf = r.fundPerformance?.trailingReturns || {};
  const holdings = (t?.holdings || []).map(h => ({ symbol: h.symbol || null, name: h.holdingName || h.symbol || '', pct: raw(h.holdingPercent) }))
    .filter(h => h.name && h.pct > 0).slice(0, 10);
  const sectors = (t?.sectorWeightings || []).map(o => { const [key, v] = Object.entries(o)[0] || []; return { name: SECTOR_NAMES[key] || key, pct: raw(v) }; })
    .filter(x => x.name && x.pct > 0.0005).sort((a, b) => b.pct - a.pct);
  const mix = [['Stocks', raw(t?.stockPosition)], ['Bonds', raw(t?.bondPosition)], ['Cash', raw(t?.cashPosition)], ['Other', raw(t?.otherPosition)]]
    .map(([name, pct]) => ({ name, pct })).filter(x => x.pct > 0.0005);
  const eq = t?.equityHoldings || {};
  return {
    holdings, sectors, mix,
    topTenPct: holdings.length ? holdings.reduce((a, h) => a + h.pct, 0) : null,
    yield: raw(d.yield) ?? raw(d.trailingAnnualDividendYield) ?? null,
    ytdReturn: raw(k.ytdReturn) ?? raw(perf.ytd) ?? null,
    return1y: raw(perf.oneYear) ?? null,
    return3y: raw(k.threeYearAverageReturn) ?? raw(perf.threeYear) ?? null,
    return5y: raw(k.fiveYearAverageReturn) ?? raw(perf.fiveYear) ?? null,
    turnover: raw(fees.annualHoldingsTurnover) ?? null,
    beta3y: raw(k.beta3Year) ?? null,
    pe: raw(eq.priceToEarnings) ?? null,
    legalType: k.legalType || null,
  };
}

// Wikidata (by ticker on a US exchange) for the founding year, and its English
// Wikipedia intro as a fallback description. Funds often aren't linked by
// ticker, so with no match the fund's name is searched on Wikipedia instead.
const WIKI_UA = { 'User-Agent': 'MomentumApp/1.0 (personal finance app)' };
const US_EXCHANGE = /nyse|new york stock exchange|nasdaq|cboe|bats|american stock exchange|iex/i;

async function wikiSummary(title) {
  const w = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: WIKI_UA });
  return w.ok ? (await w.json())?.extract || null : null;
}

async function wikiByName(name) {
  const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(name)}`, { headers: WIKI_UA });
  if (!res.ok) return null;
  const title = (await res.json())?.query?.search?.[0]?.title;
  if (!title) return null;
  // The page must be about this fund, not its issuer: its title shares a word of
  // the name beyond the issuer and the generic ones ("Gold" in SPDR Gold Shares)
  const GENERIC = /^(etf|fund|funds|trust|shares|share|index|the|of|and|&|inc|ishares|spdr|vanguard|vaneck|invesco|schwab|fidelity|ark|global|x|proshares|direxion|wisdomtree|first|portfolio)$/i;
  const words = name.split(/[\s,.-]+/).slice(1).filter(w => w.length > 1 && !GENERIC.test(w)).map(w => w.toLowerCase());
  if (words.length && !words.some(w => title.toLowerCase().includes(w))) return null;
  const extract = await wikiSummary(title);
  // Only a page that is actually about a fund
  if (!extract || !/exchange[- ]traded|\bETF\b|\bfund\b|\btrust\b/i.test(extract)) return null;
  return { description: extract, wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` };
}

async function wikiAbout(sym, name) {
  if (!/^[A-Z0-9.\-]{1,10}$/.test(sym)) return null;
  const q = `SELECT ?item ?exLabel ?inception ?emp ?ceoLabel ?hqLabel ?article WHERE {
    ?item p:P414 ?st . ?st pq:P249 "${sym}" . ?st ps:P414 ?ex .
    OPTIONAL { ?item wdt:P571 ?inception } OPTIONAL { ?item wdt:P1128 ?emp }
    OPTIONAL { ?item wdt:P169 ?ceo } OPTIONAL { ?item wdt:P159 ?hq }
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 30`;
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(q)}`, { headers: { ...WIKI_UA, Accept: 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const all = (await res.json())?.results?.bindings || [];
  // The same ticker can exist abroad: keep the US listing's company
  const usItem = all.find(r => US_EXCHANGE.test(r.exLabel?.value || ''))?.item?.value;
  const rows = usItem ? all.filter(r => r.item?.value === usItem) : [];
  if (!rows.length) return name ? wikiByName(name) : null;
  const val = k => rows.map(r => r[k]?.value).find(v => v && !/^Q\d+$/.test(v)) || null; // skip unlabeled items
  const years = rows.map(r => r.inception?.value).filter(Boolean).map(v => parseInt(v.replace(/^\+/, '').slice(0, 4), 10)).filter(y => y > 1600);
  const emps = rows.map(r => Number(r.emp?.value)).filter(n => n > 0);
  const out = {
    founded: years.length ? Math.min(...years) : null,
    employees: emps.length ? Math.max(...emps) : null,
    ceo: val('ceoLabel'),
    hq: val('hqLabel'),
    description: null,
    wikiUrl: val('article'),
  };
  if (out.wikiUrl) {
    try { out.description = await wikiSummary(decodeURIComponent(out.wikiUrl.split('/wiki/')[1])); } catch { /* optional */ }
  }
  if (!out.description && name) Object.assign(out, (await wikiByName(name).catch(() => null)) || {});
  return out;
}

// Name and kind (EQUITY / ETF / MUTUALFUND) from Yahoo's keyless chart endpoint
async function chartMeta(sym) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const m = res.ok ? (await res.json())?.chart?.result?.[0]?.meta : null;
  return m ? { type: m.instrumentType || null, name: m.longName || m.shortName || null } : null;
}

// Alpha Vantage (free key at config/alphavantage, ~25 calls a day; cached weekly):
// ETF_PROFILE for funds (holdings, sectors, expense ratio…), OVERVIEW for stocks.
// Used because Yahoo's detailed data refuses the server (429).
async function getAvKey(db) {
  const snap = await db.doc('config/alphavantage').get();
  return snap.exists ? String(snap.data().key || '').trim() : '';
}
const titleCase = s => String(s || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bAnd\b/g, 'and');
async function alphaVantage(fn, sym, avKey, retried = false) {
  const res = await fetch(`https://www.alphavantage.co/query?function=${fn}&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(avKey)}`);
  if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);
  const o = await res.json();
  const note = o?.Note || o?.Information || o?.['Error Message'];
  // One request a second on the free plan: wait and try once more
  if (note && /second/i.test(note) && !retried) { await new Promise(r => setTimeout(r, 1500)); return alphaVantage(fn, sym, avKey, true); }
  if (note) throw new Error(`Alpha Vantage: ${String(note).slice(0, 80)}`);
  return o;
}
const avNum = v => (v === undefined || v === null || v === '' || v === 'None' || v === 'n/a' || v === '-' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function avFund(sym, avKey) {
  const o = await alphaVantage('ETF_PROFILE', sym, avKey);
  if (!o || (!o.holdings && !o.net_assets)) return null;
  const holdings = (o.holdings || []).map(h => ({ symbol: h.symbol && h.symbol !== 'n/a' ? h.symbol : null, name: titleCase(h.description || h.symbol || ''), pct: avNum(h.weight) }))
    .filter(h => h.name && h.pct > 0).slice(0, 10);
  const sectors = (o.sectors || []).map(x => ({ name: titleCase(x.sector), pct: avNum(x.weight) })).filter(x => x.name && x.pct > 0.0005).sort((a, b) => b.pct - a.pct);
  const year = parseInt(String(o.inception_date || '').slice(0, 4), 10);
  return {
    expenseRatio: avNum(o.net_expense_ratio),
    netAssets: avNum(o.net_assets),
    fundInception: year > 1900 ? year : null,
    fund: {
      holdings, sectors, mix: [],
      topTenPct: holdings.length ? holdings.reduce((a, h) => a + h.pct, 0) : null,
      yield: avNum(o.dividend_yield), turnover: avNum(o.portfolio_turnover),
      ytdReturn: null, return1y: null, return3y: null, return5y: null, beta3y: null, pe: null,
      legalType: o.leveraged === 'YES' ? 'Leveraged ETF' : null,
    },
  };
}

async function avCompany(sym, avKey) {
  const o = await alphaVantage('OVERVIEW', sym, avKey);
  if (!o?.Symbol) return null;
  return {
    description: o.Description && o.Description !== 'None' ? o.Description : null,
    sector: o.Sector && o.Sector !== 'None' ? titleCase(o.Sector) : null,
    industry: o.Industry && o.Industry !== 'None' ? titleCase(o.Industry) : null,
    hq: o.Address && o.Address !== 'None' ? titleCase(o.Address.split(',').slice(-3, -1).join(',').trim()) || null : null,
    website: /^https?:\/\//.test(o.OfficialSite || '') ? o.OfficialSite : null,
    forwardPE: avNum(o.ForwardPE),
    sharesOutstanding: avNum(o.SharesOutstanding),
  };
}

async function fetchAbout(db, sym) {
  const meta = await chartMeta(sym).catch(() => null);
  const isFund = meta?.type === 'ETF' || meta?.type === 'MUTUALFUND';
  const avKey = await getAvKey(db).catch(() => '');
  const [y, w] = await Promise.all([yahooAbout(sym).catch(() => null), wikiAbout(sym, isFund ? meta?.name : null).catch(() => null)]);
  // Yahoo usually refuses the server; Alpha Vantage fills in what it can
  let av = null;
  if (!y && avKey) av = await (isFund ? avFund(sym, avKey) : avCompany(sym, avKey)).catch(() => null);
  if (!y && !w && !av) throw new Error('No company details');
  const pick = (...v) => v.find(x => x !== null && x !== undefined && x !== '') ?? null;
  let fund = y?.fund || av?.fund || (isFund ? { holdings: [], sectors: [], mix: [] } : null);
  if (fund) {
    fund = { ...fund, legalType: fund.legalType || (meta?.type === 'MUTUALFUND' ? 'Mutual fund' : isFund ? 'Exchange traded fund' : null) };
    // A sector list that covers under half the fund would mislead
    if (fund.sectors?.reduce((a, x) => a + x.pct, 0) < 0.5) fund.sectors = [];
  }
  let description = pick(y?.description, w?.description, av?.description);
  let source = !description ? null : description === y?.description ? 'Yahoo Finance' : description === w?.description ? 'Wikipedia' : 'Alpha Vantage';
  // No write-up anywhere: a short one from the fund's own data
  if (!description && isFund && meta?.name) {
    const year = pick(y?.fundInception, av?.fundInception, w?.founded);
    const top = (fund?.holdings || []).slice(0, 3).map(h => h.name.replace(/\s+(Corp|Corporation|Inc|Ltd|Plc|Co|Adr|Class [A-C])\.?$/gi, '').trim());
    description = `${meta.name} is ${meta.type === 'MUTUALFUND' ? 'a mutual fund' : 'an exchange-traded fund'}${year ? ` launched in ${year}` : ''}.`
      + (top.length ? ` Its largest holdings are ${top.length > 1 ? `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}` : top[0]}.` : '');
    source = 'fund data';
  }
  return {
    description,
    descriptionSource: source,
    founded: pick(w?.founded, y?.fundInception, av?.fundInception),
    employees: isFund ? null : pick(y?.employees, w?.employees),
    ceo: isFund ? null : pick(y?.ceo, w?.ceo),
    hq: isFund ? null : pick(y?.hq, w?.hq, av?.hq),
    sector: pick(y?.sector, av?.sector),
    industry: pick(y?.industry, av?.industry),
    website: pick(y?.website, av?.website),
    wikiUrl: pick(w?.wikiUrl),
    fundFamily: pick(y?.fundFamily),
    category: pick(y?.category),
    expenseRatio: pick(y?.expenseRatio, av?.expenseRatio),
    netAssets: pick(y?.netAssets, av?.netAssets),
    forwardPE: pick(y?.forwardPE, av?.forwardPE),
    sharesOutstanding: pick(y?.sharesOutstanding, av?.sharesOutstanding),
    shortPercentFloat: pick(y?.shortPercentFloat),
    fund,
    name: meta?.name || null,
    partial: !y && !av,
  };
}

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
  if (isStale(cached.metricsAt, HOURS(20)) || cached.metricsV !== METRICS_V) {
    try {
      const m = (await finnhub(`stock/metric?symbol=${encodeURIComponent(sym)}&metric=all`, key))?.metric || {};
      update.metrics = {
        high52: m['52WeekHigh'] ?? null,
        low52: m['52WeekLow'] ?? null,
        pe: m.peTTM ?? m.peBasicExclExtraTTM ?? null,
        marketCap: m.marketCapitalization ?? null, // millions of USD
        dividendYield: m.currentDividendYieldTTM ?? m.dividendYieldIndicatedAnnual ?? null, // percent
        beta: m.beta ?? null,
        eps: m.epsTTM ?? m.epsBasicExclExtraItemsTTM ?? null,
        pb: m.pbQuarterly ?? m.pbAnnual ?? null,
        ps: m.psTTM ?? m.psAnnual ?? null,
        dividendPerShare: m.dividendPerShareTTM ?? m.dividendPerShareAnnual ?? null,
        revenueGrowth: m.revenueGrowthTTMYoy ?? null, // percent
        netMargin: m.netProfitMarginTTM ?? null,      // percent
        roe: m.roeTTM ?? null,                        // percent
        avgVolume10d: m['10DayAverageTradingVolume'] ?? null, // millions of shares
        return52w: m['52WeekPriceReturnDaily'] ?? null,       // percent
      };
      update.metricsV = METRICS_V;
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
  if (analystStale(cached)) {
    try { Object.assign(update, await fetchAnalyst(db, sym, key)); } catch { /* optional */ }
  }
  // Weekly; a day when only part of it came through (Yahoo was down)
  if (isStale(cached.aboutAt, HOURS(cached.about?.partial ? 24 : 24 * 7)) || cached.aboutV !== ABOUT_V) {
    try { update.about = await fetchAbout(db, sym); update.aboutAt = new Date().toISOString(); update.aboutV = ABOUT_V; }
    catch { /* optional */ }
  }
  if (Object.keys(update).length) await ref.set({ symbol: sym, ...update }, { merge: true });
  if (eventsStale({ ...cached, ...update })) {
    try { await refreshAutoEvents(ref, sym, key); } catch { /* optional */ }
  }
  let day = null;
  try { day = await yahooDayStats(sym); } catch { /* optional */ }

  const merged = { ...cached, ...update };
  return {
    metrics: merged.metrics || null,
    earningsHistory: merged.earningsHistory || [],
    nextEarnings: merged.nextEarnings || null,
    analyst: merged.analyst || null,
    profile: { name: merged.name || null, industry: merged.industry || null, logo: merged.logo || null, weburl: merged.weburl || null },
    about: merged.about || null,
    day,
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

// Market day 9:30–16:00 ET (13:00 on early-close days)
const isRegularSession = et => et.weekday && et.minutes >= 9 * 60 + 30 && et.minutes < closeMinutes(et.today);
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
        { price: q.price, prevClose: q.prevClose, priceUpdatedAt: now, priceDate: q.priceDate || null }, { merge: true });
    }
  }

  let spy = null;
  if (key) {
    try {
      const q = await quote(BENCHMARK, key);
      if (q) {
        spy = q.price;
        await userRef.collection('invAssets').doc(BENCHMARK).set(
          { symbol: BENCHMARK, source: 'finnhub', price: q.price, prevClose: q.prevClose, priceUpdatedAt: new Date().toISOString(), priceDate: q.priceDate || null }, { merge: true });
      }
    } catch { /* benchmark is optional */ }

    // Analyst targets for holdings and the watchlist, once a day (they show in the lists)
    const followed = assets.filter(x => x.source === 'finnhub' && (held.includes(x.symbol) || x.watch) && analystStale(x));
    for (const a of followed.slice(0, 25)) {
      try { await userRef.collection('invAssets').doc(a.symbol).set(await fetchAnalyst(db, a.symbol, key), { merge: true }); }
      catch { /* optional */ }
    }

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

// Price alerts, 4:00–20:00 ET on market days. The regular session (checked every
// 5 minutes) uses Finnhub; pre-market and after hours (every 15) the extended price.
async function maybeCheckAlerts(db, userDoc, key, et, notify) {
  if (!isTradingDay(et)) return;
  const regular = isRegularSession(et);
  // Every run (5 min) while the market is open; every 15 min before and after
  if (!regular && et.minutes % 15 >= 5) return;
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

// ── Automatic calendar events (earnings, dividends, splits) ─────────────────
// Kept on each invAssets doc as autoEvents [{ id, date, label, kind, note? }],
// shown in yellow on the stock's calendar beside your own (green) dates.
//  - Yahoo chart (keyless): past dividends (ex-dates, amount) and splits, 2 years
//  - Yahoo quoteSummary calendarEvents: next earnings, ex-dividend and pay dates
//  - Finnhub earnings calendar: past and upcoming report dates with EPS
const EVENTS_V = 1;
const fmtEps = v => (v == null ? '—' : `$${Number(v).toFixed(2)}`);
const etDate = ts => easternNow(new Date(ts * 1000)).today;

async function fetchAutoEvents(sym, key) {
  const out = [];
  const add = (date, kind, label, note) => {
    if (!date) return;
    out.push({ id: `auto-${kind}-${date}-${label.length}`, date, kind, label, ...(note ? { note } : {}) });
  };

  // Past dividends and splits
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2y&events=div%2Csplit`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const ev = res.ok ? (await res.json())?.chart?.result?.[0]?.events || {} : {};
    for (const d of Object.values(ev.dividends || {})) add(etDate(d.date), 'dividend', `Ex-dividend · $${Number(d.amount).toFixed(d.amount < 0.1 ? 4 : 2)}/share`);
    for (const sp of Object.values(ev.splits || {})) add(etDate(sp.date), 'other', `Stock split ${sp.numerator}-for-${sp.denominator}`);
  } catch { /* optional */ }

  // Coming up: earnings, ex-dividend and payment dates
  let yahooEarnings = [];
  try {
    const s = await getYahooSession();
    const res = await fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=calendarEvents&crumb=${encodeURIComponent(s.crumb)}`,
      { headers: { ...s.UA, Cookie: s.cookie } });
    if (res.status === 401 || res.status === 403) yahooSession = null;
    const c = res.ok ? (await res.json())?.quoteSummary?.result?.[0]?.calendarEvents || {} : {};
    const e = c.earnings || {};
    const dates = (e.earningsDate || []).map(raw).filter(Boolean);
    if (dates.length) {
      const est = e.isEarningsDateEstimate || dates.length > 1;
      yahooEarnings = [{ date: etDate(dates[0]), est, epsEstimate: raw(e.earningsAverage) }];
    }
    const ex = raw(c.exDividendDate), pay = raw(c.dividendDate);
    if (ex) add(etDate(ex), 'dividend', 'Ex-dividend date');
    if (pay) add(etDate(pay), 'dividend', 'Dividend paid');
  } catch { /* optional */ }

  // Report dates with results (about a year back) and the next ones
  let finnhubEarnings = [];
  if (key) {
    try {
      const from = ymd(new Date(Date.now() - 400 * 864e5)), to = ymd(new Date(Date.now() + 120 * 864e5));
      const res = await finnhub(`calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(sym)}`, key);
      finnhubEarnings = (res?.earningsCalendar || []).filter(e => e.symbol === sym && e.date);
    } catch { /* optional */ }
  }
  const HOUR = { bmo: 'before the open', amc: 'after the close', dmh: 'during market hours' };
  const near = (a, b) => Math.abs(new Date(a) - new Date(b)) <= 6 * 864e5;
  for (const e of finnhubEarnings) {
    const bits = [HOUR[e.hour]];
    if (e.epsActual != null) bits.push(`EPS ${fmtEps(e.epsActual)} vs ${fmtEps(e.epsEstimate)} est.`);
    else if (e.epsEstimate != null) bits.push(`est. EPS ${fmtEps(e.epsEstimate)}`);
    add(e.date, 'earnings', 'Earnings report', bits.filter(Boolean).join(' · '));
  }
  for (const y of yahooEarnings) {
    if (finnhubEarnings.some(e => near(e.date, y.date))) continue;
    add(y.date, 'earnings', y.est ? 'Earnings report (expected)' : 'Earnings report', y.epsEstimate != null ? `est. EPS ${fmtEps(y.epsEstimate)}` : null);
  }

  // One per day and kind (the same ex-date can come from two places)
  const seen = new Set();
  const cutoff = ymd(new Date(Date.now() - 2 * 365 * 864e5));
  return out
    .filter(e => e.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date) || b.label.length - a.label.length)
    .filter(e => { const k = `${e.date}|${e.kind}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

async function refreshAutoEvents(ref, sym, key) {
  const autoEvents = await fetchAutoEvents(sym, key);
  const update = { autoEvents, autoEventsAt: new Date().toISOString(), autoEventsV: EVENTS_V };
  await ref.set(update, { merge: true });
  return update;
}
const eventsStale = a => isStale(a.autoEventsAt, HOURS(20)) || a.autoEventsV !== EVENTS_V;

// A few stale stocks per run (the job runs every 5 minutes), so every stock in
// the portfolio and watch lists is refreshed about once a day
async function maybeRefreshEvents(userDoc, key) {
  const docs = (await userDoc.ref.collection('invAssets').where('source', '==', 'finnhub').get()).docs
    .filter(d => { const a = d.data(); return !(a.benchmark && !a.watch) && eventsStale(a); })
    .slice(0, 3);
  for (const d of docs) await refreshAutoEvents(d.ref, d.id, key);
}

// ── Market-wide dates: Fed rate decisions, CPI and the jobs report ──────────
// Read from the Fed's FOMC calendar and the BLS release schedules (both public
// pages), cached in config/marketEvents for 3 days. They move the whole market,
// rates and gold, so every holding's calendar shows them.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const pad2 = n => String(n).padStart(2, '0');
const PAGE_UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', Accept: 'text/html' };

async function fomcDates() {
  const html = await (await fetch('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', { headers: PAGE_UA })).text();
  const out = [];
  const heads = [...html.matchAll(/(\d{4}) FOMC Meetings/g)];
  heads.forEach((h, k) => {
    const year = Number(h[1]);
    const part = html.slice(h.index, heads[k + 1]?.index ?? h.index + 60000);
    for (const m of part.matchAll(/fomc-meeting__month[^>]*><strong>([^<]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g)) {
      // "April/May" + "30-1": the decision is on the last day, in the last month
      const months = m[1].trim().toLowerCase().split('/');
      const days = m[2].replace(/[^\d-]/g, '').split('-').filter(Boolean);
      const month = MONTHS[months[months.length - 1]];
      const day = Number(days[days.length - 1]);
      if (!month || !day) continue;
      const projections = m[2].includes('*');
      out.push({ date: `${year}-${pad2(month)}-${pad2(day)}`, kind: 'market', label: 'Fed rate decision', note: `2:00 PM ET${projections ? ' · with new economic projections' : ''}` });
    }
  });
  return out;
}

async function blsDates(page, label) {
  const html = await (await fetch(`https://www.bls.gov/schedule/news_release/${page}.htm`, { headers: PAGE_UA })).text();
  const out = [];
  for (const m of html.matchAll(/<td>([A-Z][a-z]+\.? \d{1,2}, \d{4})<\/td>\s*<td>([^<]+)<\/td>/g)) {
    const [, mon, day, year] = m[1].match(/([A-Za-z]+)\.? (\d{1,2}), (\d{4})/) || [];
    const month = MONTHS[(mon || '').toLowerCase()];
    if (month) out.push({ date: `${year}-${pad2(month)}-${pad2(Number(day))}`, kind: 'market', label, note: `${m[2].trim().replace(/^0/, '')} ET` });
  }
  return out;
}

async function marketEvents(db, request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const ref = db.doc('config/marketEvents');
  const cached = (await ref.get()).data();
  if (cached?.events && !isStale(cached.at, HOURS(72))) return { events: cached.events };
  const parts = await Promise.all([
    fomcDates().catch(() => []),
    blsDates('cpi', 'CPI inflation report').catch(() => []),
    blsDates('empsit', 'Jobs report').catch(() => []),
  ]);
  const from = ymd(new Date(Date.now() - 400 * 864e5));
  const events = parts.flat().filter(e => e.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  if (!events.length) return { events: cached?.events || [] };
  await ref.set({ events, at: new Date().toISOString() });
  return { events };
}

// ── Reminders for single events (the bell on a calendar date) ───────────────
// 9 AM, your time, on the business day before (picked when you tap the bell)
function zonedToday(tz) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz || 'America/New_York' }));
  return { today: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`, minutes: now.getHours() * 60 + now.getMinutes() };
}

async function maybeSendEventAlerts(userDoc, notify) {
  const snap = await userDoc.ref.collection('invEventAlerts').where('sentAt', '==', null).get();
  for (const d of snap.docs) {
    const a = d.data();
    const { today, minutes } = zonedToday(a.timezone);
    const [h, m] = String(a.time || '09:00').split(':').map(Number);
    if (a.date < today) { await d.ref.update({ sentAt: 'expired' }); continue; } // the event has passed
    if (today < a.notifyOn || minutes < h * 60 + m) continue;
    await d.ref.update({ sentAt: new Date().toISOString() });
    const when = new Date(a.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
    await notify(`📅 ${a.symbol ? `${a.symbol}: ` : ''}${a.label}`, `${a.date === today ? 'Today' : when}${a.note ? ` · ${a.note}` : ''}`);
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
  try { await maybeRefreshEvents(userDoc, key); }
  catch (e) { console.error(`Calendar events for ${userDoc.id} failed:`, e.message); }
  if (notify) {
    try { await maybeCheckAlerts(db, userDoc, key, et, notify); }
    catch (e) { console.error(`Alerts for ${userDoc.id} failed:`, e.message); }
    try { await maybeSendEventAlerts(userDoc, notify); }
    catch (e) { console.error(`Event reminders for ${userDoc.id} failed:`, e.message); }
    try { await maybeEarningsReminder(userDoc, et, notify); }
    catch (e) { console.error(`Earnings reminder for ${userDoc.id} failed:`, e.message); }
  }
}

// Ticker suggestions while typing. US-listed stocks, ETFs and ADRs only.
// `exact` says whether what was typed is itself a real ticker, so the app can
// refuse made-up ones (e.g. a company name typed in the symbol box).
const SEARCH_TYPES = new Set(['Common Stock', 'ETP', 'ADR', 'REIT', 'Closed-End Fund', 'Mutual Fund', 'Open-End Fund', 'Money Market Fund']);
// ── Callable: daily price history for a stock's chart ─────────────────────────
// Yahoo's chart endpoint (keyless, unofficial — same one as extended hours).
// Daily candles only exist for trading days, so weekends and holidays never show.

// range → interval; the d* ranges are daily over a longer span (used to rebuild
// the portfolio's value day by day from your transactions)
const HISTORY_RANGES = {
  '1mo': '1d', '3mo': '1d', '6mo': '1d', '1y': '1d', '5y': '1wk', '10y': '1wk', max: '1mo',
  d2y: ['2y', '1d'], d5y: ['5y', '1d'],
  // Intraday (with pre/after-hours, like Robinhood): today in 5-minute steps,
  // the last 5 sessions in 15-minute steps, the last month hourly
  i1d: ['1d', '5m'], i5d: ['5d', '15m'], i1m: ['1mo', '60m'],
};

// Pre-market and after-hours trades are thin, and a single odd trade (a few
// shares far from the market) shows up as a needle on the chart. Robinhood
// filters these; drop an extended-hours point that jumps away from both
// neighbours by over 1% while they stay close to each other.
function dropSpikes(points) {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      if (!p.ext) continue;
      const prev = points[i - 1]?.value, next = points[i + 1]?.value;
      const ref = prev && next ? (prev + next) / 2 : prev || next;
      if (!ref) continue;
      const jump = Math.abs(p.value - ref) / ref;
      const calm = prev && next ? Math.abs(prev - next) / ref < jump / 3 : true;
      if (jump > 0.01 && calm) { points.splice(i, 1); continue; }
      // Two odd trades in a row: both away from the prices around them, which agree
      const q = points[i - 1], before = points[i - 2]?.value;
      if (q?.ext && before && next) {
        const base = (before + next) / 2;
        const away = v => (v - base) / base;
        if (Math.abs(before - next) / base < 0.004 && Math.abs(away(p.value)) > 0.01 && Math.abs(away(q.value)) > 0.01
          && Math.sign(away(p.value)) === Math.sign(away(q.value))) { points.splice(i - 1, 2); i--; }
      }
    }
  }
}

async function priceHistory(db, request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const sym = String(request.data?.symbol || '').trim().toUpperCase();
  const range = String(request.data?.range || '6mo');
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(sym)) throw new HttpsError('invalid-argument', 'Symbol required');
  if (!HISTORY_RANGES[range]) throw new HttpsError('invalid-argument', 'Unknown range');

  const spec = HISTORY_RANGES[range];
  const [yRange, interval] = Array.isArray(spec) ? spec : [range, spec];
  const intraday = range.startsWith('i');
  const prePost = range === 'i1d' || range === 'i5d';
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${yRange}${prePost ? '&includePrePost=true' : ''}`,
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
    if (intraday) {
      // Every step is its own point, labeled with its time (Eastern)
      const when = new Date(ts[i] * 1000);
      const time = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
      const day = when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
      const { minutes: m } = easternNow(when);
      const ext = m < 9 * 60 + 30 || m >= closeMinutes(date);
      points.push({ date, t: ts[i], value, label: range === 'i1d' ? `${time} ET` : `${day}, ${time}`, ...(ext ? { ext: true } : {}) });
      continue;
    }
    // The live (unfinished) candle can share a date with the last one; keep the newest
    if (points.length && points[points.length - 1].date === date) points[points.length - 1].value = value;
    else points.push({ date, value });
  }
  if (prePost) dropSpikes(points);
  // 1D starts from yesterday's official close (4 PM), so the change matches the
  // day's move. The chart's own "previous close" can be the last after-hours
  // trade, so take it from the daily candles: the last one before today.
  let prevClose = null;
  if (range === 'i1d' && points.length) {
    try {
      const dres = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=10d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const dr = dres.ok ? (await dres.json())?.chart?.result?.[0] : null;
      const dts = dr?.timestamp || [], dcl = dr?.indicators?.quote?.[0]?.close || [];
      for (let i = dts.length - 1; i >= 0; i--) {
        if (dcl[i] > 0 && easternNow(new Date(dts[i] * 1000)).today < points[0].date) { prevClose = dcl[i]; break; }
      }
    } catch { /* fall back below */ }
    if (!prevClose) prevClose = r?.meta?.previousClose ?? r?.meta?.chartPreviousClose;
  }
  if (range === 'i1d' && points.length && prevClose > 0) {
    points.unshift({ date: points[0].date, t: points[0].t - 1, value: Math.round(prevClose * 1e4) / 1e4, label: 'Previous close', prev: true });
  }
  return { points };
}

// Yahoo's search (keyless): finds mutual funds and funds by name, which
// Finnhub's free search often misses. Best effort.
const YAHOO_TYPES = new Set(['EQUITY', 'ETF', 'MUTUALFUND', 'MONEYMARKET']);
async function yahooSearch(q) {
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    return ((await res.json())?.quotes || [])
      .filter(r => r.symbol && YAHOO_TYPES.has(r.quoteType) && !r.symbol.includes('.')) // US listings only
      .map(r => ({ symbol: r.symbol.toUpperCase(), name: r.longname || r.shortname || '', fund: r.quoteType === 'MUTUALFUND' }));
  } catch { return []; }
}

async function searchSymbols(db, request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const q = String(request.data?.query || '').trim().slice(0, 30);
  if (!q) return { results: [], exact: false };
  const key = await getFinnhubKey(db);
  if (!key) throw new HttpsError('failed-precondition', 'Price service is not set up yet (missing Finnhub key).');
  const upper = q.toUpperCase();
  const [fh, yh] = await Promise.all([
    finnhub(`search?q=${encodeURIComponent(q)}&exchange=US`, key).catch(() => null),
    yahooSearch(q),
  ]);
  const fromFinnhub = (fh?.result || [])
    .filter(r => r.symbol && (!r.type || SEARCH_TYPES.has(r.type) || r.symbol === upper))
    .map(r => ({ symbol: r.symbol, name: r.description || '' }));

  // Merge, Finnhub first; Yahoo adds what Finnhub missed (funds above all)
  const seen = new Set();
  const merged = [...fromFinnhub, ...yh].filter(r => !seen.has(r.symbol) && seen.add(r.symbol));

  // Listed by either search → real. Otherwise a live price settles it.
  let exact = merged.some(r => r.symbol === upper);
  let found = null;
  if (!exact && /^[A-Z][A-Z0-9.-]{0,6}$/.test(upper)) {
    found = await quote(upper, key).catch(() => null);
    exact = !!found;
  }
  if (found && !merged.some(r => r.symbol === upper)) merged.unshift({ symbol: upper, name: found.name || '' });

  const results = merged
    // Exact ticker first, then tickers starting with what was typed
    .sort((a, b) => (b.symbol === upper) - (a.symbol === upper) || b.symbol.startsWith(upper) - a.symbol.startsWith(upper))
    .slice(0, 8)
    .map(({ symbol, name }) => ({ symbol, name }));
  return { results, exact };
}

module.exports = { refreshPrices, stockInfo, priceHistory, searchSymbols, marketEvents, runInvestingJobs, BENCHMARK };
