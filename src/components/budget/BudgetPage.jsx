import React from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { useBackHandler } from '../../hooks/useBackHandler';

// A full-screen page opened from the Budget overview (Categories, Transactions…).
// The round back button (top left) or swiping in from the left edge goes back. Sits below sheets (Modal is 100),
// so editing an entry from here opens on top of it.
export default function BudgetPage({ title, subtitle, onClose, children }) {
  useBackHandler(true, onClose);
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
        borderBottom: `1px solid ${T.cardBorder}`, maxWidth: 430, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 430, margin: '0 auto', padding: '18px 16px calc(env(safe-area-inset-bottom) + var(--bars-h, 0px) + 32px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
