import React, { useState } from 'react';
import { T } from '../../theme';
import { useLongPress } from '../../hooks/useLongPress';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BirthdayRow({ birthday, days, age, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useLongPress(() => setShowMenu(true));

  const isToday  = days === 0;
  const isSoon   = days <= 7;
  const accent   = isToday ? T.khaki : isSoon ? T.oliveLight : T.muted;
  const dayLabel = isToday ? 'Today 🎂' : days === 1 ? 'Tomorrow' : `In ${days} days`;

  return (
    <>
      <div ref={longPressRef} style={{
        background: isToday ? '#2A2010' : T.card,
        border: `1px solid ${isToday ? T.khaki + '55' : T.cardBorder}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 42, flexShrink: 0, textAlign: 'center',
          background: isToday ? T.khaki + '22' : T.bg,
          borderRadius: 8, padding: '5px 2px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {MONTHS[birthday.month - 1]}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: isToday ? T.khaki : T.text, lineHeight: 1.1 }}>
            {birthday.day}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {birthday.name}
          </div>
          <div style={{ fontSize: 12, color: accent, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{dayLabel}</span>
            {age && <span style={{ color: T.subtle }}>·</span>}
            {age && <span style={{ color: T.muted }}>turning {age}</span>}
          </div>
        </div>

      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -6,
        }}>
          <button
            onClick={() => { onEdit(); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.text, borderBottom: `1px solid ${T.cardBorder}` }}
          >Edit</button>
          <button
            onClick={() => { onDelete(); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red, borderBottom: `1px solid ${T.cardBorder}` }}
          >Delete</button>
          <button
            onClick={() => setShowMenu(false)}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.muted }}
          >Cancel</button>
        </div>
      )}
    </>
  );
}
