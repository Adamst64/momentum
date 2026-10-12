import React, { useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import { parseDate, todayYM } from '../../utils/dateUtils';
import { ACCOUNT_TYPES, lookupCategory, money, monthSummary, shiftMonth, monthTitle, groceryBreakdown, accountMonthSummary } from '../../utils/budget';
import { Card, SectionTitle, Chips } from '../investing/ui';
import TxForm from './TxForm';
import AccountForm from './AccountForm';
import CategoriesSheet from './CategoriesSheet';
import ReceiptModal from './ReceiptModal';
import MoneySheet from './MoneySheet';
import AccountExtras from './AccountExtras';
import SpendHighlights from './SpendHighlights';
import { useBackHandler } from '../../hooks/useBackHandler';
import TransferSheet from '../TransferSheet';
import InvestTransferSheet from './InvestTransferSheet';

const typeLabel = v => ACCOUNT_TYPES.find(t => t.value === v)?.label || '';

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
  return (
    <Row onOpen={onOpen} emoji={c.emoji} color={c.color} title={tx.note || c.label}
      sub={tx.note ? `${c.label} · ${from}` : from}
      amount={(income ? '+' : '−') + money(tx.amount)} amountColor={income ? T.green : T.text} />
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
    addCategory, updateCategory, removeCategory, scanReceipt, setRecurring, linkWork,
  } = hook;
  const [investTx, setInvestTx] = useState(null); // a bank ↔ investing transfer being looked at
  const [transfer, setTransfer] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const [scanMenu, setScanMenu] = useState(false);
  const [moneyMode, setMoneyMode] = useState(null); // 'in' | 'out' for the account being viewed
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const [month, setMonth]           = useState(todayYM);
  const [range, setRange]           = useState('month'); // 'month' | 'year' | 'all'
  const [showList, setShowList]     = useState(false);  // year / all time: transactions folded away
  const [accountFilter, setAccountFilter] = useState(null);
  const [catFilter, setCatFilter]   = useState(null);
  const [editingTx, setEditingTx]   = useState(null); // null | 'new' | { preset } | tx
  const [showCategories, setShowCategories] = useState(false);
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
  const listed = catFilter ? monthTxs.filter(t => t.category === catFilter) : monthTxs;

  const groups = [];
  for (const t of listed) {
    if (groups[groups.length - 1]?.date !== t.date) groups.push({ date: t.date, txs: [] });
    groups[groups.length - 1].txs.push(t);
  }

  // Never past this month (a year forward from last November stops at today)
  const changeMonth = n => {
    setMonth(m => { const next = shiftMonth(m, range === 'year' ? 12 * n : n); return next > todayYM() ? todayYM() : next; });
    setCatFilter(null); setShowList(false);
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
              <AccountExtras account={a} workEnabled={workEnabled} categories={categories} onLinkWork={linkWork} onSetRecurring={setRecurring} />
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
          value={range} onChange={v => { setRange(v); setCatFilter(null); setShowList(false); }} />
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

      {range !== 'month' && (
        <SpendHighlights
          key={period}
          txs={monthTxs} range={range} year={month.slice(0, 4)} currentYM={todayYM()}
          onOpenMonth={ym => { setMonth(ym); setRange('month'); setCatFilter(null); }}
        />
      )}

      {/* Each account this month (all-accounts view only) */}
      {!accountFilter && accounts.length > 1 && (
        <Card>
          <SectionTitle right={<span style={{ fontSize: 12, color: T.muted }}>{range === 'month' ? 'this month' : range === 'year' ? `in ${periodTitle}` : 'all time'}</span>}>Spent by account</SectionTitle>
          {/* What each account spent in the period on screen (changes with the month / year) */}
          {perAccount.map(({ account: a, spent, income }) => (
            <button
              key={a.id}
              onClick={() => { setAccountFilter(a.id); setCatFilter(null); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 0', borderTop: `1px solid ${T.cardBorder}` }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: spent ? T.text : T.muted }}>
                  {money(spent)} <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>spent</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: T.muted, marginTop: 2 }}>
                <span style={{ flex: 1 }}>{typeLabel(a.type)}</span>
                {income > 0 && <span style={{ color: T.green }}>+{money(income)} came in</span>}
              </div>
              {summary.spent > 0 && spent > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: T.subtle, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(spent / summary.spent) * 100}%`, height: '100%', background: T.olive }} />
                </div>
              )}
            </button>
          ))}
          <div style={{ paddingTop: 8, borderTop: `1px solid ${T.cardBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 14, fontWeight: 700, color: T.text }}>
              <span style={{ flex: 1 }}>All accounts</span>
              <span>{money(summary.spent)} <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>spent</span></span>
            </div>
            {summary.income > 0 && (
              <div style={{ fontSize: 12, color: T.green, marginTop: 2, textAlign: 'right' }}>+{money(summary.income)} came in</div>
            )}
          </div>
        </Card>
      )}

      {/* Where it went */}
      {summary.categories.length > 0 && (
        <Card>
          <SectionTitle right={catFilter && (
            <button onClick={() => setCatFilter(null)} style={{ fontSize: 12, color: T.khaki, fontWeight: 600 }}>Clear filter</button>
          )}>
            Where it went
          </SectionTitle>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12, gap: 2 }}>
            {summary.categories.map(c => (
              <div key={c.id} style={{ flex: c.total, background: c.color, opacity: !catFilter || catFilter === c.id ? 1 : 0.3 }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {summary.categories.map(c => {
              const pct = Math.round((c.total / summary.spent) * 100);
              const on = catFilter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCatFilter(on ? null : c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', width: '100%', textAlign: 'left',
                    opacity: !catFilter || on ? 1 : 0.5,
                  }}
                >
                  <span style={{ width: 22, textAlign: 'center' }} aria-hidden="true">{c.emoji}</span>
                  <span style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: on ? 700 : 400 }}>{c.label}</span>
                  <span style={{ fontSize: 12, color: T.muted }}>{pct}%</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text, minWidth: 80, textAlign: 'right' }}>{money(c.total)}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Scanned receipts, by food group */}
      {receipts.groups.length > 0 && (
        <Card>
          <SectionTitle right={<span style={{ fontSize: 12, color: T.muted }}>{receipts.receipts} receipt{receipts.receipts === 1 ? '' : 's'}</span>}>
            Groceries by type
          </SectionTitle>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12, gap: 2 }}>
            {receipts.groups.filter(g => g.total > 0).map(g => <div key={g.id} style={{ flex: g.total, background: g.color }} />)}
          </div>
          {receipts.groups.map(g => {
            const on = openGroup === g.id;
            return (
              <div key={g.id}>
                <button
                  onClick={() => setOpenGroup(on ? null : g.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', width: '100%', textAlign: 'left' }}
                >
                  <span style={{ width: 22, textAlign: 'center' }} aria-hidden="true">{g.emoji}</span>
                  <span style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: on ? 700 : 400 }}>{g.label}</span>
                  <span style={{ fontSize: 12, color: T.muted }}>{receipts.total ? Math.round((g.total / receipts.total) * 100) : 0}%</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text, minWidth: 80, textAlign: 'right' }}>{money(g.total)}</span>
                </button>
                {on && (
                  <div style={{ padding: '0 0 8px 32px' }}>
                    {g.items.map((i, k) => (
                      <div key={k} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '3px 0' }}>
                        <span style={{ flex: 1, minWidth: 0, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                        <span style={{ color: T.muted, fontSize: 12 }}>{dayLabel(i.date).replace(/^\w+, /, '')}</span>
                        <span style={{ color: T.text, minWidth: 64, textAlign: 'right' }}>{money(i.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Transactions */}
      {range !== 'month' && monthTxs.length > 0 && (
        <button onClick={() => setShowList(v => !v)} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: T.khaki }}>
          {showList ? 'Hide' : 'Show'} all {listed.length} entries {showList ? '▴' : '▾'}
        </button>
      )}
      {monthTxs.length > 0 && (range === 'month' || showList) && (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: -8 }}>
          Tap any entry to see, edit or delete it.
        </div>
      )}
      {monthTxs.length === 0 ? (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '24px 12px' }}>
          Nothing logged {filteredAccount ? `for ${filteredAccount.name} ` : ''}{range === 'all' ? 'yet' : `in ${periodTitle}`}.
        </div>
      ) : (range === 'month' || showList) && (
        groups.map(g => (
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
        ))
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
