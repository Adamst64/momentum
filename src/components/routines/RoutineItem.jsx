import React, { useState } from 'react';
import { T } from '../../theme';
import { todayStr, getDOW, DAYS_SHORT } from '../../utils/dateUtils';
import { useLongPress } from '../../hooks/useLongPress';
import { getCompletionCount, getRequiredForDate } from '../../hooks/useRoutines';

const ACCENT = '#A9BB6C';

function scheduleLabel(days) {
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DAYS_SHORT[d]).join(' ');
}

// One routine as a row inside the grouped Routines card.
// Tap the circle (or + for multi-count routines) to check off, tap the name for its
// calendar, long-press for Edit / Delete.
export default function RoutineItem({ routine, onIncrement, onEdit, onRequestDelete, onShowCalendar, first }) {
  const [expanded, setExpanded] = useState(false);
  const longPressRef = useLongPress(() => setExpanded(true));
  const today        = todayStr();
  const required     = getRequiredForDate(routine, today);
  const count        = getCompletionCount(routine, today);
  const done         = count >= required;
  const scheduledToday = routine.days.includes(getDOW(today));
  const multi        = required > 1;

  const check = (
    <button
      onClick={() => scheduledToday && onIncrement(routine.id)}
      aria-label={done ? `${routine.name}: done (tap to undo)` : `Mark ${routine.name} done`}
      style={{
        width: 44, height: 44, marginLeft: -10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: scheduledToday ? 1 : 0.3,
      }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: 12, boxSizing: 'border-box',
        border: done ? 'none' : `2px solid ${T.subtle}`,
        background: done ? ACCENT : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
      }}>
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.2l2.8 2.8L10 3.6" stroke={T.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );

  return (
    <div ref={longPressRef} style={{ borderTop: first ? 'none' : `1px solid ${T.cardBorder}`, padding: '4px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 50 }}>
        {!multi && check}
        {multi && (
          <div style={{ width: 34, flexShrink: 0, marginRight: 4, fontSize: 13, fontWeight: 700, color: done ? ACCENT : T.text, textAlign: 'center' }}>
            {count}/{required}
          </div>
        )}

        <button onClick={() => onShowCalendar(routine)} style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '6px 0' }}>
          <div style={{
            fontSize: 15, color: done ? T.muted : T.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {routine.name}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {multi ? `${count} of ${required} today · ` : ''}{scheduleLabel(routine.days)}
          </div>
        </button>

        {multi && (
          <button
            onClick={() => scheduledToday && onIncrement(routine.id)}
            aria-label={done ? `${routine.name}: done (tap to reset)` : `Add one to ${routine.name}`}
            style={{
              width: 38, height: 38, borderRadius: 19, flexShrink: 0,
              background: done ? ACCENT : '#26261F', color: done ? T.bg : ACCENT,
              fontSize: done ? 14 : 22, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: scheduledToday ? 1 : 0.3,
            }}
          >
            {done ? '✓' : '+'}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ display: 'flex', gap: 8, margin: '4px 0 10px' }}>
          <button
            onClick={() => setExpanded(false)}
            style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, background: '#2C2C2E', color: T.muted }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onEdit(routine); setExpanded(false); }}
            style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, background: '#2C2C2E', color: T.text }}
          >
            Edit
          </button>
          <button
            onClick={() => { onRequestDelete(routine); setExpanded(false); }}
            style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, background: '#3A1C1C', color: T.red }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
