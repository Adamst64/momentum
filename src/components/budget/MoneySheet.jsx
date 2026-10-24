import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr } from '../../utils/dateUtils';
import { parseAmount, money, centsToInput, BALANCE_CATEGORY } from '../../utils/budget';
import { inputStyle, Field, PrimaryButton, StickyFooter } from '../investing/ui';

function Option({ on, emoji, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10, textAlign: 'left', minWidth: 0,
        background: on ? '#2A3A1A' : T.bg, border: `1px solid ${on ? T.olive : T.cardBorder}`,
      }}
    >
      <span aria-hidden="true">{emoji}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? T.khaki : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
    </button>
  );
}

const acctEmoji = { cash: '💵', debit: '💳', credit: '💳', savings: '🏦' };

// Money into or out of one account, picking where it comes from / goes to.
// From/to another account → a transfer (moves money, not income or spending).
// From an income source (salary, gift…) → income. "Starting balance" → money that
// was already there (not income). Out to spending → hands off to the expense form.
export default function MoneySheet({ account, mode, accounts, balances, categories, onSave, onSpend, onClose }) {
  const credit = account.type === 'credit';
  const owed = credit ? Math.max(0, -(balances[account.id] || 0)) : 0;
  const others = accounts.filter(a => a.id !== account.id);
  const incomeCats = categories.filter(c => c.kind === 'income' && !c.hidden && c.id !== BALANCE_CATEGORY.id);
  const [source, setSource] = useState(null); // 'acct:<id>' | 'cat:<id>'
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const cents = parseAmount(amount);
  const canSave = !!cents && !!source && !saving;

  const title = mode === 'in'
    ? (credit ? `Pay off ${account.name}` : `Add money to ${account.name}`)
    : `Take money out of ${account.name}`;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const [kind, id] = source.split(':');
    const base = { amount: cents, date, note };
    const tx = kind === 'acct'
      ? (mode === 'in'
        ? { ...base, type: 'transfer', accountId: id, toAccountId: account.id }
        : { ...base, type: 'transfer', accountId: account.id, toAccountId: id })
      : { ...base, type: 'income', category: id, accountId: account.id };
    try {
      await onSave(tx);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  const acctLabel = a => (mode === 'in'
    ? (a.type === 'cash' ? 'Cash I deposited' : `From ${a.name}`)
    : (a.type === 'cash' ? 'Withdrew as cash' : a.type === 'credit' ? `Paid ${a.name}` : `To ${a.name}`));
  const acctSub = a => `${a.name} · ${money(balances[a.id] || 0)}`;

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Amount"
          style={{ ...inputStyle, fontSize: 28, fontWeight: 700, padding: '12px 14px', color: mode === 'in' ? T.green : T.text }}
        />

        {credit && mode === 'in' && owed > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: -6 }}>
            <button type="button" onClick={() => setAmount(centsToInput(owed))}
              style={{ padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, color: T.khaki, background: T.bg, border: `1px solid ${T.cardBorder}` }}>
              Full balance {money(owed)}
            </button>
            <span style={{ fontSize: 12, color: T.muted }}>or type the amount paid</span>
          </div>
        )}

        <Field label={mode === 'in' ? (credit ? 'Paid from' : 'Where is it coming from?') : 'Where is it going?'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            {/* Other accounts: a transfer */}
            {others
              .filter(a => !(credit && mode === 'in' && a.type === 'credit'))
              .map(a => (
                <Option key={a.id} on={source === `acct:${a.id}`} emoji={acctEmoji[a.type] || '🏦'}
                  label={acctLabel(a)} sub={acctSub(a)} onClick={() => setSource(`acct:${a.id}`)} />
              ))}
            {/* Income sources (a credit card only takes refunds) */}
            {mode === 'in' && incomeCats
              .filter(c => !credit || c.id === 'refund')
              .map(c => (
                <Option key={c.id} on={source === `cat:${c.id}`} emoji={c.emoji} label={c.label} sub="Income"
                  onClick={() => setSource(`cat:${c.id}`)} />
              ))}
            {mode === 'in' && !credit && (
              <Option on={source === `cat:${BALANCE_CATEGORY.id}`} emoji={BALANCE_CATEGORY.emoji} label="Starting balance"
                sub="Already there, not income" onClick={() => setSource(`cat:${BALANCE_CATEGORY.id}`)} />
            )}
            {mode === 'out' && (
              <Option emoji="🛒" label="Spent it" sub="Log an expense" onClick={() => { onClose(); onSpend(); }} />
            )}
          </div>
          {mode === 'in' && credit && others.length === 0 && (
            <span style={{ fontSize: 12, color: T.muted }}>Add the debit card or cash you pay it from first.</span>
          )}
        </Field>

        <Field label="Date">
          <input type="date" value={date} max={todayStr()} onChange={e => e.target.value && setDate(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Note (optional)">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={mode === 'in' ? 'e.g. October paycheck' : 'e.g. ATM on Main St'} style={inputStyle} />
        </Field>

        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
        <StickyFooter>
          <PrimaryButton onClick={save} disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
        </StickyFooter>
      </div>
    </Modal>
  );
}
