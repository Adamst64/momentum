import React, { useState } from 'react';
import { useLongPress } from '../../hooks/useLongPress';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr, parseDate } from '../../utils/dateUtils';
import { parseAmount, centsToInput, money, refundedTotal } from '../../utils/budget';
import RefundSheet, { RefundPanel } from './RefundPanel';
import { inputStyle, Field, Chips, PrimaryButton, ConfirmDialog } from '../investing/ui';
import CategoryForm from './CategoryForm';
import ReceiptItems, { itemsToRows, rowsToItems } from './ReceiptItems';

const TYPES = [
  { value: 'expense',  label: 'Expense' },
  { value: 'income',   label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];
const REFUND = { value: 'refund', label: '↩ Refund' };

// One category button; press and hold (or right-click) to edit or delete it
function CategoryTile({ c, on, onChange, onHold }) {
  const ref = useLongPress(() => onHold?.(c));
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onChange(c.id)}
      onContextMenu={e => { if (onHold) { e.preventDefault(); onHold(c); } }}
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
}

function CategoryGrid({ options, value, onChange, onNew, onHold }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
      {options.map(c => <CategoryTile key={c.id} c={c} on={c.id === value} onChange={onChange} onHold={onHold} />)}
      <button
        type="button"
        onClick={onNew}
        style={{
          padding: '8px 9px', borderRadius: 10, border: `1px dashed ${T.subtle}`,
          color: T.khaki, fontSize: 12.5, fontWeight: 600,
        }}
      >
        + New
      </button>
    </div>
  );
}

// Add or edit one transaction. `initial` is an existing transaction, or null for a new one.
export default function TxForm({
  initial, preset, accounts, categories, defaultAccountId, onSave, onAddCategory, onUpdateCategory, onRemoveCategory,
  allTxs = [], onDelete, onRefund, onRemoveRefund, onClose,
}) {
  // A refunded purchase: the amount field edits the price paid; what it counts as is that minus refunds
  const refunded = initial ? refundedTotal(initial) : 0;
  const start = initial || preset; // preset: a new transaction with some fields filled in
  const firstAccount = start?.accountId || defaultAccountId || accounts[0]?.id || '';
  const [type, setType]           = useState(start?.type || 'expense');
  const [amount, setAmount]       = useState(centsToInput(refunded ? initial.originalAmount : initial?.amount));
  const [category, setCategory]   = useState(start?.category || null);
  const [accountId, setAccountId] = useState(firstAccount);
  const [toAccountId, setToAccountId] = useState(
    start?.toAccountId || accounts.find(a => a.id !== firstAccount)?.id || '');
  const [date, setDate]   = useState(initial?.date || todayStr());
  const [note, setNote]   = useState(start?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newCategory, setNewCategory] = useState(false);
  const [editCat, setEditCat] = useState(null); // category held down in the grid
  const [rows, setRows] = useState(() => itemsToRows(initial?.items)); // scanned receipt lines
  const [showItems, setShowItems] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const cents = parseAmount(amount);
  // Deleted categories aren't offered, unless this transaction already uses one
  const kind = type === 'income' ? 'income' : 'expense';
  const isCredit = accounts.find(a => a.id === accountId)?.type === 'credit';
  // A credit card never has a starting balance (it starts at $0 owed)
  const cats = categories.filter(c => c.kind === kind && (!c.hidden || c.id === initial?.category)
    && !(isCredit && c.id === 'balance' && initial?.category !== 'balance'));
  const catOk = type === 'transfer' || cats.some(c => c.id === category);
  const accountOk = !!accountId && (type !== 'transfer' || (toAccountId && toAccountId !== accountId));
  const priceOk = !refunded || cents >= refunded;
  const canSave = !!cents && catOk && accountOk && priceOk && !saving;

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
      await onSave({
        type, amount: cents - refunded, category, accountId, toAccountId, date, note,
        ...(initial?.items ? { items: rowsToItems(rows) } : {}),
        ...(refunded ? { originalAmount: cents } : {}),
      });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  const accountChips = accounts.map(a => ({ value: a.id, label: a.name }));
  const accountsById = Object.fromEntries(accounts.map(a => [a.id, a]));

  // New entry, "Refund": pick the purchase instead of filling in the form
  if (type === 'refund') {
    return (
      <Modal title="Refund" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Chips options={[...TYPES, REFUND]} value={type} onChange={switchType} />
          <RefundPanel txs={allTxs} categories={categories} accountsById={accountsById} onSave={onRefund} onDone={onClose} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={initial ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* A refunded purchase stays an expense */}
        {!refunded && <Chips options={!initial && onRefund ? [...TYPES, REFUND] : TYPES} value={type} onChange={switchType} />}

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

        {refunded > 0 && (
          <div style={{ marginTop: -6, fontSize: 12, color: priceOk ? T.muted : T.red, lineHeight: 1.5 }}>
            {priceOk
              ? <>Price paid. {money(refunded)} came back, so it counts as <b style={{ color: T.text }}>{money(cents - refunded)}</b>.</>
              : <>The price can't be less than the {money(refunded)} already refunded.</>}
          </div>
        )}

        {type !== 'transfer' && (
          <Field label="Category">
            <CategoryGrid options={cats} value={category} onChange={setCategory} onNew={() => setNewCategory(true)}
              onHold={onUpdateCategory && (c => !c.fixed && setEditCat(c))} />
            {onUpdateCategory && <span style={{ fontSize: 11, color: T.muted }}>Press and hold a category to edit or delete it.</span>}
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

        {initial?.items?.length > 0 && type === 'expense' && (
          <div>
            <button onClick={() => setShowItems(v => !v)} style={{ fontSize: 13, fontWeight: 600, color: T.khaki }}>
              🧾 Receipt items ({rows.length}) {showItems ? '▴' : '▾'}
            </button>
            {showItems && <div style={{ marginTop: 10 }}><ReceiptItems rows={rows} onChange={setRows} /></div>}
          </div>
        )}

        {initial && initial.type === 'expense' && onRefund && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(initial.refunds || []).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 10px', borderRadius: 10, background: T.bg, border: `1px solid ${T.cardBorder}` }}>
                <span style={{ flex: 1, color: T.muted }}>
                  ↩ <span style={{ color: T.green, fontWeight: 600 }}>{money(r.amount)}</span> refunded {parseDate(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <button onClick={async () => { await onRemoveRefund(initial.id, r.id); onClose(); }} style={{ fontSize: 12, fontWeight: 600, color: T.red }}>Undo</button>
              </div>
            ))}
            {initial.amount > 0 && (
              <button onClick={() => setRefunding(true)} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: T.khaki, padding: '2px 0' }}>
                ↩ Add a refund for this
              </button>
            )}
          </div>
        )}

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

      {refunding && (
        <RefundSheet
          txs={allTxs}
          purchase={initial}
          categories={categories}
          accountsById={accountsById}
          onSave={onRefund}
          onDone={() => { setRefunding(false); onClose(); }}
          onClose={() => setRefunding(false)}
        />
      )}

      {newCategory && (
        <CategoryForm
          initial={null}
          kind={kind}
          onSave={async data => setCategory(await onAddCategory(data))}
          onClose={() => setNewCategory(false)}
        />
      )}

      {editCat && (
        <CategoryForm
          initial={editCat}
          kind={kind}
          categories={categories}
          txs={allTxs}
          onSave={data => onUpdateCategory(editCat.id, data)}
          onRemove={async moveTo => {
            await onRemoveCategory(editCat.id, moveTo);
            if (category === editCat.id) setCategory(moveTo);
          }}
          onClose={() => setEditCat(null)}
        />
      )}

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
