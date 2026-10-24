import React, { Suspense, lazy, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { CATEGORY_COLORS } from '../../utils/budget';
import { emojiColor } from '../../utils/emojiColor';
import { inputStyle, Field, PrimaryButton, StickyFooter } from '../investing/ui';
import DeleteCategoryDialog from './DeleteCategoryDialog';
import ErrorBoundary from '../ErrorBoundary';

// The full emoji set is large, so it only loads once someone opens the picker.
// If it can't load (offline, or an update replaced the file), a short built-in list is shown.
const EmojiPicker = lazy(() => import('emoji-picker-react'));
const BASIC_EMOJI = '🛒 🍔 ☕ 🍕 🍺 🚗 ⛽ 🚌 ✈️ 🏠 💡 📱 💻 🛍️ 👕 👟 💊 🏥 🦷 💇 🎉 🎬 🎮 🎵 📚 🎓 🐶 👶 🎁 💍 🏋️ ⚽ 🧾 💳 🏦 💼 💵 🔧 🧹 🌱 🍼 🚬 🏖️ ❤️ ⭐ 📦'.split(' ');

// Add or edit a category. `initial` is an existing category, or null for a new one of `kind`.
// onRemove(moveTo | null); categories and txs let the delete step offer where entries go
export default function CategoryForm({ initial, kind, categories = [], txs = [], onSave, onRemove, onClose }) {
  const [label, setLabel]   = useState(initial?.label || '');
  const [emoji, setEmoji]   = useState(initial?.emoji || '🏷️');
  const color = initial?.color || CATEGORY_COLORS[0]; // fallback when the emoji can't be drawn
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
      await onSave({ kind: initial?.kind || kind, label, emoji, color: emojiColor(emoji) || color });
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
              background: (emojiColor(emoji) || color) + '2E', border: `1px solid ${picking ? (emojiColor(emoji) || color) : T.cardBorder}`,
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
          <ErrorBoundary fallback={() => (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
              {BASIC_EMOJI.map(e => (
                <button key={e} type="button" onClick={() => { setEmoji(e); setPicking(false); }} style={{ fontSize: 24, padding: 6, borderRadius: 8 }}>{e}</button>
              ))}
            </div>
          )}>
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
          </ErrorBoundary>
        )}

        <div style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: emojiColor(emoji) || color, flexShrink: 0 }} />
          Its color in charts comes from the emoji.
        </div>

        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

        <StickyFooter>

          <PrimaryButton onClick={save} disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>

        </StickyFooter>

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
        <DeleteCategoryDialog
          category={initial}
          categories={categories}
          txs={txs}
          onDelete={onRemove}
          onClose={done => { setConfirmRemove(false); if (done) onClose(); }}
        />
      )}
    </Modal>
  );
}
