const { HttpsError } = require('firebase-functions/v2/https');

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
    if (t.type === 'buy')      { cash -= t.quantity * t.price + (t.fee || 0); qty[t.symbol] = (qty[t.symbol] || 0) + t.quantity; }
    if (t.type === 'sell')     { cash += t.quantity * t.price - (t.fee || 0); qty[t.symbol] = (qty[t.symbol] || 0) - t.quantity; }
    if (t.type === 'dividend' || t.type === 'interest') { cash += t.amount; }
  }
  let holdingsValue = 0;
  for (const [sym, q] of Object.entries(qty)) {
    if (q > 1e-9) holdingsValue += q * (prices[sym] || 0);
  }
  return { cash, netDeposits, holdingsValue, value: cash + holdingsValue, qty };
}

// ── Callable: refresh prices for the signed-in user ──────────────────────────

async function refreshPrices(db, request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const key = await getFinnhubKey(db);
  if (!key) throw new HttpsError('failed-precondition', 'Price service is not set up yet (missing Finnhub key).');

  const assetsCol = db.collection('users').doc(uid).collection('invAssets');
  let symbols = Array.isArray(request.data?.symbols)
    ? request.data.symbols.map(s => String(s).trim().toUpperCase()).filter(Boolean)
    : (await assetsCol.where('source', '==', 'finnhub').get()).docs.map(d => d.id);
  symbols = [...new Set(symbols)].slice(0, 50);

  const now = new Date().toISOString();
  const prices = {};
  const notFound = [];
  for (const sym of symbols) {
    const q = await quote(sym, key);
    if (!q) { notFound.push(sym); continue; }
    prices[sym] = q;
    const ref = assetsCol.doc(sym);
    const existing = await ref.get();
    const update = { symbol: sym, source: 'finnhub', price: q.price, prevClose: q.prevClose, priceUpdatedAt: now };
    if (!existing.exists || !existing.data().name) {
      try {
        const p = await finnhub(`stock/profile2?symbol=${encodeURIComponent(sym)}`, key);
        if (p?.name) update.name = p.name;
      } catch { /* name is optional */ }
    }
    await ref.set(update, { merge: true });
  }
  return { prices, notFound, updatedAt: now };
}

// ── Scheduled per-user work, called from the every-5-minutes job ─────────────

function easternNow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    today: `${ym}-${String(now.getDate()).padStart(2, '0')}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
    weekday: now.getDay() >= 1 && now.getDay() <= 5,
  };
}

// Daily snapshot after US market close (16:30–17:30 ET), for the value chart
async function maybeSnapshot(db, userDoc, key, et) {
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

  const s = summarize(txs, prices);
  await userRef.collection('invSnapshots').doc(et.today).set({
    date: et.today, value: s.value, cash: s.cash, netDeposits: s.netDeposits, updatedAt: new Date().toISOString(),
  });
}

// Price alerts: every 15 minutes during US market hours on weekdays
async function maybeCheckAlerts(db, userDoc, key, et, notify) {
  if (!key || !et.weekday) return;
  if (et.minutes < 9 * 60 + 30 || et.minutes > 16 * 60 + 15) return;
  if (et.minutes % 15 >= 5) return;

  const alertsSnap = await userDoc.ref.collection('invAlerts').where('enabled', '==', true).get();
  if (alertsSnap.empty) return;
  const alerts = alertsSnap.docs;
  const quotes = await fetchQuotes([...new Set(alerts.map(a => a.data().symbol))], key);

  for (const a of alerts) {
    const { symbol, direction, target } = a.data();
    const q = quotes[symbol];
    if (!q) continue;
    const hit = direction === 'above' ? q.price >= target : q.price <= target;
    if (!hit) continue;
    // One-shot: disable before sending so it can't fire twice
    await a.ref.update({ enabled: false, triggeredAt: new Date().toISOString(), triggeredPrice: q.price });
    await notify(`📈 ${symbol} ${direction === 'above' ? 'rose above' : 'fell below'} $${target}`,
      `Now $${q.price.toFixed(2)}`);
  }
}

async function runInvestingJobs(db, userDoc, notify) {
  const et = easternNow();
  const key = await getFinnhubKey(db);
  try { await maybeSnapshot(db, userDoc, key, et); }
  catch (e) { console.error(`Snapshot for ${userDoc.id} failed:`, e.message); }
  if (notify) {
    try { await maybeCheckAlerts(db, userDoc, key, et, notify); }
    catch (e) { console.error(`Alerts for ${userDoc.id} failed:`, e.message); }
  }
}

module.exports = { refreshPrices, runInvestingJobs };
