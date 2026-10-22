import React, { useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import { parseDate, todayYM } from '../../utils/dateUtils';
import { ACCOUNT_TYPES, lookupCategory, money, monthSummary, shiftMonth, monthTitle, groceryBreakdown, accountMonthSummary, categoryStats, refundedTotal } from '../../utils/budget';
import { Card, Chips } from '../investing/ui';
import TxForm from './TxForm';
import AccountForm from './AccountForm';
import CategoriesSheet from './CategoriesSheet';
import CategoryDetail from './CategoryDetail';
import CategoryForm from './CategoryForm';
import ReceiptModal from './ReceiptModal';
import MoneySheet from './MoneySheet';
import AccountExtras from './AccountExtras';
import SpendHighlights from './SpendHighlights';
import BudgetPage from './BudgetPage';
import Donut, { DonutLegend } from './Donut';
import { SERIES } from '../investing/ui';
import { useBackHandler } from '../../hooks/useBackHandler';
import TransferSheet from '../TransferSheet';
import InvestTransferSheet from './InvestTransferSheet';

const typeLabel = v => ACCOUNT_TYPES.find(t => t.value === v)?.label || '';
const ACCOUNT_EMOJI = { cash: '💵', debit: '💳', credit: '💳', savings: '🏦' };

// A button on the overview that opens one of the detail pages
function Tile({ title, value, sub, visual, onClick, wide }) {
  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: wide ? '1 / -1' : undefined, display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch',
        gap: wide ? 12 : 8, minWidth: 0, padding: 14, borderRadius: 16, textAlign: 'left', background: T.card, border: `1px solid ${T.cardBorder}`,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{visual}</span>
        {!wide && <span style={{ color: T.muted, fontSize: 18 }} aria-hidden="true">›</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, color: T.muted, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 18, fontWeight: 800, color: T.text, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
        <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
      {wide && <span style={{ color: T.muted, fontSize: 18 }} aria-hidden="true">›</span>}
    </button>
  );
}

function MiniBars() {
  return (
    <svg width="40" height="34" viewBox="0 0 40 34" aria-hidden="true">
      {[14, 22, 10, 28, 18, 24].map((h, i) => <rect key={i} x={i * 7} y={34 - h} width="5" height={h} rx="1.5" fill={i === 3 ? T.khaki : T.olive} />)}
    </svg>
  );
}

// Big donut + its list. Tapping a slice or row picks it (the middle shows it); with
// onOpen a row opens instead; expandable rows show their items.
function DonutBlock({ segments, total, totalLabel, onOpen, expandable, note }) {
  const [picked, setPicked] = useState(null);
  const sel = segments.find(s => s.id === picked);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
        <Donut
          segments={segments} picked={picked} onPick={setPicked} size={230}
          center={sel ? (
            <>
              <span style={{ fontSize: 24 }} aria-hidden="true">{sel.emoji}</span>
              <span style={{ fontSize: 12, color: T.muted, marginTop: 2, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.label}</span>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{sel.valueLabel}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{total ? Math.round((sel.value / total) * 100) : 0}%</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: T.muted }}>{totalLabel}</span>
              <span style={{ fontSize: 19, fontWeight: 800 }}>{money(total)}</span>
              <span style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Tap a slice</span>
            </>
          )}
        />
      </div>
      <DonutLegend
        segments={segments} total={total} picked={picked}
        onPick={setPicked}
        onOpen={onOpen}
        renderExtra={expandable ? s => picked === s.id && s.items && (
          <div style={{ padding: '0 0 10px 44px' }}>
            {s.items.map((i, k) => (
              <div key={k} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '3px 0' }}>
                <span style={{ flex: 1, minWidth: 0, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                <span style={{ color: T.muted, fontSize: 12 }}>{dayLabel(i.date).replace(/^\w+, /, '')}</span>
                <span style={{ color: T.text, minWidth: 64, textAlign: 'right' }}>{money(i.amount)}</span>
              </div>
            ))}
          </div>
        ) : undefined}
      />
      {note && <div style={{ fontSize: 12, color: T.muted, marginTop: -6 }}>{note}</div>}
    </>
  );
}

