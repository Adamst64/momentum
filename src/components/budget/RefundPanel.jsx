import React, { useMemo, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { parseDate, todayStr } from '../../utils/dateUtils';
import { money, parseAmount, lookupCategory, refundedTotal } from '../../utils/budget';
import { inputStyle, Field, Chips, PrimaryButton } from '../investing/ui';

const shortDate = ds => parseDate(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function PurchaseRow({ t, categories, accountsById, on, onClick }) {
  const c = lookupCategory(categories, t.category);
  const back = refundedTotal(t);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 10px',
        borderRadius: 10, background: on ? '#2A3A1A' : T.bg, border: `1px solid ${on ? T.olive : T.cardBorder}`,
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: c.color + '26', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{c.emoji}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note || c.label}</span>
        <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shortDate(t.date)} · {accountsById[t.accountId]?.name || 'Deleted account'}
          {back > 0 && <span style={{ color: T.green }}> · {money(back)} back already</span>}
        </span>
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, flexShrink: 0 }}>{money(t.amount)}</span>
    </button>
  );
}

// Pick a purchase, then full or partial, then save. `purchase` preselects one
// (and hides the picker). onSave(txId, { amount, date }).
export function RefundPanel({ txs, purchase, categories, accountsById, onSave, onDone }) {
  const [pickedId, setPickedId] = useState(purchase?.id || null);
  const [query, setQuery]       = useState('');
  const [mode, setMode]         = useState('full'); // 'full' | 'partial'
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(todayStr());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  // Anything still costing something can get money back
  const refundable = useMemo(() => txs.filter(t => t.type === 'expense' && t.amount > 0), [txs]);
  const picked = refundable.find(t => t.id === pickedId) || (purchase?.id === pickedId ? purchase : null);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q
    ? refundable.filter(t => (t.note || '').toLowerCase().includes(q)
      || lookupCategory(categories, t.category).label.toLowerCase().includes(q)
      || (t.amount / 100).toFixed(2).includes(q))
    : refundable).slice(0, 40), [refundable, q, categories]);

  const cents = mode === 'full' ? picked?.amount : parseAmount(amount);
  const tooMuch = picked && mode === 'partial' && cents > picked.amount;
  const canSave = !!picked && !!cents && !tooMuch && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(picked.id, { amount: cents, date });
      onDone();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  if (!picked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: T.muted }}>Which purchase is the money back for?</div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by note, category or amount…" style={inputStyle} />
        {matches.length === 0 && (
          <div style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: 16 }}>
            {refundable.length ? 'No purchase matches.' : 'No purchases logged yet.'}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {matches.map(t => (
            <PurchaseRow key={t.id} t={t} categories={categories} accountsById={accountsById} onClick={() => { setPickedId(t.id); setMode('full'); setAmount(''); }} />
          ))}
        </div>
        {!q && refundable.length > matches.length && (
          <div style={{ fontSize: 12, color: T.muted, textAlign: 'center' }}>Showing the latest {matches.length}. Search to find older ones.</div>
        )}
      </div>
    );
  }

  const after = picked.amount - (cents && !tooMuch ? cents : 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Purchase">
        <PurchaseRow t={picked} categories={categories} accountsById={accountsById} on onClick={() => !purchase && setPickedId(null)} />
        {!purchase && <span style={{ fontSize: 11, color: T.muted }}>Tap it to pick a different one.</span>}
      </Field>

      <Chips
        options={[{ value: 'full', label: `Full refund · ${money(picked.amount)}` }, { value: 'partial', label: 'Partial' }]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'partial' && (
        <Field label="Amount back">
          <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus
            style={{ ...inputStyle, fontSize: 22, fontWeight: 700, color: T.green }} />
          {tooMuch && <span style={{ fontSize: 12, color: T.red }}>That's more than the {money(picked.amount)} it cost.</span>}
        </Field>
      )}

      <Field label="Refunded on">
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={inputStyle} />
      </Field>

      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
        {money(cents && !tooMuch ? cents : 0)} goes back to <b style={{ color: T.text }}>{accountsById[picked.accountId]?.name || 'its account'}</b>.
        {' '}The purchase will count as <b style={{ color: T.text }}>{money(after)}</b>{after === 0 ? ' (fully refunded)' : ''} in your spending.
      </div>

      {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

      <PrimaryButton onClick={save} disabled={!canSave}>{saving ? 'Saving…' : 'Save refund'}</PrimaryButton>
    </div>
  );
}

// onDone runs after a refund is saved; onClose when the sheet is dismissed
export default function RefundSheet({ onClose, onDone = onClose, ...props }) {
  return (
    <Modal title="Refund" onClose={onClose}>
      <RefundPanel {...props} onDone={onDone} />
    </Modal>
  );
}
