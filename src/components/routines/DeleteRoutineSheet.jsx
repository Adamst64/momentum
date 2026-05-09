import React from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';

export default function DeleteRoutineSheet({ routine, onKeepHistory, onDeleteAll, onCancel }) {
  return ReactDOM.createPortal(
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: T.card,
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          Delete "{routine.name}"?
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>
          What should happen to this routine's completion history?
        </div>

        <button
          onClick={onKeepHistory}
          style={{
            padding: '13px 14px', borderRadius: 12, textAlign: 'left',
            background: T.subtle, border: 'none',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Remove routine, keep history</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>History stays in the monthly calendar</div>
        </button>

        <button
          onClick={onDeleteAll}
          style={{
            padding: '13px 14px', borderRadius: 12, textAlign: 'left',
            background: '#2A1010', border: `1px solid ${T.red}40`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: T.red }}>Delete everything</div>
          <div style={{ fontSize: 12, color: T.red + '99', marginTop: 3 }}>Routine and all history will be removed</div>
        </button>

        <button
          onClick={onCancel}
          style={{
            padding: 13, borderRadius: 12,
            border: `1px solid ${T.cardBorder}`,
            color: T.muted, fontSize: 15, background: 'transparent',
          }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
