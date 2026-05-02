import React, { useState } from 'react';
import { T } from '../../theme';
import { todayStr, getDaysInMonth, getFirstDOW, getDOW, toDateStr, DAYS_SHORT } from '../../utils/dateUtils';

function MiniCalendar({ routine }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const dim = getDaysInMonth(year, month);
  const firstDow = getFirstDOW(year, month);
  const todayDate = today.getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, color: T.muted, paddingBottom: 2 }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateStr = toDateStr(new Date(year, month, day));
          const dow = getDOW(dateStr);
          const scheduled = routine.days.includes(dow);
          const completed = routine.completions[dateStr];
          const isFuture = day > todayDate;

          let bg = 'transparent';
          let color = T.subtle;

          if (scheduled && !isFuture) {
            bg = completed ? '#3A5C2A' : '#4A1C1C';
            color = completed ? '#6BCC52' : '#FF453A';
          }
          if (day === todayDate && scheduled) {
            // slight highlight for today
          }

          return (
            <div
              key={day}
              style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 4, background: bg,
                fontSize: 10, color,
                border: day === todayDate ? `1px solid ${T.khaki}` : 'none',
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RoutineItem({ routine, onToggle, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const today = todayStr();
  const done = !!routine.completions[today];
  const dow = getDOW(today);
  const scheduledToday = routine.days.includes(dow);

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 14,
      padding: '14px 16px',
      transition: 'border-color 0.2s',
      borderLeftWidth: 3,
      borderLeftColor: done ? T.olive : (scheduledToday ? '#3A3A3C' : T.cardBorder),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Checkbox */}
        <button
          onClick={() => scheduledToday && onToggle(routine.id)}
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            border: `2px solid ${done ? T.olive : T.muted}`,
            background: done ? T.olive : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: scheduledToday ? 1 : 0.3,
          }}
        >
          {done && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Name + days */}
        <div style={{ flex: 1 }} onClick={() => setExpanded(e => !e)}>
          <div style={{
            fontSize: 15, fontWeight: 500,
            color: done ? T.muted : T.text,
            textDecoration: done ? 'line-through' : 'none',
          }}>
            {routine.name}
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

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ color: T.muted, fontSize: 16, padding: '4px 8px', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          ›
        </button>
      </div>

      {expanded && (
        <div>
          <MiniCalendar routine={routine} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => onEdit(routine)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 13,
                background: '#2C2C2E', color: T.muted,
              }}
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(routine.id)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 13,
                background: '#3A1C1C', color: T.red,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
