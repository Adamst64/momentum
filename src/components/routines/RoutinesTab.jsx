import React, { useState } from 'react';
import { T } from '../../theme';
import DonutChart from '../DonutChart';
import RoutineItem from './RoutineItem';
import CreateRoutineModal from './CreateRoutineModal';
import MonthlyCalendar from './MonthlyCalendar';
import DayDetailModal from './DayDetailModal';
import AllRoutinesTab from './AllRoutinesTab';
import RoutineCalendarModal from './RoutineCalendarModal';
import DeleteRoutineSheet from './DeleteRoutineSheet';
import UndoToast from '../UndoToast';
import CommitmentsTab from './CommitmentsTab';
import { formatLongDate, todayStr, getDOW, addDays } from '../../utils/dateUtils';

export default function RoutinesTab({ hook, commitmentsHook }) {
  const {
    routines, addRoutine, updateRoutine,
    deleteRoutine, archiveRoutine, unarchiveRoutine, restoreDeletedRoutine,
    toggleDay, todayStats, dayRatio, forDate,
  } = hook;

  const calendarDayRatio = (dateStr) => {
    if (dateStr > todayStr()) return null;
    return dayRatio(dateStr);
  };

  const [subTab, setSubTab]                   = useState('routines');
  const [showCreate, setShowCreate]           = useState(false);
  const [editing, setEditing]                 = useState(null);
  const [selectedDay, setSelectedDay]         = useState(null);
  const [showAllRoutines, setShowAllRoutines] = useState(false);
  const [calendarRoutine, setCalendarRoutine] = useState(null);
  const [pendingDelete, setPendingDelete]     = useState(null);
  const [undoState, setUndoState]             = useState(null);

  const today = todayStr();
  const stats = todayStats();
  const dow   = getDOW(today);

  const sorted = [...routines]
    .filter(r => {
      if (r.archived || r.paused) return false;
      if (r.activeFrom && today < r.activeFrom) return false;
      return r.days.includes(dow);
    })
    .sort((a, b) => {
      const aDone = !!a.completions?.[today];
      const bDone = !!b.completions?.[today];
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  const handleRequestDelete = (routine) => setPendingDelete(routine);

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
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Sub-tab switcher */}
      <div style={{
        display: 'flex', gap: 4, background: T.card,
        border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 4,
      }}>
        {[['routines', 'Routines'], ['commitments', 'Commitments']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: subTab === id ? T.olive : 'transparent',
              color: subTab === id ? '#fff' : T.muted,
              transition: 'background 0.15s, color 0.15s',
            }}
          >{label}</button>
        ))}
      </div>

      {subTab === 'commitments' && <CommitmentsTab hook={commitmentsHook} />}

      {subTab === 'routines' && <>

      {/* Header card */}
      <div style={{
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 16, padding: '20px',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <DonutChart done={stats.done} total={stats.total} />
        <div>
          <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
            Today's Progress
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>
            {stats.done}/{stats.total}
            <span style={{ fontSize: 14, color: T.muted, fontWeight: 400, marginLeft: 6 }}>done</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{formatLongDate(today)}</div>
        </div>
      </div>

      {/* Add routine */}
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 14, borderRadius: 14,
          border: `1.5px dashed ${T.cardBorder}`,
          color: T.muted, fontSize: 15, background: 'transparent',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Routine
      </button>

      {/* Today's routines */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          Routines
          {sorted.length > 0 && (
            <span style={{ color: T.subtle, marginLeft: 6 }}>({sorted.length})</span>
          )}
        </div>

        {sorted.length === 0 ? (
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '24px 16px', textAlign: 'center',
            color: T.muted, fontSize: 14,
          }}>
            No routines scheduled for today
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map(r => (
              <RoutineItem
                key={r.id}
                routine={r}
                onToggle={id => toggleDay(id, today)}
                onEdit={setEditing}
                onRequestDelete={handleRequestDelete}
                onShowCalendar={setCalendarRoutine}
              />
            ))}
          </div>
        )}
      </div>

      {/* All Routines nav */}
      <button
        type="button"
        onClick={() => setShowAllRoutines(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px', borderRadius: 12,
          background: T.card, border: `1px solid ${T.cardBorder}`,
          color: T.text, fontSize: 14, fontWeight: 500,
        }}
      >
        <span>All Routines</span>
        <span style={{ color: T.muted, fontSize: 18 }}>›</span>
      </button>

      {/* Monthly calendar */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          Monthly Overview
        </div>
        <MonthlyCalendar dayRatio={calendarDayRatio} onDayClick={setSelectedDay} minEditableDate={addDays(today, -6)} />
      </div>

      </>}

      {/* All Routines overlay */}
      {showAllRoutines && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: T.bg, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
            padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
            borderBottom: `1px solid ${T.cardBorder}`,
          }}>
            <button onClick={() => setShowAllRoutines(false)} style={{ color: T.khaki, fontSize: 22, lineHeight: 1, padding: '2px 0' }}>←</button>
            <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>All Routines</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16, paddingBottom: `calc(env(safe-area-inset-bottom) + 16px)` }}>
            <AllRoutinesTab hook={hook} />
          </div>
        </div>
      )}

      {selectedDay && (
        <DayDetailModal dateStr={selectedDay} forDate={forDate} toggleDay={toggleDay} onClose={() => setSelectedDay(null)} />
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

      {calendarRoutine && (
        <RoutineCalendarModal routine={calendarRoutine} onClose={() => setCalendarRoutine(null)} />
      )}

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
    </div>
  );
}
