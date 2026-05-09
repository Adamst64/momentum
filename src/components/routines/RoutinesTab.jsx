import React, { useState, useCallback } from 'react';
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
import Modal from '../Modal';
import { formatLongDate, todayStr, getDOW, addDays } from '../../utils/dateUtils';

export default function RoutinesTab({ hook, endDayHook }) {
  const {
    routines, addRoutine, updateRoutine,
    deleteRoutine, archiveRoutine, unarchiveRoutine, restoreDeletedRoutine,
    toggleDay, todayStats, dayRatio, forDate,
  } = hook;
  const { endDay, isDayEnded } = endDayHook;

  const calendarDayRatio = useCallback((dateStr) => {
    if (dateStr > todayStr()) return null;
    return dayRatio(dateStr);
  }, [dayRatio]);

  const [showCreate, setShowCreate]           = useState(false);
  const [editing, setEditing]                 = useState(null);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [selectedDay, setSelectedDay]         = useState(null);
  const [showAllRoutines, setShowAllRoutines] = useState(false);
  const [calendarRoutine, setCalendarRoutine] = useState(null);
  const [pendingDelete, setPendingDelete]     = useState(null);
  const [undoState, setUndoState]             = useState(null);

  const today    = todayStr();
  const tomorrow = addDays(today, 1);
  const dayEnded = isDayEnded(today);
  const stats    = todayStats();
  const dow      = getDOW(today);

  const sorted = [...routines]
    .filter(r => !r.archived && r.days.includes(dow))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tomorrowRoutines = forDate(tomorrow)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleEndDay = () => { endDay(today); setShowConfirm(false); };

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

      {!dayEnded ? (
        <>
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

          {/* All Routines nav — below today's list */}
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

          {/* End Day */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            style={{
              padding: '14px 20px', borderRadius: 14,
              border: `1.5px solid ${T.subtle}`,
              color: T.muted, fontSize: 15, fontWeight: 600,
              background: 'transparent', letterSpacing: 0.2,
            }}
          >
            End Day
          </button>
        </>
      ) : (
        <>
          {/* Day ended banner */}
          <div style={{
            background: '#1A2410', border: `1px solid ${T.olive}50`,
            borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: T.olive + '30',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: T.oliveLight, flexShrink: 0,
            }}>✓</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.oliveLight }}>Day complete</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Progress saved to monthly calendar</div>
            </div>
          </div>

          {/* Tomorrow preview */}
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Tomorrow — {formatLongDate(tomorrow)}
            </div>
            {tomorrowRoutines.length === 0 ? (
              <div style={{
                background: T.card, border: `1px solid ${T.cardBorder}`,
                borderRadius: 14, padding: '24px 16px', textAlign: 'center',
                color: T.muted, fontSize: 14,
              }}>
                No routines scheduled for tomorrow
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tomorrowRoutines.map(r => (
                  <div key={r.id} style={{
                    background: T.card, border: `1px solid ${T.cardBorder}`,
                    borderRadius: 14, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12, opacity: 0.55,
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${T.subtle}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: T.text }}>{r.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Routines nav — also available when day ended */}
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
        </>
      )}

      {/* Monthly calendar */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          Monthly Overview
        </div>
        <MonthlyCalendar dayRatio={calendarDayRatio} onDayClick={setSelectedDay} minEditableDate={addDays(today, -6)} />
      </div>

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

      {/* End Day confirmation */}
      {showConfirm && (
        <Modal title="End Day?" onClose={() => setShowConfirm(false)}>
          <div style={{ fontSize: 14, color: T.muted, marginBottom: 24, lineHeight: 1.6 }}>
            This will close out today and show tomorrow's routines. Your progress is already saved.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" onClick={handleEndDay} style={{ padding: '14px 20px', borderRadius: 14, background: T.olive, color: '#fff', fontSize: 16, fontWeight: 600 }}>
              End Day
            </button>
            <button type="button" onClick={() => setShowConfirm(false)} style={{ padding: '14px 20px', borderRadius: 14, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.muted, fontSize: 15 }}>
              Cancel
            </button>
          </div>
        </Modal>
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
