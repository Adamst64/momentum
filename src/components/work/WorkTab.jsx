import React, { useState, useMemo } from 'react';
import { T } from '../../theme';
import WorkDayForm from './WorkDayForm';
import WorkCalendar from './WorkCalendar';
import WorkPaySection from './WorkPaySection';
import CrewManager from './CrewManager';
import { formatDayFull } from '../../utils/workUtils';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function WorkTab({ hook }) {
  const { days, weeks, crews, members, saveDay, deleteDay, setWeekPaid, addCrew, deleteCrew, addMember, deleteMember } = hook;
  const [view, setView]                 = useState('today');
  const [selectedDay, setSelectedDay]   = useState(null);
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [showCrewMgr, setShowCrewMgr]   = useState(false);

  const today = todayStr();

  const dayMap = useMemo(() => {
    const m = {};
    days.forEach(d => { m[d.id] = d; });
    return m;
  }, [days]);

  const handleCalendarSelect = (ds) => {
    setSelectedDay(ds);
    setShowDaySheet(true);
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Inner tabs */}
      <div style={{ display: 'flex', background: T.subtle, borderRadius: 10, padding: 3, gap: 2 }}>
        {[['today', 'Today'], ['calendar', 'Calendar'], ['pay', 'Pay']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '7px 0', borderRadius: 8,
            background: view === v ? T.card : 'transparent',
            color: view === v ? T.text : T.muted,
            fontSize: 13, fontWeight: 600, transition: 'background 0.15s, color 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {view === 'today' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: T.muted }}>{formatDayFull(today)}</span>
            <button onClick={() => setShowCrewMgr(true)} style={{ fontSize: 13, color: T.oliveLight, fontWeight: 600 }}>
              Manage Crews
            </button>
          </div>
          <WorkDayForm
            dateStr={today}
            initial={dayMap[today] || null}
            crews={crews}
            members={members}
            onSave={saveDay}
            onDelete={deleteDay}
          />
        </>
      )}

      {view === 'calendar' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCrewMgr(true)} style={{ fontSize: 13, color: T.oliveLight, fontWeight: 600 }}>
              Manage Crews
            </button>
          </div>
          <WorkCalendar days={days} onSelectDay={handleCalendarSelect} />
        </>
      )}

      {view === 'pay' && (
        <WorkPaySection
          days={days}
          weeks={weeks}
          crews={crews}
          onSetPaid={setWeekPaid}
        />
      )}

      {/* Day sheet (opened from calendar) */}
      {showDaySheet && selectedDay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#000000AA' }} onClick={() => setShowDaySheet(false)}>
          <div
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: T.bg, borderRadius: '20px 20px 0 0', padding: '20px 20px 0', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{formatDayFull(selectedDay)}</span>
              <button onClick={() => setShowDaySheet(false)} style={{ color: T.muted, fontSize: 24, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
            <WorkDayForm
              dateStr={selectedDay}
              initial={dayMap[selectedDay] || null}
              crews={crews}
              members={members}
              onSave={async (ds, data) => { await saveDay(ds, data); setShowDaySheet(false); }}
              onDelete={async (ds) => { await deleteDay(ds); setShowDaySheet(false); }}
            />
            <div style={{ height: 24 }} />
          </div>
        </div>
      )}

      {showCrewMgr && (
        <CrewManager
          crews={crews}
          members={members}
          onAddCrew={addCrew}
          onDeleteCrew={deleteCrew}
          onAddMember={addMember}
          onDeleteMember={deleteMember}
          onClose={() => setShowCrewMgr(false)}
        />
      )}
    </div>
  );
}