function dayLabel(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: color || T.text, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}

function TxRow({ tx, accountsById, categories, onOpen }) {
  const from = accountsById[tx.accountId]?.name || 'Deleted account';
  if (tx.type === 'transfer' && tx.source === 'investing') {
    const inv = `Investing${tx.invAccountName ? ` · ${tx.invAccountName}` : ''}`;
    const out = !!tx.accountId;
    const name = accountsById[out ? tx.accountId : tx.toAccountId]?.name || 'Deleted account';
    return (
      <Row onOpen={onOpen} emoji="📈" color={T.muted} title={tx.note || (out ? 'To investing' : 'From investing')}
        sub={out ? `${name} → ${inv}` : `${inv} → ${name}`} amount={money(tx.amount)} amountColor={T.muted} />
    );
  }
  if (tx.type === 'transfer') {
    const to = accountsById[tx.toAccountId]?.name || 'Deleted account';
    return (
      <Row onOpen={onOpen} emoji="⇄" color={T.muted} title={tx.note || 'Transfer'} sub={`${from} → ${to}`}
        amount={money(tx.amount)} amountColor={T.muted} />
    );
  }
  const c = lookupCategory(categories, tx.category);
  const income = tx.type === 'income';
  const back = refundedTotal(tx);
  const base = tx.note ? `${c.label} · ${from}` : from;
  return (
    <Row onOpen={onOpen} emoji={c.emoji} color={c.color} title={tx.note || c.label}
      sub={back ? <>{base} · <span style={{ color: T.green }}>↩ {tx.amount ? `${money(back)} refunded` : 'refunded'}</span></> : base}
      amount={tx.amount || !back ? (income ? '+' : '−') + money(tx.amount)
        : <span style={{ textDecoration: 'line-through', color: T.muted }}>{money(tx.originalAmount)}</span>}
      amountColor={income ? T.green : T.text} />
  );
}

function Row({ onOpen, emoji, color, title, sub, amount, amountColor }) {
  return (
    <button
      onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', width: '100%', textAlign: 'left' }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: color + '26',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color,
      }}>
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: amountColor, flexShrink: 0 }}>{amount}</div>
    </button>
  );
}

