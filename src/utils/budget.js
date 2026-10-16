// Budget: accounts hold money, transactions move it.
// Amounts are stored as whole cents so sums never drift.

// Built-in categories. The user can rename, re-emoji, recolor or hide these, and
// add their own; see mergeCategories.
export const EXPENSE_CATEGORIES = [
  { id: 'groceries',     label: 'Groceries',     color: '#5EC4A8', emoji: '🛒' },
  { id: 'eating-out',    label: 'Eating out',    color: '#E5A44B', emoji: '🍔' },
  { id: 'transport',     label: 'Transport',     color: '#3987e5', emoji: '🚗' },
  { id: 'housing',       label: 'Housing',       color: '#9085e9', emoji: '🏠' },
  { id: 'bills',         label: 'Bills',         color: '#D4C38A', emoji: '💡' },
  { id: 'shopping',      label: 'Shopping',      color: '#d55181', emoji: '🛍️' },
  { id: 'health',        label: 'Health',        color: '#4FCB66', emoji: '💊' },
  { id: 'fun',           label: 'Fun',           color: '#B79CF0', emoji: '🎉' },
  { id: 'subscriptions', label: 'Subscriptions', color: '#d95926', emoji: '🔁' },
  { id: 'gifts',         label: 'Gifts',         color: '#D9805F', emoji: '🎁' },
  { id: 'tobacco',       label: 'Tobacco',       color: '#B98A5E', emoji: '🚬' },
  { id: 'other',         label: 'Other',         color: '#8E8E93', emoji: '📦' },
].map(c => ({ ...c, kind: 'expense' }));

// Receipt lines in the tobacco group are saved as their own entry in this category
export const TOBACCO = 'tobacco';

export const INCOME_CATEGORIES = [
  { id: 'salary',       label: 'Salary',  color: '#32D74B', emoji: '💼' },
  { id: 'gift-in',      label: 'Gift',    color: '#D9805F', emoji: '🎁' },
  { id: 'refund',       label: 'Refund',  color: '#5EC4A8', emoji: '↩️' },
  { id: 'other-income', label: 'Other',   color: '#8E8E93', emoji: '💵' },
].map(c => ({ ...c, kind: 'income' }));

// Money already sitting in an account when you start tracking it. Adds to the
// balance but isn't income, so it stays out of the monthly totals. Not editable.
export const BALANCE_CATEGORY = { id: 'balance', label: 'Existing balance', color: '#8E8E93', emoji: '🏦', kind: 'income', fixed: true };

export const CATEGORY_COLORS = [
  '#5EC4A8', '#E5A44B', '#3987e5', '#9085e9', '#D4C38A', '#d55181',
  '#4FCB66', '#B79CF0', '#d95926', '#D9805F', '#5BA4E6', '#8E8E93',
];

// Built-ins with the user's edits applied, followed by the user's own.
// Saved docs: a built-in's id holds its edits ({ label, emoji, color, hidden });
// any other id is a custom category ({ kind, label, emoji, color, createdAt }).
// Hidden categories stay in the list (old transactions still show them), flagged hidden.
export function mergeCategories(saved) {
  const byId = Object.fromEntries(saved.map(c => [c.id, c]));
  const builtIn = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(c => ({ ...c, ...byId[c.id], kind: c.kind, builtIn: true }));
  const builtInIds = new Set(builtIn.map(c => c.id));
  const custom = saved.filter(c => !builtInIds.has(c.id) && c.id !== BALANCE_CATEGORY.id)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return [...builtIn, ...custom, BALANCE_CATEGORY];
}

const MISSING = { id: 'missing', label: 'Uncategorized', color: '#8E8E93', emoji: '❔' };
export const lookupCategory = (categories, id) => categories.find(c => c.id === id) || MISSING;

export const ACCOUNT_TYPES = [
  { value: 'cash',    label: 'Cash' },
  { value: 'debit',   label: 'Debit card' },
  { value: 'credit',  label: 'Credit card' },
  { value: 'savings', label: 'Savings' },
];

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = cents => usd.format((cents || 0) / 100);

