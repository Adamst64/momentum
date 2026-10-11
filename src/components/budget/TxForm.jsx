import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr } from '../../utils/dateUtils';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, parseAmount, centsToInput } from '../../utils/budget';
import { inputStyle, Field, Chips, PrimaryButton, ConfirmDialog } from '../investing/ui';

const TYPES = [
  { value: 'expense',  label: 'Expense' },
  { value: 'income',   label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

function CategoryGrid({ options, value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
      {options.map(c => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 9px', borderRadius: 10,
              background: on ? c.color + '2E' : T.bg, border: `1px solid ${on ? c.color : T.cardBorder}`,
              color: on ? T.text : T.muted, fontSize: 12.5, fontWeight: on ? 600 : 400, textAlign: 'left', minWidth: 0,
            }}
          >
            <span aria-hidden="true">{c.emoji}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Add or edit one transaction. `initial` is an existing transaction, or null for a new one.
export default function TxForm({ initial, accounts, defaultAccountId, onSave, onDelete, onClose }) {
  const firstAccount = defaultAccountId || accounts[0]?.id || '';
  const [type, setType]           = useState(initial?.type || 'expense');
  const [amount, setAmount]       = useState(centsToInput(initial?.amount));
  const [category, setCategory]   = useState(initial?.category || null);
  const [accountId, setAccountId] = useState(initial?.accountId || firstAccount);
  const [toAccountId, setToAccountId] = useState(
    initial?.toAccountId || accounts.find(a => a.id !== firstAccount)?.id || '');
  const [date, setDate]   = useState(initial?.date || todayStr());
  const [note, setNote]   = useState(initial?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cents = parseAmount(amount);
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catOk = type === 'transfer' || cats.some(c => c.id === category);
  const accountOk = !!accountId && (type !== 'transfer' || (toAccountId && toAccountId !== accountId));
  const canSave = !!cents && catOk && accountOk && !saving;

  const switchType = t => {
    setType(t);
    // Categories differ between expenses and income
    if (t !== type) setCategory(null);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ type, amount: cents, category, accountId, toAccountId, date, note });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  const accountChips = accounts.map(a => ({ value: a.id, label: a.name }));

  return (
    <Modal title={initial ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Chips options={TYPES} value={type} onChange={switchType} />

        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Amount"
          autoFocus={!initial}
          style={{ ...inputStyle, fontSize: 28, fontWeight: 700, padding: '12px 14px',
            color: type === 'income' ? T.green : T.text }}
        />

        {type !== 'transfer' && (
          <Field label="Category">
            <CategoryGrid options={cats} value={category} onChange={setCategory} />
          </Field>
        )}

        <Field label={type === 'transfer' ? 'From' : type === 'income' ? 'Into account' : 'Paid from'}>
          <Chips options={accountChips} value={accountId} onChange={setAccountId} small />
        </Field>

        {type === 'transfer' && (
          <Field label="To">
            <Chips options={accountChips.filter(a => a.value !== accountId)} value={toAccountId} onChange={setToAccountId} small />
            {accounts.length < 2 && (
              <span style={{ fontSize: 12, color: T.muted }}>Add a second account to move money between them.</span>
            )}
          </Field>
        )}

        <Field label="Date">
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Note (optional)">
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={type === 'transfer' ? 'e.g. ATM withdrawal' : 'e.g. Lidl, lunch with Sam'}
            style={inputStyle}
          />
        </Field>

        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

        <PrimaryButton onClick={save} disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>

        {initial && onDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.red, fontSize: 14 }}
          >
            Delete transaction
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete transaction?"
          message="Account balances will update to leave it out."
          onConfirm={async () => { await onDelete(); onClose(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}
