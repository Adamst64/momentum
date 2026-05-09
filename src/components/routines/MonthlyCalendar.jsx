import React, { useState } from 'react';
import { T } from '../../theme';
import { getDaysInMonth, getFirstDOW, formatMonthYear, toDateStr, todayStr, parseDate, DAYS_SHORT } from '../../utils/dateUtils';
import { completionColor } from '../../utils/colors';

export default function MonthlyCalendar({ dayRatio, onDayClick, minEditableDate }) {
  const today     = todayStr();
  const todayDate = parseDate(today);
  const [year, setYear]   = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());

  const dim      = getDaysInMonth(year, month);
  const firstDow = getFirstDOW(year, month);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  const prev = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const next = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16 }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button type="button" onClick={prev} style={{ color: T.muted, fontSize: 20, padding: '4px 10px' }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{formatMonthYear(year, month)}</span>
        <button type="button" onClick={next} style={{ color: T.muted, fontSize: 20, padding: '4px 10px' }}>›</button>
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: T.muted }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;

          const dateStr   = toDateStr(new Date(year, month, day));
          const isToday   = dateStr === today;
          const isFuture  = dateStr > today;
          const isEditable = !isFuture && (!minEditableDate || dateStr >= minEditableDate);
          const ratio     = isFuture ? null : dayRatio(dateStr);
          const hasData  = ratio !== null;

          // Fill height: 0% completion = 0px (empty), 1-100% = proportional
          // A tiny 3px baseline shows for 0%-but-tracked days
          const fillH      = hasData && ratio > 0 ? ratio : 0;
          const showBase   = hasData && ratio === 0;
          const fillColor  = hasData ? completionColor(ratio) : null;
          // Text goes white once fill rises past ~80% of cell height
          const textWhite  = hasData && ratio >= 0.82;

          return (
            <div
              key={day}
              onClick={() => isEditable && onDayClick && onDayClick(dateStr)}
              style={{
                aspectRatio: '1',
                borderRadius: 7,
                border: isToday
                  ? `1.5px solid ${T.khaki}`
                  : `1.5px solid ${hasData ? fillColor + '30' : 'transparent'}`,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: 3,
                background: T.bg,
                cursor: isEditable ? 'pointer' : 'default',
              }}
            >
              {/* Water fill — rises from bottom */}
              {hasData && fillH > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0,
                  height: `${fillH * 100}%`,
                  background: fillColor,
                  transition: 'height 0.5s ease',
                }} />
              )}

              {/* Zero-completion baseline */}
              {showBase && (
                <div style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0,
                  height: 3,
                  background: '#FF453A',
                  opacity: 0.7,
                }} />
              )}

              {/* Date number — sits above the fill */}
              <span style={{
                position: 'relative', zIndex: 1,
                fontSize: 11,
                fontWeight: isToday ? 700 : 400,
                color: textWhite
                  ? '#fff'
                  : isFuture
                    ? T.subtle
                    : hasData ? T.text : T.muted,
              }}>
                {day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend — bars instead of dots to match the fill style */}
      <div style={{ display: 'flex', gap: 14, marginTop: 14, justifyContent: 'center' }}>
        {[['#FF453A', 'None'], ['#C8B87A', 'Partial'], ['#6B7C3F', 'All']].map(([c, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 18, height: 3, borderRadius: 2, background: c }} />
            <span style={{ fontSize: 10, color: T.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
