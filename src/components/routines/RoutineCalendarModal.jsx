import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { getDaysInMonth, getFirstDOW, getDOW, toDateStr, todayStr, parseDate, formatMonthYear, formatShortDate, DAYS_SHORT } from '../../utils/dateUtils';
import { getScheduleForDate, getCompletionCount, getRequiredForDate } from '../../hooks/useRoutines';
import { useSwipe, animateSlide } from '../../hooks/useSwipe';

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
  let progress = 0, total = 0, greenDays = 0, partialDays = 0, redDays = 0;
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
      total++; redDays++;
    }
    d.setDate(d.getDate() + 1);
  }
  return { progress, total, pct: total > 0 ? Math.round(progress / total * 100) : null, greenDays, partialDays, redDays };
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

function MonthGrid({ routine, year, month, today, gridRef }) {
  const dim      = getDaysInMonth(year, month);
  const firstDow = getFirstDOW(year, month);
  const cells    = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++)     cells.push(d);

  return (
    <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
      {cells.map((day, i) => {
        if (!day) return <div key={`e${i}`} />;
        const dateStr = toDateStr(new Date(year, month, day));
        const state   = getDayState(routine, dateStr, today);
        const isToday = dateStr === today;

        let bg    = 'transparent';
        let color = T.subtle;
        if (state === 'off')     { color = T.text; }
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
  );
}

export default function RoutineCalendarModal({ routine, onClose }) {
  const today       = todayStr();
  const todayDate   = parseDate(today);
  const createdDate = routine.createdAt ? parseDate(routine.createdAt) : todayDate;

  const [year,  setYear]  = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());

  const gridRef = useRef(null);

  const canGoPrev = year > createdDate.getFullYear() || (year === createdDate.getFullYear() && month > createdDate.getMonth());
  const canGoNext = year < todayDate.getFullYear()   || (year === todayDate.getFullYear()   && month < todayDate.getMonth());

  const prev = () => {
    if (!canGoPrev) return;
    animateSlide(gridRef.current, 'prev');
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  };
  const next = () => {
    if (!canGoNext) return;
    animateSlide(gridRef.current, 'next');
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  };

  const swipeRef = useSwipe(next, prev);

  const stats  = computeStats(routine, today);
  const streak = computeStreak(routine, today);
  const isMulti = (routine.timesPerDay ?? 1) > 1 || Object.keys(routine.timesPerDayByDow || {}).length > 0;

  const legend = [
    ['#2A3A1A', T.oliveLight, 'Done'],
    ...(isMulti ? [['#3A2800', ORANGE, 'Partial']] : []),
    ['#3A2E00', T.khaki, 'Today'],
    ['#3A1C1C', T.red, 'Missed'],
  ];

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
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
            display: 'flex', alignItems: 'center',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.oliveLight, lineHeight: 1 }}>{stats.pct}%</div>
              {isMulti ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>
                    {stats.total} total day{stats.total !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { bg: '#2A3A1A', color: T.oliveLight, count: stats.greenDays },
                      { bg: '#3A2800', color: ORANGE,       count: stats.partialDays },
                      { bg: '#3A1C1C', color: T.red,        count: stats.redDays },
                    ].map(({ bg, color, count }) => (
                      <div key={color} style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: bg, border: `1px solid ${color}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700, color,
                      }}>
                        {count}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginTop: 4 }}>
                  {stats.greenDays}/{stats.total} days done
                </div>
              )}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
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

        {/* Month navigator */}
        <div ref={swipeRef} style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: '14px 16px',
        }}>
          {/* Month header with arrows */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              type="button"
              onClick={prev}
              style={{ fontSize: 22, color: canGoPrev ? T.muted : T.subtle, padding: '2px 8px', lineHeight: 1 }}
            >‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{formatMonthYear(year, month)}</span>
            <button
              type="button"
              onClick={next}
              style={{ fontSize: 22, color: canGoNext ? T.muted : T.subtle, padding: '2px 8px', lineHeight: 1 }}
            >›</button>
          </div>

          {/* Day-of-week labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 6 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 9, color: T.muted }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ overflow: 'hidden' }}>
            <MonthGrid routine={routine} year={year} month={month} today={today} gridRef={gridRef} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
            {legend.map(([bg, c, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${c}` }} />
                <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
