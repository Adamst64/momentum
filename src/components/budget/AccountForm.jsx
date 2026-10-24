import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { ACCOUNT_TYPES, parseAmount } from '../../utils/budget';
import { inputStyle, Field, Chips, PrimaryButton, ConfirmDialog } from '../investing/ui';

export default function AccountForm({ initial, txCount, onSave, onDelete, onClose }) {
  const [name, setName]       = useState(initial?.name || '');
  const [type, setType]       = useState(initial?.type || 'cash');
  const [opening, setOpening] = useState(''); // new accounts: what's in it today
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = !!name.trim() && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, type, opening: !initial && type !== 'credit' ? parseAmount(opening) || 0 : 0 });
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
            style={inputStyle}
          />
        </Field>

        <Field label="Type">
          <Chips options={ACCOUNT_TYPES} value={type} onChange={setType} small />
        </Field>

        {!initial && (type === 'credit' ? (
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
            Credit cards start at $0. Spending adds to what you owe; pay it off with "Pay off" from a debit card or cash.
          </div>
        ) : (
          <Field label="Balance right now (optional)">
            <input value={opening} onChange={e => setOpening(e.target.value)} inputMode="decimal" placeholder="0.00" style={inputStyle} />
            <span style={{ fontSize: 12, color: T.muted }}>Money already in it. It's not counted as income.</span>
          </Field>
        ))}

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
