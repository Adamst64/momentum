import React, { useState, useMemo, useEffect } from 'react';
import { T } from '../../theme';
import WorkDayForm from './WorkDayForm';
import WorkCalendar from './WorkCalendar';
import WorkPaySection from './WorkPaySection';
import CrewManager from './CrewManager';
import WeeklyTexts from './WeeklyTexts';
import { formatDayFull } from '../../utils/workUtils';
import { useBackHandler } from '../../hooks/useBackHandler';
import { FULL_PAGE } from '../../utils/pageStyle';
import TabBar, { ICONS, scrollToTop } from '../TabBar';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const VIEWS = ['today', 'calendar', 'pay'];

export default function WorkTab({ hook, requestedView }) {
  const { days, weeks, crews, members, saveDay, deleteDay, setWeekPayment, setTripPay, addCrew, updateCrewColor, updateCrewPhone, markCrewTexted, deleteCrew, addMember, deleteMember, reorderCrews, reorderMembers } = hook;
  const [view, setView]                 = useState(() => VIEWS.includes(requestedView?.view) ? requestedView.view : 'today');
  // A notification (e.g. the Friday weekly texts reminder) can ask for a view
  useEffect(() => {
    if (VIEWS.includes(requestedView?.view)) setView(requestedView.view);
  }, [requestedView?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedDay, setSelectedDay]   = useState(null);
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [showCrewMgr, setShowCrewMgr]   = useState(false);
  useBackHandler(showDaySheet, () => setShowDaySheet(false));

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

      {/* Today · Calendar · Pay along the bottom; Crews opens its page */}
      <TabBar
        items={[
          { value: 'today', label: 'Today', icon: ICONS.today },
          { value: 'calendar', label: 'Calendar', icon: ICONS.calendar },
          { value: 'pay', label: 'Pay', icon: ICONS.money },
          { value: 'crews', label: 'Crews', icon: ICONS.people, onPress: () => setShowCrewMgr(true) },
        ]}
        value={view} onChange={v => { setView(v); scrollToTop(); }}
      />

      {view === 'today' && (
        <>
          <span style={{ fontSize: 14, color: T.muted }}>{formatDayFull(today)}</span>
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
        <WorkCalendar days={days} weeks={weeks} crews={crews} onSelectDay={handleCalendarSelect} />
      )}

      {view === 'pay' && (
        <WeeklyTexts days={days} crews={crews} members={members} weeks={weeks} today={today} onTexted={markCrewTexted} />
      )}

      {view === 'pay' && (
        <WorkPaySection
          days={days}
          weeks={weeks}
          crews={crews}
          onSetPayment={setWeekPayment}
          onSetTripPay={setTripPay}
        />
      )}

      {/* Day sheet (opened from calendar) */}
      {showDaySheet && selectedDay && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 'var(--vv-top, 0px)', height: 'var(--vv-height, 100%)', zIndex: 100, background: '#000000AA' }} onClick={() => setShowDaySheet(false)}>
          <div
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: T.bg, borderRadius: '20px 20px 0 0', padding: '20px 20px 0', maxHeight: 'calc(var(--vv-height, 100vh) * 0.9)', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)', ...FULL_PAGE }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{formatDayFull(selectedDay)}</span>
            </div>
            <WorkDayForm
              dateStr={selectedDay}
              initial={dayMap[selectedDay] || null}
              crews={crews}
              members={members}
              onSave={(ds, data) => { saveDay(ds, data); setShowDaySheet(false); }}
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
          onUpdateCrewColor={updateCrewColor}
          onUpdateCrewPhone={updateCrewPhone}
          onAddMember={addMember}
          onDeleteMember={deleteMember}
          onReorderCrews={reorderCrews}
          onReorderMembers={reorderMembers}
          onClose={() => setShowCrewMgr(false)}
        />
      )}
    </div>
  );
}
