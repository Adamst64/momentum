import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../theme';

export default function Modal({ title, onClose, children }) {
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Push sheet above the keyboard on iOS
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
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
        position: 'fixed',
        top: 0, left: 0, right: 0,
        bottom: kbHeight,
        zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end',
        backdropFilter: 'blur(4px)',
        transition: 'bottom 0.25s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: T.card,
          borderRadius: '20px 20px 0 0',
          padding: `20px 20px ${kbHeight > 0 ? '20px' : 'calc(20px + env(safe-area-inset-bottom))'}`,
          maxHeight: '85vh',
          overflowY: 'auto',
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
