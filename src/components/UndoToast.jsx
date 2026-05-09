import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../theme';

export default function UndoToast({ message, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 10000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed',
      bottom: `calc(${T.navH}px + env(safe-area-inset-bottom) + 12px)`,
      left: 16, right: 16, zIndex: 300,
      background: '#2C2C2E', borderRadius: 12,
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      border: `1px solid ${T.cardBorder}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <span style={{ fontSize: 14, color: T.text }}>{message}</span>
      <button
        onClick={onUndo}
        style={{ fontSize: 14, color: T.oliveLight, fontWeight: 700, padding: '4px 8px' }}
      >
        Undo
      </button>
    </div>,
    document.body
  );
}