// "12.5" / "12,50" / "$1,200" → cents, or null if it isn't a positive amount
export function parseAmount(str) {
  const s = String(str).replace(/[$\s]/g, '');
  // A lone comma followed by 1–2 digits is a decimal comma; other commas are thousands separators
  const normalized = /^\d+,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = Number(normalized);
  if (!normalized || !isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export const centsToInput = cents => (cents ? (cents / 100).toFixed(2).replace(/\.00$/, '') : '');

// Current balance of every account: the sum of its transactions
export function accountBalances(accounts, txs) {
  const bal = Object.fromEntries(accounts.map(a => [a.id, 0]));
  for (const t of txs) {
    if (t.type === 'expense'  && t.accountId in bal) bal[t.accountId] -= t.amount;
    if (t.type === 'income'   && t.accountId in bal) bal[t.accountId] += t.amount;
    if (t.type === 'transfer') {
      if (t.accountId in bal)   bal[t.accountId]   -= t.amount;
      if (t.toAccountId in bal) bal[t.toAccountId] += t.amount;
    }
  }
  return bal;
}

// Totals for one month ('YYYY-MM'); transfers and existing balances move money
// but aren't spending or income
export function monthSummary(txs, categories) {
  let spent = 0, income = 0;
  const byCat = {};
  for (const t of txs) {
    if (t.type === 'expense') {
      spent += t.amount;
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
    if (t.type === 'income' && t.category !== BALANCE_CATEGORY.id) income += t.amount;
  }
  const byCategory = Object.entries(byCat)
    .filter(([, total]) => total > 0) // only fully refunded purchases in it
    .map(([id, total]) => ({ ...lookupCategory(categories, id), id, total }))
    .sort((a, b) => b.total - a.total);
  return { spent, income, net: income - spent, categories: byCategory };
}

// Spent and income per account for one month's transactions, in account order
export function accountMonthSummary(accounts, txs) {
  const by = Object.fromEntries(accounts.map(a => [a.id, { spent: 0, income: 0 }]));
  for (const t of txs) {
    const row = by[t.accountId];
    if (!row) continue;
    if (t.type === 'expense') row.spent += t.amount;
    if (t.type === 'income' && t.category !== BALANCE_CATEGORY.id) row.income += t.amount;
  }
  return accounts.map(a => ({ account: a, ...by[a.id] }));
}

export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const monthTitle = ym => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Food groups for scanned receipt items. Keep ids in sync with GROUPS in functions/receipts.js
export const GROCERY_GROUPS = [
  { id: 'fruits',     label: 'Fruits',               emoji: '🍎', color: '#FF6B6B' },
  { id: 'vegetables', label: 'Vegetables',           emoji: '🥦', color: '#4FCB66' },
  { id: 'meat',       label: 'Meat, fish & protein', emoji: '🥩', color: '#d55181' },
  { id: 'dairy',      label: 'Dairy & eggs',         emoji: '🧀', color: '#F2D16B' },
  { id: 'bakery',     label: 'Bread & bakery',       emoji: '🥖', color: '#D9A35F' },
  { id: 'pantry',     label: 'Pantry',               emoji: '🥫', color: '#B98A5E' },
  { id: 'snacks',     label: 'Snacks',               emoji: '🥨', color: '#D96B3B' },
  { id: 'sweets',     label: 'Sweets & ice cream',   emoji: '🍫', color: '#F28FB3' },
  { id: 'drinks',     label: 'Drinks',               emoji: '🥤', color: '#3987e5' },
  { id: 'alcohol',    label: 'Alcohol',              emoji: '🍷', color: '#B5485F' },
  { id: 'prepared',   label: 'Deli & ready meals',   emoji: '🍱', color: '#E5A44B' },
  { id: 'household',  label: 'Household',            emoji: '🧻', color: '#9085e9' },
  { id: 'pets',       label: 'Pet food & supplies',  emoji: '🐾', color: '#5BA4E6' },
  { id: 'personal',   label: 'Personal care',        emoji: '🧴', color: '#5EC4A8' },
  { id: 'health',     label: 'Health & pharmacy',    emoji: '💊', color: '#2EC4B6' },
  { id: 'tobacco',    label: 'Tobacco & vapes',      emoji: '🚬', color: '#B98A5E' },
  { id: 'other',      label: 'Other',                emoji: '📦', color: '#8E8E93' },
];
// Groups that were merged away; items saved with them count under the new one
const OLD_GROUPS = { frozen: 'prepared' };
export const TAX_GROUP = { id: 'tax', label: 'Tax & fees', emoji: '🧾', color: '#5A5A5E' };
export const lookupGroup = id => GROCERY_GROUPS.find(g => g.id === (OLD_GROUPS[id] || id)) || (id === 'tax' ? TAX_GROUP : GROCERY_GROUPS[GROCERY_GROUPS.length - 1]);

// Spending by food group across expenses that carry receipt items
// ({ items: [{ name, amount (cents), group }] }). Whatever the items don't cover
// (tax, bag fees, rounding) counts as "Tax & fees".
// → { total, receipts, groups: [{ ...group, total, items: [{ name, amount, date }] }] } biggest first
export function groceryBreakdown(txs) {
  const by = {};
  let total = 0, receipts = 0;
  const add = (gid, item) => {
    const g = by[gid] || (by[gid] = { ...lookupGroup(gid), total: 0, items: [] });
    g.total += item.amount;
    g.items.push(item);
  };
  for (const t of txs) {
    // Items describe the receipt as bought, so a refunded receipt counts at its original price;
    // a fully refunded one is left out
    // Tobacco has its own category, so it stays out of the groceries breakdown
    if (t.type !== 'expense' || !t.items?.length || !t.amount || t.category === TOBACCO) continue;
    const paid = t.originalAmount ?? t.amount;
    receipts++;
    total += paid;
    let covered = 0;
    for (const i of t.items) {
      add(OLD_GROUPS[i.group] || i.group, { name: i.name, amount: i.amount, date: t.date });
      covered += i.amount;
    }
    if (paid - covered) add('tax', { name: t.note || 'Receipt', amount: paid - covered, date: t.date });
  }
  const groups = Object.values(by).filter(g => g.total).sort((a, b) => b.total - a.total);
  groups.forEach(g => g.items.sort((a, b) => b.amount - a.amount));
  return { total, receipts, groups };
}

// Every date a repeating income was due, from its first date up to `today`.
// rule: { start: 'YYYY-MM-DD', months: 1 (monthly) | 3 (every 3 months) }. Keeps the
// start's day of month, moved to the month's last day when it doesn't exist (31st → 30th).
export function recurringDates(rule, today) {
  const out = [];
  if (!rule?.start || !(rule.months > 0)) return out;
  const [y, m, d] = rule.start.split('-').map(Number);
  for (let i = 0; i < 600; i++) {
    const mm = m - 1 + i * rule.months;
    const yy = y + Math.floor(mm / 12), mo = ((mm % 12) + 12) % 12;
    const last = new Date(yy, mo + 1, 0).getDate();
    const ds = `${yy}-${String(mo + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
    if (ds > today) break;
    out.push(ds);
  }
  return out;
}

// The next date after `today` a repeating income is due
export function nextRecurringDate(rule, today) {
  const far = `${Number(today.slice(0, 4)) + 2}-12-31`;
  return recurringDates(rule, far).find(ds => ds > today) || null;
}

// Everything about one category for its detail page. `txs` are the entries in
// scope (already narrowed to an account if one is open); `currentYM` is 'YYYY-MM'.
// Months run from the category's first entry to now; finished months are before
// currentYM (the current one is still adding up), so averages use only those.
export function categoryStats(txs, catId, currentYM) {
  const own = txs.filter(t => t.category === catId && (t.type === 'expense' || t.type === 'income') && t.amount > 0);
  if (!own.length) return null;
  const kind = own[0].type;
  const first = own.reduce((m, t) => (t.date < m ? t.date : m), own[0].date).slice(0, 7);
  const months = [];
  for (let ym = first; ym <= currentYM && months.length < 600; ym = shiftMonth(ym, 1)) months.push(ym);
  const byMonth = Object.fromEntries(months.map(m => [m, 0]));
  const byYear = {};
  const places = {};
  const byAccount = {};
  let total = 0;
  for (const t of own) {
    const ym = t.date.slice(0, 7);
    if (ym in byMonth) byMonth[ym] += t.amount;
    const y = t.date.slice(0, 4);
    byYear[y] = (byYear[y] || 0) + t.amount;
    total += t.amount;
    // Same note = same place ("Lidl", "lidl " count together)
    const key = (t.note || '').trim().toLowerCase();
    if (key) {
      const p = places[key] || (places[key] = { name: t.note.trim(), total: 0, count: 0 });
      p.total += t.amount; p.count++;
    }
    byAccount[t.accountId] = (byAccount[t.accountId] || 0) + t.amount;
  }
  const done = months.filter(m => m < currentYM);
  const doneTotal = done.reduce((s, m) => s + byMonth[m], 0);
  const avgMonth = done.length ? Math.round(doneTotal / done.length) : null;
  const last12 = done.slice(-12);
  const lastYM = shiftMonth(currentYM, -1);
  const thisYear = currentYM.slice(0, 4);
  // Years, newest first; a year's monthly average counts only its months that are both tracked and finished
  const years = Object.keys(byYear).sort().reverse().map(y => {
    const n = done.filter(m => m.startsWith(y)).length;
    return { year: y, total: byYear[y], perMonth: n ? Math.round(done.filter(m => m.startsWith(y)).reduce((s, m) => s + byMonth[m], 0) / n) : null, months: n, partial: y === thisYear };
  });
  return {
    kind, total, count: own.length, months, byMonth, done, avgMonth,
    perPurchase: Math.round(total / own.length),
    perMonthCount: done.length ? own.filter(t => t.date.slice(0, 7) < currentYM).length / done.length : null,
    thisMonth: byMonth[currentYM] || 0,
    lastMonth: lastYM in byMonth ? byMonth[lastYM] : null,
    // A full year of history gives a real yearly figure; less than that is an estimate
    yearly: last12.length >= 12
      ? { value: last12.reduce((s, m) => s + byMonth[m], 0), estimate: false }
      : avgMonth !== null ? { value: avgMonth * 12, estimate: true } : null,
    highMonth: done.reduce((b, m) => (!b || byMonth[m] > byMonth[b] ? m : b), null),
    lowMonth: done.reduce((b, m) => (!b || byMonth[m] < byMonth[b] ? m : b), null),
    years,
    places: Object.values(places).sort((a, b) => b.total - a.total).slice(0, 5),
    biggest: [...own].sort((a, b) => b.amount - a.amount).slice(0, 5),
    recent: own.slice(0, 8), // txs arrive newest first
    byAccount: Object.entries(byAccount).map(([id, amt]) => ({ id, total: amt })).sort((a, b) => b.total - a.total),
  };
}

export const refundedTotal = t => (t.refunds || []).reduce((s, r) => s + r.amount, 0);
