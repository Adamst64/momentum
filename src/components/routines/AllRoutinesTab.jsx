import React, { useState } from 'react';
import { T } from '../../theme';
import CreateRoutineModal from './CreateRoutineModal';
import RoutineCalendarModal from './RoutineCalendarModal';
import { todayStr, parseDate, toDateStr, getDOW, DAYS_FULL } from '../../utils/dateUtils';

function getWeekDates(virtualToday) {
  const base   = parseDate(virtualToday);
  const dow    = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() + (dow === 0 ? -6 : 1 - dow));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });
}

function RoutineRow({ routine, dateStr, isToday, isPast, onToggle, onEdit, onDelete, onShowCalendar }) {
  const [showMenu, setShowMenu] = useState(false);
  const done = !!routine.completions[dateStr];

  return (
    <>
      <div style={{
        padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderTop: `1px solid ${T.cardBorder}`,
      }}>
        {/* Status */}
        {isToday ? (
          <button
            type="button"
            onClick={onToggle}
            style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${done ? T.olive : T.muted}`,
              background: done ? T.olive : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {done && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ) : isPast ? (
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: done ? '#2A3A1A' : '#3A1C1C',
            border: `1px solid ${done ? T.olive : T.red}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: done ? T.olive : T.red }} />
          </div>
        ) : (
          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `1px dashed ${T.subtle}` }} />
        )}

        {/* Name — tap to open calendar */}
        <span
          style={{
            flex: 1, fontSize: 14,
            color: done && isPast ? T.muted : T.text,
            textDecoration: done && isPast ? 'line-through' : 'none',
          }}
          onClick={() => onShowCalendar(routine)}
        >
          {routine.name}
        </span>

        <button
          type="button"
          onClick={() => setShowMenu(m => !m)}
          style={{ color: T.muted, fontSize: 16, padding: '4px 6px', lineHeight: 1 }}
        >
          ···
        </button>
      </div>

      {showMenu && (
        <div style={{ background: '#252527', borderTop: `1px solid ${T.cardBorder}` }}>
          <button
            type="button"
            onClick={() => { onEdit(); setShowMenu(false); }}
            style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14, color: T.text, borderBottom: `1px solid ${T.cardBorder}` }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => { onDelete(); setShowMenu(false); }}
            style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14, color: T.red }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}

export default function AllRoutinesTab({ hook }) {
  const { routines, addRoutine, updateRoutine, deleteRoutine, toggleDay, forDate } = hook;
  const [showCreate, setShowCreate]     = useState(false);
  const [editing, setEditing]           = useState(null);
  const [calendarRoutine, setCalendar]  = useState(null);

  const today     = todayStr();
  const weekDates = getWeekDates(today);

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
        This Week
      </div>

      {weekDates.map(dateStr => {
        const dow         = getDOW(dateStr);
        const isToday     = dateStr === today;
        const isPast      = dateStr < today;
        const dayRoutines = forDate(dateStr);
        const doneCount   = dayRoutines.filter(r => r.completions[dateStr]).length;
        const dateLabel   = parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <div
            key={dateStr}
            style={{
              background: T.card,
              border: `1.5px solid ${isToday ? T.khaki : T.cardBorder}`,
              borderRadius: 14, overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '10px 14px',
              background: isToday ? '#1E2E10' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? T.khaki : T.text }}>
                  {DAYS_FULL[dow]}
                </span>
                <span style={{ fontSize: 11, color: T.muted }}>{dateLabel}</span>
              </div>
              {dayRoutines.length > 0 && (
                <span style={{ fontSize: 11, color: isToday ? T.khaki : T.muted, fontWeight: isToday ? 600 : 400 }}>
                  {doneCount}/{dayRoutines.length}
                </span>
              )}
            </div>

            {dayRoutines.length === 0 ? (
              <div style={{
                padding: '10px 14px', borderTop: `1px solid ${T.cardBorder}`,
                color: T.subtle, fontSize: 13, fontStyle: 'italic',
              }}>
                Rest day
              </div>
            ) : (
              dayRoutines.map(r => (
                <RoutineRow
                  key={r.id}
                  routine={r}
                  dateStr={dateStr}
                  isToday={isToday}
                  isPast={isPast}
                  onToggle={() => toggleDay(r.id, dateStr)}
                  onEdit={() => setEditing(r)}
                  onDelete={() => deleteRoutine(r.id)}
                  onShowCalendar={setCalendar}
                />
              ))
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setShowCreate(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 14, borderRadius: 14, marginTop: 4,
          border: `1.5px dashed ${T.cardBorder}`,
          color: T.muted, fontSize: 15, background: 'transparent',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Routine
      </button>

      {(showCreate || editing) && (
        <CreateRoutineModal
          initial={editing}
          onSave={(name, days) => {
            if (editing) updateRoutine(editing.id, name, days);
            else addRoutine(name, days);
          }}
          onClose={() => { setShowCreate(false); setEditing(null); }}
        />
      )}

      {calendarRoutine && (
        <RoutineCalendarModal routine={calendarRoutine} onClose={() => setCalendar(null)} />
      )}
    </div>
  );
}
