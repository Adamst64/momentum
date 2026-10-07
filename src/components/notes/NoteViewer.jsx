import React from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { parseDate } from '../../utils/dateUtils';
import { useBackHandler } from '../../hooks/useBackHandler';

// Full-screen, read-only view of a note; editing happens in NoteEditor via the Edit button
export default function NoteViewer({ note: n, onEdit, onClose }) {
  useBackHandler(true, onClose);
  const accent = n.color || T.khaki;

  return ReactDOM.createPortal(
    // Below Modal (100) so the editor sheet opens on top of it
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: T.bg, display: 'flex', flexDirection: 'column' }}>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
        borderBottom: `1px solid ${T.cardBorder}`,
      }}>
        <button onClick={onClose} aria-label="Back" style={{ color: T.khaki, fontSize: 22, lineHeight: 1, padding: '2px 0' }}>←</button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: accent, fontWeight: 700 }}>
          {parseDate(n.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <button
          onClick={onEdit}
          style={{
            padding: '7px 16px', borderRadius: 10, background: T.olive,
            color: '#fff', fontSize: 14, fontWeight: 600,
          }}
        >
          Edit
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: n.title ? T.text : T.muted, lineHeight: 1.25, overflowWrap: 'anywhere', marginBottom: 16 }}>
          {n.title || 'Untitled'}
        </div>
        {n.text ? (
          <div style={{ fontSize: 16, color: T.text, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {n.text}
          </div>
        ) : (
          <div style={{ fontSize: 15, color: T.muted }}>No text</div>
        )}
      </div>
    </div>,
    document.body
  );
}
