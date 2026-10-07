import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { parseDate } from '../../utils/dateUtils';
import { useBackHandler } from '../../hooks/useBackHandler';

export function editedLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Edited today, ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Edited yesterday, ${time}`;
  return `Edited ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })}, ${time}`;
}

const SAVE_DELAY = 800;

// Full-screen note: the text is edited in place and saved as you type;
// name, date and colour live behind the Edit button (NoteEditor)
export default function NoteViewer({ note: n, onSaveText, onEdit, onClose }) {
  const [text, setText]     = useState(n.text || '');
  const [status, setStatus] = useState(null); // null | 'saving' | 'error'
  const saved = useRef(n.text || '');
  const latest = useRef(text);
  latest.current = text;
  const timer = useRef(null);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const t = latest.current;
    // A note with no name needs some text, or it'd be left blank
    if (t.trim() === saved.current.trim() || (!t.trim() && !n.title)) return;
    setStatus('saving');
    try {
      await onSaveText(t);
      saved.current = t;
      setStatus(null);
    } catch {
      setStatus('error');
    }
  }, [onSaveText, n.title]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
    return () => clearTimeout(timer.current);
  }, [text, flush]);

  // Save whatever's pending when the screen goes away
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => { flushRef.current(); }, []);

  const close = () => { flush(); onClose(); };
  useBackHandler(true, close);

  const accent = n.color || T.khaki;
  const edited = editedLabel(n.updatedAt || n.createdAt);

  return ReactDOM.createPortal(
    // Below Modal (100) so the editor sheet opens on top of it
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: T.bg, display: 'flex', flexDirection: 'column' }}>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
        borderBottom: `1px solid ${T.cardBorder}`,
      }}>
        <button onClick={close} aria-label="Back" style={{ color: T.khaki, fontSize: 22, lineHeight: 1, padding: '2px 0' }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: accent, fontWeight: 700 }}>
            {parseDate(n.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 12, color: status === 'error' ? T.red : T.muted, marginTop: 2 }}>
            {status === 'saving' ? 'Saving…' : status === 'error' ? 'Could not save — check your connection' : edited}
          </div>
        </div>
        <button
          onClick={async () => { await flush(); onEdit(latest.current); }}
          style={{
            padding: '7px 16px', borderRadius: 10, background: T.olive,
            color: '#fff', fontSize: 14, fontWeight: 600,
          }}
        >
          Edit
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '20px 20px 0' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: n.title ? T.text : T.muted, lineHeight: 1.25, overflowWrap: 'anywhere', marginBottom: 12 }}>
          {n.title || 'Untitled'}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={flush}
          placeholder="Write something…"
          aria-label="Note text"
          style={{
            flex: 1, width: '100%', boxSizing: 'border-box', resize: 'none',
            padding: '0 0 calc(env(safe-area-inset-bottom) + 24px)', border: 'none', background: 'transparent',
            color: T.text, fontSize: 16, lineHeight: 1.55, outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </div>,
    document.body
  );
}
