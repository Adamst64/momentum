import React, { Suspense, lazy, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { CATEGORY_COLORS } from '../../utils/budget';
import { inputStyle, Field, PrimaryButton, ConfirmDialog } from '../investing/ui';

// The full emoji set is large, so it only loads once someone opens the picker
const EmojiPicker = lazy(() => import('emoji-picker-react'));

// Add or edit a category. `initial` is an existing category, or null for a new one of `kind`.
export default function CategoryForm({ initial, kind, onSave, onRemove, onClose }) {
  const [label, setLabel]   = useState(initial?.label || '');
  const [emoji, setEmoji]   = useState(initial?.emoji || '🏷️');
  const [color, setColor]   = useState(initial?.color || CATEGORY_COLORS[0]);
  const [picking, setPicking] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const canSave = !!label.trim() && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ kind: initial?.kind || kind, label, emoji, color });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit category' : 'New category'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setPicking(p => !p)}
            aria-label="Choose emoji"
            style={{
              width: 50, height: 46, flexShrink: 0, borderRadius: 12, fontSize: 26,
              background: color + '2E', border: `1px solid ${picking ? color : T.cardBorder}`,
            }}
          >
            {emoji}
          </button>
          <Field label="Name">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={(initial?.kind || kind) === 'income' ? 'e.g. Side hustle' : 'e.g. Coffee'}
              style={inputStyle}
            />
          </Field>
        </div>

        {picking && (
          <Suspense fallback={<div style={{ height: 360, color: T.muted, fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Loading emojis…</div>}>
            <EmojiPicker
              onEmojiClick={e => { setEmoji(e.emoji); setPicking(false); }}
              theme="dark"
              emojiStyle="native"
              width="100%"
              height={360}
              autoFocusSearch={false}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              style={{ '--epr-bg-color': T.bg, '--epr-category-label-bg-color': T.bg, '--epr-search-input-bg-color': T.card, borderColor: T.cardBorder }}
            />
          </Suspense>
        )}

        <Field label="Color">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORY_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                style={{
                  width: 30, height: 30, borderRadius: 15, background: c,
                  border: `2px solid ${color === c ? T.text : 'transparent'}`,
                  boxShadow: color === c ? `0 0 0 2px ${T.card} inset` : 'none',
                }}
              />
            ))}
          </div>
        </Field>

        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

        <PrimaryButton onClick={save} disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>

        {initial && onRemove && (
          <button
            onClick={() => setConfirmRemove(true)}
            style={{ padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.red, fontSize: 14 }}
          >
            Delete category
          </button>
        )}
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title={`Delete ${initial.label}?`}
          message="It won't be offered for new transactions. Ones already logged keep it."
          onConfirm={async () => { await onRemove(); onClose(); }}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </Modal>
  );
}
