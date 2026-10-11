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
  { id: 'other',         label: 'Other',         color: '#8E8E93', emoji: '📦' },
].map(c => ({ ...c, kind: 'expense' }));

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
    .map(([id, total]) => ({ ...lookupCategory(categories, id), id, total }))
    .sort((a, b) => b.total - a.total);
  return { spent, income, net: income - spent, categories: byCategory };
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
