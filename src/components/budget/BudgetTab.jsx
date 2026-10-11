import React, { useMemo, useState } from 'react';
import { T } from '../../theme';
import { parseDate, todayYM } from '../../utils/dateUtils';
import { ACCOUNT_TYPES, BALANCE_CATEGORY, lookupCategory, money, monthSummary, shiftMonth, monthTitle } from '../../utils/budget';
import { Card, SectionTitle } from '../investing/ui';
import TxForm from './TxForm';
import AccountForm from './AccountForm';
import CategoriesSheet from './CategoriesSheet';

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

export default function BudgetTab({ hook }) {
  const {
    accounts, txs, balances, categories, addAccount, updateAccount, deleteAccount, addTx, updateTx, deleteTx,
    addCategory, updateCategory, removeCategory,
  } = hook;
  const [month, setMonth]           = useState(todayYM);
  const [accountFilter, setAccountFilter] = useState(null);
  const [catFilter, setCatFilter]   = useState(null);
  const [editingTx, setEditingTx]   = useState(null); // null | 'new' | { preset } | tx
  const [showCategories, setShowCategories] = useState(false);
  const [editingAcct, setEditingAcct] = useState(null); // null | 'new' | account

  const accountsById = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);
  const total = accounts.reduce((s, a) => s + (balances[a.id] || 0), 0);

  const monthTxs = useMemo(() => txs.filter(t =>
    t.date.startsWith(month)
    && (!accountFilter || t.accountId === accountFilter || t.toAccountId === accountFilter)
  ), [txs, month, accountFilter]);
  const summary = useMemo(() => monthSummary(monthTxs, categories), [monthTxs, categories]);
  const listed = catFilter ? monthTxs.filter(t => t.category === catFilter) : monthTxs;

  const groups = [];
  for (const t of listed) {
    if (groups[groups.length - 1]?.date !== t.date) groups.push({ date: t.date, txs: [] });
    groups[groups.length - 1].txs.push(t);
  }

  const changeMonth = n => { setMonth(m => shiftMonth(m, n)); setCatFilter(null); };
  const isCurrentMonth = month === todayYM();
  const filteredAccount = accountFilter && accountsById[accountFilter];

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
      {/* Balances */}
      <div>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total balance</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: total < 0 ? T.red : T.text, letterSpacing: -0.5, marginTop: 2 }}>
          {money(total)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px', padding: '0 16px', scrollbarWidth: 'none' }}>
        {accounts.map(a => {
          const on = accountFilter === a.id;
          const bal = balances[a.id] || 0;
          return (
            <button
              key={a.id}
              onClick={() => { setAccountFilter(on ? null : a.id); setCatFilter(null); }}
              style={{
                flexShrink: 0, minWidth: 120, padding: '10px 12px', borderRadius: 14, textAlign: 'left',
                background: on ? '#2A3A1A' : T.card, border: `1px solid ${on ? T.olive : T.cardBorder}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: on ? T.khaki : T.text, whiteSpace: 'nowrap' }}>{a.name}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{typeLabel(a.type)}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: bal < 0 ? T.red : T.text, marginTop: 6 }}>{money(bal)}</div>
            </button>
          );
        })}
        <button
          onClick={() => setEditingAcct('new')}
          aria-label="Add account"
          style={{
            flexShrink: 0, width: 56, borderRadius: 14, border: `1px dashed ${T.subtle}`,
            color: T.muted, fontSize: 24,
          }}
        >
          +
        </button>
      </div>

      {filteredAccount && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginTop: -6 }}>
          <span style={{ color: T.muted }}>Showing {filteredAccount.name} only</span>
          <span style={{ display: 'flex', gap: 14 }}>
            <button
              onClick={() => setEditingTx({ preset: { type: 'income', category: BALANCE_CATEGORY.id, accountId: filteredAccount.id } })}
              style={{ color: T.khaki, fontWeight: 600 }}
            >
              Add balance
            </button>
            <button onClick={() => setEditingAcct(filteredAccount)} style={{ color: T.khaki, fontWeight: 600 }}>Edit</button>
            <button onClick={() => setAccountFilter(null)} style={{ color: T.muted }}>Show all</button>
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setEditingTx('new')}
          style={{ flex: 1, padding: 14, borderRadius: 14, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 600 }}
        >
          + Add transaction
        </button>
        <button
          onClick={() => setShowCategories(true)}
          style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${T.cardBorder}`, color: T.khaki, fontSize: 15, fontWeight: 600 }}
        >
          Categories
        </button>
      </div>

      {/* Month */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => changeMonth(-1)} aria-label="Previous month" style={{ color: T.khaki, fontSize: 22, padding: '2px 12px' }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{monthTitle(month)}</span>
        <button
          onClick={() => changeMonth(1)}
          disabled={isCurrentMonth}
          aria-label="Next month"
          style={{ color: isCurrentMonth ? T.subtle : T.khaki, fontSize: 22, padding: '2px 12px' }}
        >
          ›
        </button>
      </div>

      <Card style={{ display: 'flex', gap: 12 }}>
        <Stat label="Spent" value={money(summary.spent)} />
        <Stat label="Income" value={money(summary.income)} color={summary.income ? T.green : T.text} />
        <Stat label="Net" value={(summary.net > 0 ? '+' : '') + money(summary.net)}
          color={summary.net < 0 ? T.red : summary.net > 0 ? T.green : T.text} />
      </Card>

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

      {/* Transactions */}
      {monthTxs.length === 0 ? (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '24px 12px' }}>
          Nothing logged {filteredAccount ? `for ${filteredAccount.name} ` : ''}in {monthTitle(month)}.
        </div>
      ) : (
        groups.map(g => (
          <div key={g.date}>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
              {dayLabel(g.date)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${T.cardBorder}` }}>
              {g.txs.map(t => (
                <TxRow key={t.id} tx={t} accountsById={accountsById} categories={categories} onOpen={() => setEditingTx(t)} />
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
            onDelete={isNew ? null : () => deleteTx(editingTx.id)}
            onClose={() => setEditingTx(null)}
          />
        );
      })()}

      {showCategories && (
        <CategoriesSheet
          categories={categories}
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