export default function BudgetTab({ hook, workEnabled, investing }) {
  const {
    accounts, txs, balances, categories, addAccount, updateAccount, deleteAccount, addTx, updateTx, deleteTx,
    addCategory, updateCategory, removeCategory, scanReceipt, setRecurring, linkWork, addRefund, removeRefund,
  } = hook;
  const [investTx, setInvestTx] = useState(null); // a bank ↔ investing transfer being looked at
  const [transfer, setTransfer] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [page, setPage] = useState(null); // null | 'where' | 'accounts' | 'groceries' | 'months' | 'list'
  const [scanMenu, setScanMenu] = useState(false);
  const [moneyMode, setMoneyMode] = useState(null); // 'in' | 'out' for the account being viewed
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const [month, setMonth]           = useState(todayYM);
  const [range, setRange]           = useState('month'); // 'month' | 'year' | 'all'
  const [accountFilter, setAccountFilter] = useState(null);
  const [catFilter, setCatFilter]   = useState(null);
  const [editingTx, setEditingTx]   = useState(null); // null | 'new' | { preset } | tx
  const [showCategories, setShowCategories] = useState(false);
  const [detailCat, setDetailCat]   = useState(null); // category id whose detail page is open
  const [editingCat, setEditingCat] = useState(null); // category being edited from its detail page
  const [editingAcct, setEditingAcct] = useState(null); // null | 'new' | account

  const accountsById = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);
  const total = accounts.reduce((s, a) => s + (balances[a.id] || 0), 0);

  // The period on screen: one month, one year, or everything
  const period = range === 'month' ? month : range === 'year' ? month.slice(0, 4) : '';
  const monthTxs = useMemo(() => txs.filter(t =>
    t.date.startsWith(period)
    && (!accountFilter || t.accountId === accountFilter || t.toAccountId === accountFilter)
  ), [txs, period, accountFilter]);
  const summary = useMemo(() => monthSummary(monthTxs, categories), [monthTxs, categories]);
  const perAccount = useMemo(
    () => accountMonthSummary(accounts, txs.filter(t => t.date.startsWith(period))),
    [accounts, txs, period]);
  const receipts = useMemo(() => groceryBreakdown(monthTxs), [monthTxs]);
  // The open category's numbers, across all time (and only the open account, if one is)
  const detail = useMemo(() => {
    if (!detailCat) return null;
    const scoped = accountFilter ? txs.filter(t => t.accountId === accountFilter) : txs;
    const stats = categoryStats(scoped, detailCat, todayYM());
    if (!stats) return null;
    const allSpent = scoped.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0);
    return { stats, share: allSpent ? stats.total / allSpent : null, category: lookupCategory(categories, detailCat) };
  }, [detailCat, txs, accountFilter, categories]);
  const listed = catFilter ? monthTxs.filter(t => t.category === catFilter) : monthTxs;

  const groups = [];
  for (const t of listed) {
    if (groups[groups.length - 1]?.date !== t.date) groups.push({ date: t.date, txs: [] });
    groups[groups.length - 1].txs.push(t);
  }

  // Never past this month (a year forward from last November stops at today)
  const changeMonth = n => {
    setMonth(m => { const next = shiftMonth(m, range === 'year' ? 12 * n : n); return next > todayYM() ? todayYM() : next; });
    setCatFilter(null);
  };
  const isCurrentMonth = range === 'year' ? month.slice(0, 4) >= todayYM().slice(0, 4) : month >= todayYM();
  const periodTitle = range === 'month' ? monthTitle(month) : range === 'year' ? month.slice(0, 4) : 'All time';
  const filteredAccount = accountFilter && accountsById[accountFilter];
  // An open account is its own page: swipe back (or ‹) returns to all accounts
  useBackHandler(!!filteredAccount, () => { setAccountFilter(null); setCatFilter(null); });

  // First run: nothing to log against until there's an account
  if (accounts.length === 0) {
    return (
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '32px 12px 8px', lineHeight: 1.5 }}>
          Track where your money goes.<br />Start by adding where you keep it: cash, a card, savings.
        </div>
        <button
          onClick={() => addAccount({ name: 'Cash', type: 'cash' })}
          style={{ padding: 14, borderRadius: 14, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 600 }}
        >
          + Add a Cash account
        </button>
        <button
          onClick={() => setEditingAcct('new')}
          style={{ padding: 13, borderRadius: 14, border: `1px solid ${T.cardBorder}`, color: T.khaki, fontSize: 15, fontWeight: 600 }}
        >
          + Add another account
        </button>
        {editingAcct && <AccountForm initial={null} onSave={addAccount} onClose={() => setEditingAcct(null)} />}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {filteredAccount ? (() => {
        const a = filteredAccount;
        const bal = balances[a.id] || 0;
        const credit = a.type === 'credit';
        const pill = { padding: '8px 14px', borderRadius: 18, fontSize: 13, fontWeight: 600, border: `1px solid ${T.cardBorder}`, background: T.card };
        return (
          <>
            <button onClick={() => { setAccountFilter(null); setCatFilter(null); }} style={{ alignSelf: 'flex-start', color: T.khaki, fontSize: 14, fontWeight: 600, padding: '2px 0' }}>
              ‹ All accounts
            </button>
            <div style={{ marginTop: -6 }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{a.name} · {typeLabel(a.type)}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: bal < 0 ? T.red : T.text, letterSpacing: -0.5, marginTop: 2 }}>
                {credit ? money(Math.abs(bal)) : money(bal)}
                {credit && <span style={{ fontSize: 15, fontWeight: 600, color: T.muted }}> {bal < 0 ? 'owed' : bal > 0 ? 'credit' : ''}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setMoneyMode('in')} style={{ ...pill, color: T.green }}>{credit ? 'Pay off' : '+ Add money'}</button>
              <button onClick={() => setMoneyMode('out')} style={{ ...pill, color: T.khaki }}>− Take out</button>
              <button onClick={() => setEditingAcct(a)} style={{ ...pill, color: T.muted }}>Edit account</button>
            </div>
            {(a.type === 'debit' || a.type === 'savings') && (
              <AccountExtras account={a} workEnabled={workEnabled} workLinkedElsewhere={accounts.some(x => x.workLink?.since && x.id !== a.id)} categories={categories} onLinkWork={linkWork} onSetRecurring={setRecurring} />
            )}
          </>
        );
      })() : (
        <>
      {/* Balances */}
          <div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total balance</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: total < 0 ? T.red : T.text, letterSpacing: -0.5, marginTop: 2 }}>
              {money(total)}
            </div>
          </div>

          {/* Every account at a glance: a grid, no sideways scrolling */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
            {accounts.map(a => {
              const on = accountFilter === a.id;
              const bal = balances[a.id] || 0;
              return (
                <button
                  key={a.id}
                  onClick={() => { setAccountFilter(a.id); setCatFilter(null); }}
                  style={{
                    minWidth: 0, padding: '9px 10px', borderRadius: 12, textAlign: 'left',
                    background: on ? '#2A3A1A' : T.card, border: `1px solid ${on ? T.olive : T.cardBorder}`,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: on ? T.khaki : T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{typeLabel(a.type)}</div>
                  {a.type === 'credit' ? (
                    <div style={{ fontSize: 16, fontWeight: 700, color: bal < 0 ? T.red : T.text, marginTop: 6 }}>
                      {money(Math.abs(bal))}{bal < 0 && <span style={{ fontSize: 11, fontWeight: 600 }}> owed</span>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 700, color: bal < 0 ? T.red : T.text, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{money(bal)}</div>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setEditingAcct('new')}
              aria-label="Add account"
              style={{
                minHeight: 64, borderRadius: 12, border: `1px dashed ${T.subtle}`,
                color: T.muted, fontSize: 22,
              }}
            >
              +
            </button>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setEditingTx('new')}
          style={{ flex: 1, padding: 14, borderRadius: 14, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 600 }}
        >
          + Add transaction
        </button>
        <button
          onClick={() => setScanMenu(v => !v)}
          aria-label="Scan a receipt"
          style={{ padding: '14px 14px', borderRadius: 14, border: `1px solid ${scanMenu ? T.olive : T.cardBorder}`, color: T.khaki, fontSize: 15, fontWeight: 600 }}
        >
          📷
        </button>
        {/* Two inputs: one opens the camera, the other the photo library */}
        <input
          ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setReceiptFile(f); }}
        />
        <input
          ref={libraryRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setReceiptFile(f); }}
        />
        <button
          onClick={() => setTransfer(true)}
          style={{ padding: '14px 14px', borderRadius: 14, border: `1px solid ${T.cardBorder}`, color: T.khaki, fontSize: 15, fontWeight: 600 }}
        >
          ⇄ Transfer
        </button>
      </div>

      {scanMenu && (
        <div style={{ display: 'flex', gap: 8, marginTop: -6 }}>
          <button
            onClick={() => { setScanMenu(false); cameraRef.current?.click(); }}
            style={{ flex: 1, padding: 12, borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.text, fontSize: 14, fontWeight: 600 }}
          >📷 Take a photo</button>
          <button
            onClick={() => { setScanMenu(false); libraryRef.current?.click(); }}
            style={{ flex: 1, padding: 12, borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.text, fontSize: 14, fontWeight: 600 }}
          >🖼️ Choose from photos</button>
        </div>
      )}

      {/* Period: a month, a year, or all time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Chips small options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'all', label: 'All time' }]}
          value={range} onChange={v => { setRange(v); setCatFilter(null); }} />
        <span style={{ flex: 1 }} />
        <button onClick={() => setShowCategories(true)} style={{ fontSize: 13, fontWeight: 600, color: T.khaki }}>Categories</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: -6 }}>
        {range !== 'all' ? (
          <button onClick={() => changeMonth(-1)} aria-label={`Previous ${range}`} style={{ color: T.khaki, fontSize: 22, padding: '2px 12px' }}>‹</button>
        ) : <span style={{ width: 40 }} />}
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{periodTitle}</span>
        {range !== 'all' ? (
          <button
            onClick={() => changeMonth(1)}
            disabled={isCurrentMonth}
            aria-label={`Next ${range}`}
            style={{ color: isCurrentMonth ? T.subtle : T.khaki, fontSize: 22, padding: '2px 12px' }}
          >
            ›
          </button>
        ) : <span style={{ width: 40 }} />}
      </div>

      <Card style={{ display: 'flex', gap: 12 }}>
        <Stat label="Spent" value={money(summary.spent)} />
        <Stat label="Income" value={money(summary.income)} color={summary.income ? T.green : T.text} />
        <Stat label="Net" value={(summary.net > 0 ? '+' : '') + money(summary.net)}
          color={summary.net < 0 ? T.red : summary.net > 0 ? T.green : T.text} />
      </Card>

      {/* Everything else opens as its own page (swipe back to return) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {summary.categories.length > 0 && (
          <Tile
            title="Where it went" value={money(summary.spent)}
            sub={`${summary.categories[0].emoji} ${summary.categories[0].label} ${Math.round((summary.categories[0].total / summary.spent) * 100)}%`}
            visual={<Donut mini size={46} segments={summary.categories.map(c => ({ id: c.id, color: c.color, value: c.total }))} />}
            onClick={() => setPage('where')}
          />
        )}
        {!accountFilter && accounts.length > 1 && summary.spent > 0 && (
          <Tile
            title="By account" value={money(summary.spent)}
            sub={`${accounts.length} accounts`}
            visual={<Donut mini size={46} segments={perAccount.map(({ account: a, spent }, i) => ({ id: a.id, color: SERIES[i % SERIES.length], value: spent }))} />}
            onClick={() => setPage('accounts')}
          />
        )}
        {receipts.groups.length > 0 && (
          <Tile
            title="Groceries by type" value={money(receipts.total)}
            sub={`${receipts.groups[0].emoji} ${receipts.groups[0].label}`}
            visual={<Donut mini size={46} segments={receipts.groups.map(g => ({ id: g.id, color: g.color, value: g.total }))} />}
            onClick={() => setPage('groceries')}
          />
        )}
        {range !== 'month' && monthTxs.length > 0 && (
          <Tile title="Month by month" value={periodTitle} sub="High, low, average"
            visual={<MiniBars />} onClick={() => setPage('months')} />
        )}
        <Tile
          // Full width unless it pairs up with an odd tile before it
          wide={((summary.categories.length > 0) + (!accountFilter && accounts.length > 1 && summary.spent > 0) + (receipts.groups.length > 0) + (range !== 'month' && monthTxs.length > 0)) % 2 === 0}
          title="Transactions"
          value={`${monthTxs.length} entr${monthTxs.length === 1 ? 'y' : 'ies'}`}
          sub={monthTxs.length ? `Latest ${dayLabel(monthTxs[0].date).replace(/^\w+, /, '')}` : `Nothing ${range === 'all' ? 'yet' : `in ${periodTitle}`}`}
          visual={<span style={{ fontSize: 24 }} aria-hidden="true">🧾</span>}
          onClick={() => setPage('list')}
        />
      </div>

      {page === 'where' && (
        <BudgetPage title="Where it went" subtitle={`${periodTitle}${filteredAccount ? ` · ${filteredAccount.name}` : ''} · ${money(summary.spent)} spent`} onClose={() => setPage(null)}>
          <DonutBlock
            segments={summary.categories.map(c => ({ id: c.id, emoji: c.emoji, label: c.label, color: c.color, value: c.total, valueLabel: money(c.total) }))}
            total={summary.spent} totalLabel="Spent"
            onOpen={id => setDetailCat(id)}
            note="Tap a category for its averages, yearly totals and more."
          />
        </BudgetPage>
      )}

      {page === 'accounts' && (
        <BudgetPage title="Spent by account" subtitle={`${periodTitle} · ${money(summary.spent)} spent`} onClose={() => setPage(null)}>
          <DonutBlock
            segments={perAccount.filter(x => x.spent > 0).map(({ account: a, spent }) => ({
              id: a.id, emoji: ACCOUNT_EMOJI[a.type] || '💳', label: a.name,
              color: SERIES[accounts.findIndex(x => x.id === a.id) % SERIES.length], value: spent, valueLabel: money(spent),
            }))}
            total={summary.spent} totalLabel="Spent"
            onOpen={id => { setAccountFilter(id); setCatFilter(null); setPage(null); }}
            note={summary.income > 0 ? `+${money(summary.income)} came in across all accounts. Tap an account to open it.` : 'Tap an account to open it.'}
          />
        </BudgetPage>
      )}

      {page === 'groceries' && (
        <BudgetPage title="Groceries by type" subtitle={`${periodTitle} · ${receipts.receipts} receipt${receipts.receipts === 1 ? '' : 's'} · tax included`} onClose={() => setPage(null)}>
          <DonutBlock
            segments={receipts.groups.map(g => ({ id: g.id, emoji: g.emoji, label: g.label, color: g.color, value: g.total, valueLabel: money(g.total), items: g.items }))}
            total={receipts.total} totalLabel="On receipts"
            expandable
            note="Tap a type to see what you bought."
          />
        </BudgetPage>
      )}

      {page === 'months' && (
        <BudgetPage title="Month by month" subtitle={periodTitle + (filteredAccount ? ` · ${filteredAccount.name}` : '')} onClose={() => setPage(null)}>
          <SpendHighlights
            key={period}
            txs={monthTxs} range={range} year={month.slice(0, 4)} currentYM={todayYM()}
            onOpenMonth={ym => { setMonth(ym); setRange('month'); setCatFilter(null); setPage(null); }}
          />
        </BudgetPage>
      )}

      {page === 'list' && (
        <BudgetPage title="Transactions" subtitle={`${periodTitle}${filteredAccount ? ` · ${filteredAccount.name}` : ''} · ${listed.length} entr${listed.length === 1 ? 'y' : 'ies'}`} onClose={() => { setPage(null); setCatFilter(null); }}>
          {catFilter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}` }}>
              <span style={{ flex: 1, color: T.text }}>{lookupCategory(categories, catFilter).emoji} {lookupCategory(categories, catFilter).label} only</span>
              <button onClick={() => setCatFilter(null)} style={{ color: T.khaki, fontWeight: 600 }}>Show all</button>
            </div>
          )}
          {listed.length === 0 ? (
            <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '24px 12px' }}>
              Nothing logged {filteredAccount ? `for ${filteredAccount.name} ` : ''}{range === 'all' ? 'yet' : `in ${periodTitle}`}.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: -8 }}>Tap any entry to see, edit or delete it.</div>
              {groups.map(g => (
                <div key={g.date}>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
                    {dayLabel(g.date)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${T.cardBorder}` }}>
                    {g.txs.map(t => (
                      <TxRow key={t.id} tx={t} accountsById={accountsById} categories={categories}
                        onOpen={() => (t.source === 'investing' ? setInvestTx(t) : setEditingTx(t))} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </BudgetPage>
      )}

      {editingTx && (() => {
        const isNew = editingTx === 'new' || !!editingTx.preset;
        return (
          <TxForm
            initial={isNew ? null : editingTx}
            preset={editingTx.preset}
            accounts={accounts}
            categories={categories}
            defaultAccountId={accountFilter}
            onSave={data => isNew ? addTx(data) : updateTx(editingTx.id, data)}
            onAddCategory={addCategory}
            onUpdateCategory={updateCategory}
            onRemoveCategory={removeCategory}
            allTxs={txs}
            onRefund={addRefund}
            onRemoveRefund={removeRefund}
            onDelete={isNew ? null : () => deleteTx(editingTx.id)}
            onClose={() => setEditingTx(null)}
          />
        );
      })()}

      {moneyMode && filteredAccount && (
        <MoneySheet
          account={filteredAccount}
          mode={moneyMode}
          accounts={accounts}
          balances={balances}
          categories={categories}
          onSave={addTx}
          onSpend={() => setEditingTx({ preset: { type: 'expense', accountId: filteredAccount.id } })}
          onClose={() => setMoneyMode(null)}
        />
      )}

      {investTx && (
        <InvestTransferSheet tx={investTx} accountsById={accountsById} investing={investing} budget={hook} onClose={() => setInvestTx(null)} />
      )}
      {transfer && investing && <TransferSheet investing={investing} budget={hook} onClose={() => setTransfer(false)} />}

      {receiptFile && (
        <ReceiptModal
          file={receiptFile}
          accounts={accounts}
          categories={categories}
          defaultAccountId={accountFilter}
          scanReceipt={scanReceipt}
          onSave={addTx}
          onClose={() => setReceiptFile(null)}
        />
      )}

      {detail && (
        <CategoryDetail
          category={detail.category}
          stats={detail.stats}
          share={detail.share}
          accountsById={accountsById}
          scopeLabel={filteredAccount ? filteredAccount.name : null}
          currentYM={todayYM()}
          onOpenTx={t => setEditingTx(t)}
          onOpenMonth={ym => { setMonth(ym); setRange('month'); setCatFilter(detailCat); setDetailCat(null); setPage('list'); }}
          onShowAll={() => { setCatFilter(detailCat); setDetailCat(null); setPage('list'); }}
          onEdit={detail.category.fixed || detail.category.id === 'missing' ? null : () => setEditingCat(detail.category)}
          onClose={() => setDetailCat(null)}
        />
      )}

      {editingCat && (
        <CategoryForm
          initial={editingCat}
          kind={editingCat.kind}
          categories={categories}
          txs={txs}
          onSave={data => updateCategory(editingCat.id, data)}
          onRemove={moveTo => { setDetailCat(null); return removeCategory(editingCat.id, moveTo); }}
          onClose={() => setEditingCat(null)}
        />
      )}

      {showCategories && (
        <CategoriesSheet
          categories={categories}
          txs={txs}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onRemove={removeCategory}
          onClose={() => setShowCategories(false)}
        />
      )}

      {editingAcct && (
        <AccountForm
          initial={editingAcct === 'new' ? null : editingAcct}
          txCount={editingAcct === 'new' ? 0 : txs.filter(t => t.accountId === editingAcct.id || t.toAccountId === editingAcct.id).length}
          onSave={data => editingAcct === 'new' ? addAccount(data) : updateAccount(editingAcct.id, data)}
          onDelete={editingAcct === 'new' ? null : async () => {
            await deleteAccount(editingAcct.id);
            if (accountFilter === editingAcct.id) setAccountFilter(null);
          }}
          onClose={() => setEditingAcct(null)}
        />
      )}
    </div>
  );
}
