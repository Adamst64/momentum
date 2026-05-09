import React, { useState } from 'react';
import { T } from '../../theme';
import CreateRoutineModal from './CreateRoutineModal';
import RoutineCalendarModal from './RoutineCalendarModal';
import { DAYS_SHORT } from '../../utils/dateUtils';

function RoutineListRow({ routine, onShowCalendar, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <div style={{
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 12, padding: '13px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => onShowCalendar(routine)}>
          <div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>
            {routine.name}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
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

        <button
          type="button"
          onClick={() => setShowMenu(m => !m)}
          style={{ color: T.muted, fontSize: 18, padding: '4px 6px', lineHeight: 1, flexShrink: 0 }}
        >
          ···
        </button>
      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -6,
        }}>
          <button
            type="button"
            onClick={() => { onEdit(); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.text, borderBottom: `1px solid ${T.cardBorder}` }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => { onDelete(); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}

export default function AllRoutinesTab({ hook }) {
  const { routines, addRoutine, updateRoutine, deleteRoutine } = hook;
  const [showCreate, setShowCreate]    = useState(false);
  const [editing, setEditing]          = useState(null);
  const [calendarRoutine, setCalendar] = useState(null);

  const sorted = [...routines].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.length === 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: '32px 16px', textAlign: 'center',
          color: T.muted, fontSize: 14,
        }}>
          No routines yet
        </div>
      )}

      {sorted.map(r => (
        <RoutineListRow
          key={r.id}
          routine={r}
          onShowCalendar={setCalendar}
          onEdit={() => setEditing(r)}
          onDelete={() => deleteRoutine(r.id)}
        />
      ))}

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
