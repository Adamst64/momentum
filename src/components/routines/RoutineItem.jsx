import React, { useState } from 'react';
import { T } from '../../theme';
import { todayStr, getDOW, DAYS_SHORT } from '../../utils/dateUtils';
import { useLongPress } from '../../hooks/useLongPress';
import { getCompletionCount, getRequiredForDate } from '../../hooks/useRoutines';

export default function RoutineItem({ routine, onIncrement, onEdit, onRequestDelete, onShowCalendar }) {
  const [expanded, setExpanded] = useState(false);
  const longPressRef = useLongPress(() => setExpanded(true));
  const today        = todayStr();
  const required     = getRequiredForDate(routine, today);
  const count        = getCompletionCount(routine, today);
  const done         = count >= required;
  const dow          = getDOW(today);
  const scheduledToday = routine.days.includes(dow);

  return (
    <div ref={longPressRef} style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 14,
      padding: '14px 16px',
      transition: 'border-color 0.2s',
      borderLeftWidth: 3,
      borderLeftColor: done ? T.olive : (scheduledToday ? '#3A3A3C' : T.cardBorder),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Checkbox / dots */}
        <button
          onClick={() => scheduledToday && onIncrement(routine.id)}
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            border: `2px solid ${done ? T.olive : T.muted}`,
            background: done ? T.olive : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: scheduledToday ? 1 : 0.3,
          }}
        >
          {required === 1 ? (
            done && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )
          ) : (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {Array.from({ length: required }, (_, i) => (
                <div key={i} style={{
                  width: required <= 3 ? 5 : 4,
                  height: required <= 3 ? 5 : 4,
                  borderRadius: '50%',
                  background: i < count ? '#fff' : 'transparent',
                  border: `1.5px solid ${i < count ? '#fff' : 'rgba(255,255,255,0.4)'}`,
                  flexShrink: 0,
                }} />
              ))}
            </div>
          )}
        </button>

        {/* Name + days — tap to open calendar */}
        <div style={{ flex: 1 }} onClick={() => onShowCalendar(routine)}>
          <div style={{
            fontSize: 15, fontWeight: 500,
            color: done ? T.muted : T.text,
            textDecoration: done ? 'line-through' : 'none',
          }}>
            {routine.name}
            {required > 1 && (
              <span style={{ fontSize: 11, color: done ? T.muted : T.oliveLight, marginLeft: 6, fontWeight: 400 }}>
                ×{required}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {DAYS_SHORT.map((label, i) => (
              <span key={i} style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 3,
                background: routine.days.includes(i) ? '#2A3A1A' : 'transparent',
                color: routine.days.includes(i) ? T.oliveLight : T.subtle,
                fontWeight: routine.days.includes(i) ? 600 : 400,
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>

      </div>

      {expanded && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => setExpanded(false)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, background: '#2C2C2E', color: T.subtle }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onEdit(routine); setExpanded(false); }}
            style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, background: '#2C2C2E', color: T.muted }}
          >
            Edit
          </button>
          <button
            onClick={() => { onRequestDelete(routine); setExpanded(false); }}
            style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, background: '#3A1C1C', color: T.red }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
