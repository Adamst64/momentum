import React, { useState, useMemo } from 'react';
import { T } from '../../theme';
import CreateRoutineModal from './CreateRoutineModal';
import RoutineCalendarModal from './RoutineCalendarModal';
import DeleteRoutineSheet from './DeleteRoutineSheet';
import UndoToast from '../UndoToast';
import { DAYS_SHORT } from '../../utils/dateUtils';

function RoutineListRow({ routine, onShowCalendar, onRequestDelete, onEdit, onPause, onUnpause }) {
  const [showMenu,     setShowMenu]     = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const isPaused = !!routine.paused;

  const handleToggle = () => {
    if (isPaused) {
      onUnpause(routine.id);
    } else {
      setShowMenu(false);
      setConfirmPause(true);
    }
  };

  return (
    <>
      <div style={{
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 12, padding: '13px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: isPaused ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}>
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => onShowCalendar(routine)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: T.text }}>{routine.name}</span>
            {isPaused && (
              <span style={{
                fontSize: 9, padding: '2px 5px', borderRadius: 4,
                background: T.subtle, color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
              }}>Paused</span>
            )}
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

        {/* On/Off toggle */}
        <button
          type="button"
          onClick={handleToggle}
          style={{
            width: 40, height: 24, borderRadius: 12, flexShrink: 0,
            background: isPaused ? T.subtle : T.olive,
            border: 'none', cursor: 'pointer', position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3,
            left: isPaused ? 3 : 19,
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
          }} />
        </button>

        <button
          type="button"
          onClick={() => setShowMenu(m => !m)}
          style={{ color: T.muted, fontSize: 18, padding: '4px 6px', lineHeight: 1, flexShrink: 0 }}
        >
          ···
        </button>
      </div>

      {confirmPause && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, padding: '12px 14px', marginTop: -4,
        }}>
          <span style={{ flex: 1, fontSize: 13, color: T.text }}>
            Pause <strong>{routine.name}</strong>? It won't appear in daily routines or affect progress.
          </span>
          <button
            type="button"
            onClick={() => setConfirmPause(false)}
            style={{ padding: '7px 12px', borderRadius: 8, background: T.subtle, color: T.muted, fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >Cancel</button>
          <button
            type="button"
            onClick={() => { onPause(routine.id); setConfirmPause(false); }}
            style={{ padding: '7px 12px', borderRadius: 8, background: T.olive, color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >Pause</button>
        </div>
      )}

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
  const { routines, addRoutine, updateRoutine, deleteRoutine, archiveRoutine, unarchiveRoutine, restoreDeletedRoutine, pauseRoutine, unpauseRoutine } = hook;
  const [showCreate, setShowCreate]    = useState(false);
  const [editing, setEditing]          = useState(null);
  const [calendarRoutine, setCalendar] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [undoState, setUndoState]        = useState(null);

  const sorted = useMemo(
    () => [...routines].filter(r => !r.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [routines]
  );

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
          onPause={pauseRoutine}
          onUnpause={unpauseRoutine}
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
