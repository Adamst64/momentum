import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../theme';
import { useBackHandler } from '../hooks/useBackHandler';

// While any sheet is open the page behind can't scroll (it used to scroll along
// with the sheet and show through underneath). Counted, since sheets stack.
let openSheets = 0;

// full: a whole-screen page (a holding's details) instead of a sheet that's only
// as tall as its content
export default function Modal({ title, onClose, children, full = false }) {
  useBackHandler(true, onClose);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (openSheets++ === 0) document.body.style.overflow = 'hidden';
    return () => { if (--openSheets === 0) document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Is the keyboard open? (only changes the bottom padding; the overlay itself
  // follows the visible screen through --vv-top / --vv-height, see main.jsx)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Only a keyboard counts: when nothing is being typed in, a viewport change
    // (toolbars, scrolling) must not lift the sheet off the bottom
    const typing = () => { const el = document.activeElement; return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); };
    const update = () => setKbHeight(typing() ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        // Exactly the visible part of the screen (above the keyboard when it's open),
        // so the field being typed in can't be pushed off the top
        position: 'fixed',
        left: 0, right: 0,
        top: 'var(--vv-top, 0px)', height: 'var(--vv-height, 100%)',
        zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: T.card,
          borderRadius: full ? 0 : '20px 20px 0 0',
          padding: full
            ? `calc(16px + env(safe-area-inset-top)) 20px ${kbHeight > 0 ? '20px' : 'calc(20px + env(safe-area-inset-bottom))'}`
            : `20px 20px ${kbHeight > 0 ? '20px' : 'calc(20px + env(safe-area-inset-bottom))'}`,
          // Never taller than the space above the keyboard, or its top goes off-screen
          ...(full ? { height: '100%' } : { maxHeight: 'min(85vh, calc(100% - 24px))' }),
          boxSizing: 'border-box',
          overflowY: 'auto',
          overscrollBehavior: 'contain', // scrolling to the end doesn't drag the page behind
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 20, lineHeight: 1, padding: '4px 8px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
