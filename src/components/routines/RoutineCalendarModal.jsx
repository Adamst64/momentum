import React from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { getDaysInMonth, getFirstDOW, getDOW, toDateStr, todayStr, parseDate, formatMonthYear, DAYS_SHORT } from '../../utils/dateUtils';
import { getScheduleForDate } from '../../hooks/useRoutines';

function wasPausedOn(routine, dateStr) {
  if (routine.paused && routine.pausedAt && dateStr >= routine.pausedAt) return true;
  return (routine.pausedRanges || []).some(pr => dateStr >= pr.from && dateStr <= pr.to);
}

function getDayState(routine, dateStr, today) {
  if (routine.createdAt && dateStr < routine.createdAt) return 'pre';
  if (dateStr > today) return 'future';
  const dow      = getDOW(dateStr);
  const schedule = getScheduleForDate(routine, dateStr);
  if (!schedule.includes(dow)) return 'off';
  if (wasPausedOn(routine, dateStr)) return 'off';
  return routine.completions?.[dateStr] ? 'done' : 'missed';
}

function MonthBlock({ routine, year, month, today }) {
  const dim      = getDaysInMonth(year, month);
  const firstDow = getFirstDOW(year, month);
  const cells    = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++)     cells.push(d);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>
        {formatMonthYear(year, month)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 3 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, color: T.muted }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateStr = toDateStr(new Date(year, month, day));
          const state   = getDayState(routine, dateStr, today);
          const isToday = dateStr === today;

          let bg    = 'transparent';
          let color = T.subtle;
          if (state === 'done')   { bg = '#2A3A1A'; color = T.oliveLight; }
          if (state === 'missed') { bg = '#3A1C1C'; color = T.red; }

          return (
            <div key={day} style={{
              aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 5, background: bg,
              border: `1.5px solid ${isToday ? T.khaki : 'transparent'}`,
              fontSize: 11, color,
              fontWeight: isToday ? 700 : 400,
            }}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RoutineCalendarModal({ routine, onClose }) {
  const today       = todayStr();
  const createdDate = routine.createdAt ? parseDate(routine.createdAt) : parseDate(today);
  const todayDate   = parseDate(today);

  // Months newest-first, from today back to creation month
  const months = [];
  let y = todayDate.getFullYear(), m = todayDate.getMonth();
  const endY = createdDate.getFullYear(), endM = createdDate.getMonth();
  while (y > endY || (y === endY && m >= endM)) {
    months.push({ year: y, month: m });
    if (m === 0) { m = 11; y--; } else m--;
  }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
        borderBottom: `1px solid ${T.cardBorder}`,
      }}>
        <button onClick={onClose} style={{ color: T.khaki, fontSize: 22, lineHeight: 1, padding: '2px 0' }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{routine.name}</span>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
      }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[['#2A3A1A', T.oliveLight, 'Done'], ['#3A1C1C', T.red, 'Missed']].map(([bg, c, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${c}` }} />
              <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
            </div>
          ))}
        </div>

        {months.map(({ year, month }) => (
          <MonthBlock
            key={`${year}-${month}`}
            routine={routine}
            year={year}
            month={month}
            today={today}
          />
        ))}
      </div>
    </div>,
    document.body
  );
}
