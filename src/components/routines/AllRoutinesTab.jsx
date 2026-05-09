import React, { useState } from 'react';
import { T } from '../../theme';
import CreateRoutineModal from './CreateRoutineModal';
import RoutineCalendarModal from './RoutineCalendarModal';
import DeleteRoutineSheet from './DeleteRoutineSheet';
import UndoToast from '../UndoToast';
import { DAYS_SHORT } from '../../utils/dateUtils';

function RoutineListRow({ routine, onShowCalendar, onRequestDelete, onEdit }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <div style={{
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 12, padding: '13px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => onShowCalendar(routine)}>
          <div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>{routine.name}</div>
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
            onClick={() => { onRequestDelete(routine); setShowMenu(false); }}
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
  const { routines, addRoutine, updateRoutine, deleteRoutine, archiveRoutine, unarchiveRoutine, restoreDeletedRoutine } = hook;
  const [showCreate, setShowCreate]    = useState(false);
  const [editing, setEditing]          = useState(null);
  const [calendarRoutine, setCalendar] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [undoState, setUndoState]        = useState(null);

  const sorted = [...routines].filter(r => !r.archived).sort((a, b) => a.name.localeCompare(b.name));

  const handleConfirmDelete = async (keepHistory) => {
    const routine = pendingDelete;
    setPendingDelete(null);
    if (keepHistory) {
      await archiveRoutine(routine.id);
      setUndoState({ type: 'archived', routine });
    } else {
      await deleteRoutine(routine.id);
      setUndoState({ type: 'deleted', routine });
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;
    if (undoState.type === 'archived') {
      await unarchiveRoutine(undoState.routine.id);
    } else {
      await restoreDeletedRoutine(undoState.routine);
    }
    setUndoState(null);
  };

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
          onRequestDelete={setPendingDelete}
          onEdit={() => setEditing(r)}
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

      {pendingDelete && (
        <DeleteRoutineSheet
          routine={pendingDelete}
          onKeepHistory={() => handleConfirmDelete(true)}
          onDeleteAll={() => handleConfirmDelete(false)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {undoState && (
        <UndoToast
          message={undoState.type === 'archived' ? `"${undoState.routine.name}" removed` : `"${undoState.routine.name}" deleted`}
          onUndo={handleUndo}
          onDismiss={() => setUndoState(null)}
        />
      )}
    </div>
  );
}
