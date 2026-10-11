import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { ACCOUNT_TYPES, centsToInput } from '../../utils/budget';
import { inputStyle, Field, Chips, PrimaryButton, ConfirmDialog } from '../investing/ui';

// Starting balance may be zero or negative (a credit card you already owe on)
function parseBalance(str) {
  const s = String(str).replace(/[$\s,]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 100) : null;
}

export default function AccountForm({ initial, txCount, onSave, onDelete, onClose }) {
  const [name, setName]       = useState(initial?.name || '');
  const [type, setType]       = useState(initial?.type || 'cash');
  const [balance, setBalance] = useState(
    initial?.startBalance < 0 ? '-' + centsToInput(-initial.startBalance) : centsToInput(initial?.startBalance));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startBalance = parseBalance(balance);
  const canSave = !!name.trim() && startBalance !== null && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, type, startBalance });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit account' : 'New account'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Cash, Chase debit"
            autoFocus={!initial}
            style={inputStyle}
          />
        </Field>

        <Field label="Type">
          <Chips options={ACCOUNT_TYPES} value={type} onChange={setType} small />
        </Field>

        <Field label="Starting balance">
          <input
            value={balance}
            onChange={e => setBalance(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            style={inputStyle}
          />
          <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
            What's in it right now, before any transactions you log here. Use a minus for money owed on a credit card.
          </span>
        </Field>

        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

        <PrimaryButton onClick={save} disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>

        {initial && onDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.red, fontSize: 14 }}
          >
            Delete account
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${initial.name}?`}
          message={txCount
            ? `This also deletes its ${txCount} transaction${txCount === 1 ? '' : 's'}. This can't be undone.`
            : "This can't be undone."}
          onConfirm={async () => { await onDelete(); onClose(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}
