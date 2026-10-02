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
// Tap the circle to check off; routines done several times a day fill one dot
// per tap, and the undo button (or tapping a finished circle) takes one back.
// Tap the name for its calendar, long-press for Edit / Delete.
export default function RoutineItem({ routine, onIncrement, onDecrement, onEdit, onRequestDelete, onShowCalendar, first }) {
  const [expanded, setExpanded] = useState(false);
  const longPressRef = useLongPress(() => setExpanded(true));
  const today        = todayStr();
  const required     = getRequiredForDate(routine, today);
  const count        = getCompletionCount(routine, today);
  const done         = count >= required;
  const scheduledToday = routine.days.includes(getDOW(today));
  const multi        = required > 1;
  const dot          = required <= 3 ? 6 : required <= 5 ? 5 : 4;

  return (
    <div ref={longPressRef} style={{ borderTop: first ? 'none' : `1px solid ${T.cardBorder}`, padding: '4px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 50 }}>
        <button
          onClick={() => scheduledToday && onIncrement(routine.id)}
          aria-label={done ? `${routine.name}: done (tap to undo one)` : multi ? `Check ${routine.name} (${count} of ${required})` : `Mark ${routine.name} done`}
          style={{
            width: 44, height: 44, marginLeft: -10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: scheduledToday ? 1 : 0.3,
          }}
        >
          <span style={{
            width: multi ? 30 : 24, height: multi ? 30 : 24, borderRadius: '50%', boxSizing: 'border-box',
            border: done ? 'none' : `2px solid ${count > 0 ? ACCENT : T.subtle}`,
            background: done ? ACCENT : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            {done ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6.2l2.8 2.8L10 3.6" stroke={T.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : multi && (required <= 6 ? (
              <span style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, maxWidth: required <= 3 ? 'none' : required === 4 ? dot * 2 + 2 : dot * 3 + 4 }}>
                {Array.from({ length: required }, (_, i) => (
                  <span key={i} style={{
                    width: dot, height: dot, borderRadius: '50%', boxSizing: 'border-box',
                    background: i < count ? ACCENT : 'transparent',
                    border: `1.5px solid ${i < count ? ACCENT : T.muted}`,
                  }} />
                ))}
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? ACCENT : T.muted }}>{count}</span>
            ))}
          </span>
        </button>

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

        {multi && count > 0 && scheduledToday && (
          <button
            onClick={() => onDecrement(routine.id)}
            aria-label={`Undo one check of ${routine.name}`}
            style={{
              width: 34, height: 34, borderRadius: 17, flexShrink: 0,
              background: '#26261F', color: T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 14L4 9l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 9h10.5a5.5 5.5 0 010 11H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
