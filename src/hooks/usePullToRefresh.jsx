import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

// Pull down from the top of whatever is scrolled (the page, or a full-screen sheet
// on top of it) and let go to run onRefresh. Sideways moves (chart scrubbing) and
// pulls that start mid-page don't count. onRefresh may return a message to show
// (e.g. what couldn't be updated). Returns the indicator to render.
const PULL = 70; // px to pull before letting go refreshes

// The nearest box that scrolls up and down where the touch started: an element,
// 'fixed' (a sheet on top too short to scroll: always at its top) or null (the page)
function scroller(el) {
  let fixed = false;
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
    if (cs.position === 'fixed') fixed = true;
  }
  return fixed ? 'fixed' : null;
}

export function usePullToRefresh(onRefresh, { color = '#8E8E93', accent = '#C8B87A' } = {}) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | pulling | busy | done
  const [msg, setMsg] = useState(null);
  const fn = useRef(onRefresh);
  fn.current = onRefresh;
  const busy = useRef(false);

  useEffect(() => {
    let start = null; // { x, y, box }
    let dist = 0;
    const atTop = box => (box === 'fixed' ? true : box ? box.scrollTop <= 0 : window.scrollY <= 0);
    const onStart = e => {
      if (busy.current || e.touches.length !== 1) return;
      const t = e.target;
      if (t.closest?.('input, textarea, select, [contenteditable="true"], svg')) return; // typing, charts
      const box = scroller(t);
      if (!atTop(box)) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, box };
      dist = 0;
    };
    const onMove = e => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y;
      if (dist === 0 && (dy <= 0 || Math.abs(dx) > dy || !atTop(start.box))) { start = null; return; }
      dist = Math.max(0, dy);
      setPull(Math.min(dist * 0.55, PULL * 1.3));
      setPhase('pulling');
    };
    const onEnd = async () => {
      if (!start) return;
      const go = dist * 0.55 >= PULL;
      start = null; dist = 0;
      if (!go) { setPull(0); setPhase('idle'); return; }
      busy.current = true;
      setPhase('busy'); setPull(PULL * 0.7);
      let note = null;
      try { note = (await fn.current()) || null; } catch (err) { note = err?.message || 'Could not update prices'; }
      setMsg(note);
      setPhase('done');
      setTimeout(() => { busy.current = false; setPull(0); setPhase('idle'); setMsg(null); }, note ? 3500 : 800);
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (phase === 'idle' || pull <= 2) return null;
  const ready = phase === 'pulling' && pull >= PULL;
  const label = phase === 'busy' ? 'Updating prices…' : phase === 'done' ? (msg || 'Updated ✓') : ready ? 'Release to update' : 'Pull to update prices';
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', left: 0, right: 0, top: 'calc(env(safe-area-inset-top) + 8px)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      transform: `translateY(${pull}px)`, transition: phase === 'pulling' ? 'none' : 'transform 0.25s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 18,
        background: '#1C1C1E', border: '1px solid #2C2C2E', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        fontSize: 13, fontWeight: 600, color: ready || phase !== 'pulling' ? accent : color,
      }}>
        <span style={{
          display: 'inline-block', fontSize: 15,
          transform: phase === 'pulling' ? `rotate(${ready ? 180 : Math.min(180, (pull / PULL) * 180)}deg)` : 'none',
          animation: phase === 'busy' ? 'ptr-spin 0.8s linear infinite' : 'none',
        }}>{phase === 'busy' ? '↻' : phase === 'done' ? '' : '↓'}</span>
        {label}
      </div>
      <style>{'@keyframes ptr-spin { to { transform: rotate(360deg); } }'}</style>
    </div>,
    document.body,
  );
}
