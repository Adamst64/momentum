import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { SLIP_REASONS, streakLabel } from '../../utils/commitments';

function Sheet({ onClose, children }) {
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 430, margin: '0 auto', boxSizing: 'border-box',
        background: '#1C1C1E', borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

const btn = { flex: 1, padding: 13, borderRadius: 12, fontSize: 15, fontWeight: 600 };

// Mark a slip: confirm, and optionally say why
export function SlipSheet({ name, dateLabel, streak, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const pick = r => setNote(n => (n.trim() ? `${n.trim()}, ${r}` : r));

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Slipped on “{name}”?</div>
      <div style={{ fontSize: 13, color: T.muted, marginTop: 4, marginBottom: 16 }}>
        {dateLabel}{streak > 0 ? ` · this ends your ${streakLabel(streak)} streak` : ''}
      </div>

      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>What happened? <span style={{ color: T.subtle }}>(optional)</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {SLIP_REASONS.map(r => (
          <button key={r} onClick={() => pick(r)} style={{
            padding: '6px 11px', borderRadius: 16, fontSize: 13,
            background: T.subtle, color: T.text,
          }}>{r}</button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Write the reason in your own words"
        rows={3}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10, resize: 'none',
          background: '#0F0F0F', border: `1px solid ${T.cardBorder}`, color: T.text, fontSize: 15, outline: 'none',
          fontFamily: 'inherit', marginBottom: 16,
        }}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ ...btn, background: T.subtle, color: T.muted }}>Cancel</button>
        <button onClick={() => { onConfirm(note); onClose(); }} style={{ ...btn, background: '#2A0D0D', color: T.red }}>Mark slip</button>
      </div>
    </Sheet>
  );
}

// Generic "are you sure?" for destructive actions
export function ConfirmSheet({ title, message, confirmLabel, onConfirm, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{title}</div>
      {message && <div style={{ fontSize: 13, color: T.muted, marginTop: 6, lineHeight: 1.45 }}>{message}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btn, background: T.subtle, color: T.muted }}>Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} style={{ ...btn, background: '#2A0D0D', color: T.red }}>{confirmLabel}</button>
      </div>
    </Sheet>
  );
}
