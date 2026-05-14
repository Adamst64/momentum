import React from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ord(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

function formatEntry(ym, dateStr) {
  const [y, m] = ym.split('-').map(Number);
  const month  = MONTHS[m - 1];
  if (dateStr) {
    const day = parseInt(dateStr.slice(-2), 10);
    return { label: `${month} ${y}`, sub: `Completed on the ${day}${ord(day)}` };
  }
  return { label: `${month} ${y}`, sub: null };
}

export default function MonthlyTaskHistoryModal({ task, onClose }) {
  const entries = Object.entries(task.completedOccurrences || {})
    .filter(([, v]) => !!v)
    .sort(([a], [b]) => b.localeCompare(a)); // newest first

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: T.bg, display: 'flex', flexDirection: 'column' }}>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
        borderBottom: `1px solid ${T.cardBorder}`,
      }}>
        <button onClick={onClose} style={{ color: T.khaki, fontSize: 22, lineHeight: 1, padding: '2px 0' }}>←</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.name}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            Due every {task.dayOfMonth}{ord(task.dayOfMonth)} · {entries.length} completion{entries.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        {entries.length === 0 ? (
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '32px 16px', textAlign: 'center',
            color: T.muted, fontSize: 14,
          }}>
            No completions recorded yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map(([ym, dateStr]) => {
              const { label, sub } = formatEntry(ym, dateStr);
              return (
                <div key={ym} style={{
                  background: T.card, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 12, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: T.olive, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{label}</div>
                    {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{sub}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
