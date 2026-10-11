// Budget: accounts hold money, transactions move it.
// Amounts are stored as whole cents so sums never drift.

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
  { id: 'other',         label: 'Other',         color: '#8E8E93', emoji: '•' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary',       label: 'Salary',  color: '#32D74B', emoji: '💼' },
  { id: 'gift-in',      label: 'Gift',    color: '#D9805F', emoji: '🎁' },
  { id: 'refund',       label: 'Refund',  color: '#5EC4A8', emoji: '↩️' },
  { id: 'other-income', label: 'Other',   color: '#8E8E93', emoji: '•' },
];

const ALL_CATS = Object.fromEntries([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(c => [c.id, c]));
export const categoryOf = id => ALL_CATS[id] || ALL_CATS.other;

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

// Current balance of every account: its starting balance plus everything since
export function accountBalances(accounts, txs) {
  const bal = Object.fromEntries(accounts.map(a => [a.id, a.startBalance || 0]));
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

// Totals for one month ('YYYY-MM'); transfers move money but aren't spending
export function monthSummary(txs) {
  let spent = 0, income = 0;
  const byCat = {};
  for (const t of txs) {
    if (t.type === 'expense') {
      spent += t.amount;
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
    if (t.type === 'income') income += t.amount;
  }
  const categories = Object.entries(byCat)
    .map(([id, total]) => ({ ...categoryOf(id), id, total }))
    .sort((a, b) => b.total - a.total);
  return { spent, income, net: income - spent, categories };
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
