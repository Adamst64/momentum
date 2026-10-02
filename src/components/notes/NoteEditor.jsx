import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import TintPicker from '../TintPicker';
import { todayStr } from '../../utils/dateUtils';


export default function NoteEditor({ initial, onSave, onDelete, onClose }) {
  const [date,   setDate]   = useState(initial?.date || todayStr());
  const mood = initial?.mood ?? null; // no longer edited; kept so older entries don't lose it
  const [title,  setTitle]  = useState(initial?.title || '');
  const [color,  setColor]  = useState(initial?.color ?? null);
  const [text,   setText]   = useState(initial?.text || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    if ((!text.trim() && !title.trim()) || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ date, title, mood, text, color });
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
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Name, e.g. Window measurements"
          aria-label="Note name"
          autoFocus={!initial}
          style={{
            padding: '12px 14px', borderRadius: 10,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 17, fontWeight: 600, outline: 'none',
          }}
        />
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

        <TintPicker value={color} onChange={setColor} />

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={7}
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
          disabled={(!text.trim() && !title.trim()) || saving}
          style={{
            padding: 13, borderRadius: 12,
            background: text.trim() || title.trim() ? T.olive : T.subtle,
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
