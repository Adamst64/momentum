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
import { getCompletionCount, getRequiredForDate } from '../../hooks/useRoutines';

export default function RoutinesTab({ hook, commitmentsHook }) {
  const {
    routines, addRoutine, updateRoutine,
    deleteRoutine, archiveRoutine, unarchiveRoutine, restoreDeletedRoutine,
    incrementDay, todayStats, dayRatio, forDate,
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
  const [calendarRoutineId, setCalendarRoutineId] = useState(null);
  const calendarRoutine = routines.find(r => r.id === calendarRoutineId) ?? null;
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
      const aDone = getCompletionCount(a, today) >= getRequiredForDate(a, today);
      const bDone = getCompletionCount(b, today) >= getRequiredForDate(b, today);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  const isDone  = r => getCompletionCount(r, today) >= getRequiredForDate(r, today);
  const todo     = sorted.filter(r => !isDone(r));
  const doneList = sorted.filter(isDone);

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

      {/* Today's progress */}
      <div style={{
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 16, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <DonutChart done={stats.done} total={stats.total} size={68} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
            {stats.total ? `${stats.done} of ${stats.total} done` : 'Nothing today'}
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>
            {stats.total > stats.done ? `${stats.total - stats.done} left · ` : stats.total ? 'All done · ' : ''}{formatLongDate(today)}
          </div>
        </div>
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
        [['Still to do', todo], ['Done', doneList]].map(([label, list]) => list.length > 0 && (
          <div key={label}>
            <div style={{ fontSize: 12, fontWeight: 700, color: label === 'Done' ? T.muted : '#A9BB6C', textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 0 8px 4px' }}>
              {label} <span style={{ color: T.subtle }}>({list.length})</span>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16 }}>
              {list.map((r, i) => (
                <RoutineItem
                  key={r.id}
                  first={i === 0}
                  routine={r}
                  onIncrement={id => incrementDay(id, today)}
                  onEdit={setEditing}
                  onRequestDelete={handleRequestDelete}
                  onShowCalendar={r => setCalendarRoutineId(r.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', marginTop: -8 }}>
        Tap a name for its history · hold for Edit / Delete
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

      {/* Space so the add button never covers the last row */}
      <div style={{ height: 56 }} />

      <button
        type="button"
        onClick={() => setShowCreate(true)}
        aria-label="Add routine"
        style={{
          position: 'fixed', zIndex: 45,
          right: 'max(20px, calc(50vw - 195px))', bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          width: 58, height: 58, borderRadius: 29, background: T.olive,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </button>

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
        <DayDetailModal
          dateStr={selectedDay}
          forDate={forDate}
          incrementDay={incrementDay}
          editable={selectedDay >= addDays(today, -6)}
          onClose={() => setSelectedDay(null)}
        />
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
        <RoutineCalendarModal routine={calendarRoutine} onClose={() => setCalendarRoutineId(null)} />
      )}

      {(showCreate || editing) && (
        <CreateRoutineModal
          initial={editing}
          onSave={(name, days, timesPerDay, timesPerDayByDow, startDate, pastCompletions) => {
            if (editing) updateRoutine(editing.id, name, days, timesPerDay, timesPerDayByDow);
            else addRoutine(name, days, timesPerDay, timesPerDayByDow, startDate, pastCompletions);
          }}
          onClose={() => { setShowCreate(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
