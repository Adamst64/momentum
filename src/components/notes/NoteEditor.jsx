import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr } from '../../utils/dateUtils';

export const MOODS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export default function NoteEditor({ initial, onSave, onDelete, onClose }) {
  const [date,   setDate]   = useState(initial?.date || todayStr());
  const [mood,   setMood]   = useState(initial?.mood ?? null);
  const [text,   setText]   = useState(initial?.text || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ date, mood, text });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await onDelete();
      onClose();
    } catch (e) {
      setError(e.message || 'Could not delete. Try again.');
    }
  };

  return (
    <Modal title={initial ? 'Edit Entry' : 'New Entry'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={e => e.target.value && setDate(e.target.value)}
          style={{
            padding: '11px 14px', borderRadius: 10,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark',
          }}
        />

        <div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>How was the day?</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {MOODS.map(m => {
              const on = mood === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(on ? null : m.value)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 10,
                    background: on ? '#2A3A1A' : T.bg,
                    border: `1px solid ${on ? T.oliveLight : T.cardBorder}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{m.emoji}</span>
                  <span style={{ fontSize: 10, color: on ? T.khaki : T.muted }}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={7}
          autoFocus={!initial}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            padding: '12px 14px', borderRadius: 10,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 16, lineHeight: 1.45, outline: 'none', fontFamily: 'inherit',
          }}
        />

        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          style={{
            padding: 13, borderRadius: 12,
            background: text.trim() ? T.olive : T.subtle,
            color: '#fff', fontSize: 15, fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        {initial && onDelete && (
          <button
            onClick={handleDelete}
            style={{ padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.red, fontSize: 14 }}
          >
            {confirmDelete ? 'Tap again to delete' : 'Delete entry'}
          </button>
        )}
      </div>
    </Modal>
  );
}
