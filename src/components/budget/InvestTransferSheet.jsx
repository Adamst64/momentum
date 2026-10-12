import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { formatDateYear, todayStr } from '../../utils/dateUtils';
import { money, parseAmount, centsToInput } from '../../utils/budget';
import { validateTx, qtyFmt } from '../../utils/investing';
import { inputStyle, Field, PrimaryButton, ConfirmDialog } from '../investing/ui';

const round6 = n => Math.round(n * 1e6) / 1e6;

// Details of money moved between a bank account and investing, from the Budget side:
// where it went, which fund, and edit (amount, date, note) or delete — both sides at once.
export default function InvestTransferSheet({ tx, accountsById, investing, budget, onClose }) {
  const invTxs = investing?.txs || [];
  const inv = invTxs.find(t => t.bankRef && t.bankRef === tx.bankRef) || null;
  const toInvesting = !!tx.accountId;
  const bankName = accountsById[toInvesting ? tx.accountId : tx.toAccountId]?.name || 'Deleted account';
  const invAcct = (investing?.accounts || []).find(a => a.id === inv?.account);
  const invName = invAcct?.name || tx.invAccountName || 'Investing';
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(centsToInput(tx.amount));
  const [date, setDate] = useState(tx.date);
  const [note, setNote] = useState(tx.note || '');
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const cents = parseAmount(amount);
  // Only a plain money move (one fund in or out) can be edited here; buys/sells paid
  // from a bank in older entries are edited in Investing
  const simple = inv && inv.deposit && !inv.linkId;
  const edited = simple && cents ? { ...inv, date, quantity: round6(cents / 100 / inv.price) } : null;
  const check = edited ? validateTx(invTxs.filter(t => t.id !== inv.id), edited) : null;

  const save = async () => {
    if (!edited || busy || check.errors.length) return;
    setBusy(true);
    setError(null);
    try {
      await investing.updateTx(inv.id, { date, quantity: edited.quantity, ...(note.trim() ? { note: note.trim() } : {}) });
      await budget.putSynced(tx.id, { amount: cents, date, note: note.trim() });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setBusy(false);
    }
  };

  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.cardBorder}`, fontSize: 14 }}>
      <span style={{ color: T.muted, width: 70, flexShrink: 0 }}>{label}</span>
      <span style={{ color: T.text, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );

  return (
    <Modal title={toInvesting ? 'Transfer to investing' : 'Transfer from investing'} onClose={onClose}>
      {!editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.text }}>{money(tx.amount)}</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>{formatDateYear(tx.date)}</div>
          {row('From', toInvesting ? bankName : invName)}
          {row('To', toInvesting ? invName : bankName)}
          {inv && row('Fund', `${inv.symbol} · ${qtyFmt(inv.quantity)} shares at ${money(Math.round(inv.price * 100))}`)}
          {tx.note && row('Note', tx.note)}
          {!inv && <div style={{ fontSize: 12, color: T.khaki, marginTop: 6 }}>The investing side of this transfer wasn't found.</div>}
          <div style={{ fontSize: 12, color: T.muted, marginTop: 8, lineHeight: 1.45 }}>
            Saved in both Budget and Investing — changing or deleting it here changes both.
          </div>
          {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {simple && <button onClick={() => setEditing(true)} style={{ flex: 1, padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.khaki, fontSize: 14, fontWeight: 600 }}>Edit</button>}
            <button onClick={() => setAskDelete(true)} style={{ flex: 1, padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.red, fontSize: 14 }}>Delete</button>
          </div>
          {inv && !simple && <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>To change it, edit the trade in Investing.</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Amount">
            <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" style={{ ...inputStyle, fontSize: 24, fontWeight: 700 }} />
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={todayStr()} onChange={e => e.target.value && setDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Note (optional)">
            <input value={note} onChange={e => setNote(e.target.value)} style={inputStyle} />
          </Field>
          {check?.errors.map(m => <div key={m} style={{ fontSize: 13, color: T.red }}>{m}</div>)}
          {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
          <PrimaryButton onClick={save} disabled={!edited || busy || check?.errors.length > 0}>{busy ? 'Saving…' : 'Save'}</PrimaryButton>
          <button onClick={() => setEditing(false)} style={{ padding: 10, color: T.muted, fontSize: 14 }}>Cancel</button>
        </div>
      )}
      {askDelete && (
        <ConfirmDialog
          title="Delete this transfer?"
          message={`${money(tx.amount)} ${toInvesting ? `from ${bankName} to ${invName}` : `from ${invName} to ${bankName}`} will be removed from both Budget and Investing.`}
          onConfirm={async () => {
            if (inv) await investing.deleteTx(inv.id);
            await budget.removeSynced(tx.id);
            onClose();
          }}
          onClose={() => setAskDelete(false)}
        />
      )}
    </Modal>
  );
}
