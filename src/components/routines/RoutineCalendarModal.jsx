import React from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { getDaysInMonth, getFirstDOW, getDOW, toDateStr, todayStr, parseDate, formatMonthYear, formatShortDate, DAYS_SHORT } from '../../utils/dateUtils';
import { getScheduleForDate, getCompletionCount, getRequiredForDate } from '../../hooks/useRoutines';

const ORANGE = '#FF9F0A';

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
  const required = getRequiredForDate(routine, dateStr);
  const count    = getCompletionCount(routine, dateStr);
  if (count >= required) return 'done';
  if (count > 0)         return 'partial';
  if (dateStr === today) return 'pending';
  return 'missed';
}

function computeStats(routine, today) {
  const created = routine.createdAt || today;
  let progress = 0, total = 0, greenDays = 0, partialDays = 0;
  let d = new Date(created + 'T12:00:00');
  const end = new Date(today + 'T12:00:00');
  while (d <= end) {
    const ds    = d.toISOString().slice(0, 10);
    const state = getDayState(routine, ds, today);
    if (state === 'done') {
      progress += 1; total++; greenDays++;
    } else if (state === 'partial') {
      const required = getRequiredForDate(routine, ds);
      const count    = getCompletionCount(routine, ds);
      progress += count / required;
      total++; partialDays++;
    } else if (state === 'missed') {
      total++;
    }
    d.setDate(d.getDate() + 1);
  }
  return { progress, total, pct: total > 0 ? Math.round(progress / total * 100) : null, greenDays, partialDays };
}

function computeStreak(routine, today) {
  const created = routine.createdAt || today;
  let streak = 0;
  let d = new Date(today + 'T12:00:00');
  while (true) {
    const ds    = d.toISOString().slice(0, 10);
    if (ds < created) break;
    const state = getDayState(routine, ds, today);
    if (state === 'done') {
      streak++;
    } else if (state === 'missed' || state === 'partial') {
      if (ds === today) { /* day not over — skip without breaking */ }
      else break;
    }
    d.setDate(d.getDate() - 1);
    if (streak > 3650) break;
  }
  return streak;
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
          if (state === 'done')    { bg = '#2A3A1A'; color = T.oliveLight; }
          if (state === 'partial') { bg = '#3A2800'; color = ORANGE; }
          if (state === 'missed')  { bg = '#3A1C1C'; color = T.red; }
          if (state === 'pending') { bg = '#3A2E00'; color = T.khaki; }

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
  const stats  = computeStats(routine, today);
  const streak = computeStreak(routine, today);

  // Months newest-first, from today back to creation month
  const months = [];
  let y = todayDate.getFullYear(), m = todayDate.getMonth();
  const endY = createdDate.getFullYear(), endM = createdDate.getMonth();
  while (y > endY || (y === endY && m >= endM)) {
    months.push({ year: y, month: m });
    if (m === 0) { m = 11; y--; } else m--;
  }

  const isMulti = (routine.timesPerDay ?? 1) > 1 || Object.keys(routine.timesPerDayByDow || {}).length > 0;

  const legend = [
    ['#2A3A1A', T.oliveLight, 'Done'],
    ...(isMulti ? [['#3A2800', ORANGE, 'Partial']] : []),
    ['#3A2E00', T.khaki, 'Today'],
    ['#3A1C1C', T.red, 'Missed'],
  ];

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

        {/* Stats */}
        {stats.pct !== null && (
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '14px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 0,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.oliveLight, lineHeight: 1 }}>{stats.pct}%</div>
              {isMulti ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.oliveLight }}>
                    {stats.greenDays} green day{stats.greenDays !== 1 ? 's' : ''}
                  </div>
                  {stats.partialDays > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 500, color: ORANGE }}>
                      {stats.partialDays} orange day{stats.partialDays !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginTop: 4 }}>
                  {stats.greenDays}/{stats.total} days done
                </div>
              )}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                since {formatShortDate(routine.createdAt || today)}
              </div>
            </div>
            <div style={{ width: 1, background: T.cardBorder, alignSelf: 'stretch', margin: '0 18px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.oliveLight, lineHeight: 1 }}>{streak}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginTop: 4 }}>day streak</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>consecutive done</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {legend.map(([bg, c, label]) => (
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
