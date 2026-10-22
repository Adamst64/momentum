import React from 'react';
import { T } from '../../theme';

// A donut of parts of a whole: segments [{ id, color, value }], biggest first.
// Tap a segment (or its row in the list below it) to pick it; the middle shows the
// picked one, otherwise `center` (usually the total).
// mini: a small, plain version for the overview tiles.
export default function Donut({ segments, size = 190, picked, onPick, center, mini }) {
  const parts = segments.filter(s => s.value > 0);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const stroke = mini ? 7 : 22;
  const r = 50 - stroke / 2 - (mini ? 1 : 3);
  const circ = 2 * Math.PI * r;
  // A 2-unit gap between segments (none when there's just one)
  const gap = parts.length > 1 ? (mini ? 1.6 : 1.4) : 0;
  let at = 0;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={T.subtle} strokeWidth={stroke} opacity={total ? 0 : 1} />
        {parts.map(p => {
          const len = (p.value / total) * circ;
          const dash = Math.max(len - gap, 0.6);
          const seg = (
            <circle
              key={p.id}
              cx="50" cy="50" r={r} fill="none"
              stroke={p.color}
              strokeWidth={picked === p.id ? stroke + (mini ? 0 : 4) : stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-at}
              opacity={picked && picked !== p.id ? 0.3 : 1}
              onClick={onPick ? () => onPick(picked === p.id ? null : p.id) : undefined}
              style={{ cursor: onPick ? 'pointer' : 'default', transition: 'opacity 0.2s, stroke-width 0.2s' }}
            />
          );
          at += len;
          return seg;
        })}
      </svg>
      {center && (
        <div style={{
          position: 'absolute', inset: stroke * size / 100 + 6, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none', color: T.text,
        }}>
          {center}
        </div>
      )}
    </div>
  );
}

// The list under a donut: one row per segment, tappable
export function DonutLegend({ segments, total, picked, onPick, onOpen, renderExtra }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {segments.map(s => {
        const on = picked === s.id;
        const pct = total ? Math.round((s.value / total) * 100) : 0;
        return (
          <div key={s.id}>
            <button
              onClick={() => (onOpen ? onOpen(s.id) : onPick?.(on ? null : s.id))}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 0',
                borderTop: `1px solid ${T.cardBorder}`, opacity: picked && !on ? 0.55 : 1,
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: s.color + '2E',
                border: `1.5px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
              }} aria-hidden="true">{s.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, color: T.text, fontWeight: on ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                <span style={{ display: 'block', height: 4, borderRadius: 2, background: T.subtle, marginTop: 5, overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: s.color, borderRadius: 2 }} />
                </span>
              </span>
              <span style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: T.text }}>{s.valueLabel}</span>
                <span style={{ display: 'block', fontSize: 12, color: T.muted }}>{pct}%</span>
              </span>
              {onOpen && <span style={{ color: T.muted, fontSize: 18 }} aria-hidden="true">›</span>}
            </button>
            {renderExtra?.(s)}
          </div>
        );
      })}
    </div>
  );
}
