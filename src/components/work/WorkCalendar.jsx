import React, { useState } from 'react';
import { T } from '../../theme';
import { getMondayId, parsePayEntry } from '../../utils/workUtils';

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function mondayOffset(year, month) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

function pad(n) { return String(n).padStart(2, '0'); }

export default function WorkCalendar({ days, weeks, crews, onSelectDay }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(null);

  const prevMonth = () => month === 1 ? (setMonth(12), setYear(y => y - 1)) : setMonth(m => m - 1);
  const nextMonth = () => month === 12 ? (setMonth(1),  setYear(y => y + 1)) : setMonth(m => m + 1);

  const offset      = mondayOffset(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dayMap = {};
  days.forEach(d => { dayMap[d.id] = d; });

  const crewColorMap = {};
  (crews || []).forEach(c => { crewColorMap[c.id] = c.color; });

  const weeksMap = {};
  (weeks || []).forEach(w => { weeksMap[w.id] = w; });

  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const handleSelect = (day) => {
    const ds = `${year}-${pad(month)}-${pad(day)}`;
    setSelected(ds);
    onSelectDay(ds);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prevMonth} style={{ color: T.muted, fontSize: 24, padding: '4px 10px', lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{MONTH_FULL[month - 1]} {year}</span>
        <button onClick={nextMonth} style={{ color: T.muted, fontSize: 24, padding: '4px 10px', lineHeight: 1 }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: T.muted, fontWeight: 600, paddingBottom: 6 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds        = `${year}-${pad(month)}-${pad(day)}`;
          const entry     = dayMap[ds];
          const isToday   = ds === todayStr;
          const isSel     = ds === selected;
          const isOff     = entry?.isOff;
          const isLead    = entry?.isCrewLead;
          const crewColor = entry?.crewId ? crewColorMap[entry.crewId] : null;
          const hasEntry  = !!entry;

          const isWorkDay = hasEntry && !isOff && entry?.crewId;
          let isPaid = false;
          if (isWorkDay) {
            const mondayId = getMondayId(ds);
            const weekDoc  = weeksMap[mondayId] || {};
            const { paid } = parsePayEntry(weekDoc[entry.crewId]);
            isPaid = paid;
          }

          const bg = isSel
            ? (isOff ? T.red + '44' : crewColor ? crewColor + '44' : T.olive + '44')
            : isOff
              ? T.red + '22'
              : crewColor
                ? crewColor + '28'
                : hasEntry ? T.olive + '18' : 'transparent';

          const borderColor = isToday && !isWorkDay
            ? T.khaki + '88'
            : isSel
              ? (isOff ? T.red : crewColor || T.olive)
              : isWorkDay
                ? (isPaid ? T.green : T.red)
                : isOff
                  ? T.red + '55'
                  : hasEntry ? T.olive + '33' : 'transparent';

          const borderWidth = isWorkDay ? 2 : 1;

          const numColor = isToday
            ? T.khaki
            : isOff
              ? T.red
              : crewColor || (hasEntry ? T.oliveLight : T.text);

          return (
            <button
              key={i}
              onClick={() => handleSelect(day)}
              style={{ minHeight: 52, padding: '5px 2px 4px', borderRadius: 8, textAlign: 'center', position: 'relative', background: bg, border: `${borderWidth}px solid ${borderColor}` }}
            >
              {/* Crew lead indicator */}
              {isLead && (
                <div style={{ position: 'absolute', top: 3, right: 4, width: 5, height: 5, borderRadius: '50%', background: T.green }} />
              )}
              <div style={{ fontSize: 13, lineHeight: 1, color: numColor, fontWeight: isToday || hasEntry ? 700 : 400 }}>
                {day}
              </div>
              {hasEntry && !isOff && (
                <div style={{ fontSize: 8, color: crewColor || T.muted, marginTop: 3, lineHeight: 1.3, opacity: 0.9 }}>
                  {[entry.windows > 0 && `${entry.windows}w`, entry.doors > 0 && `${entry.doors}dr`].filter(Boolean).join(' ')}
                </div>
              )}
              {isOff && (
                <div style={{ fontSize: 8, color: T.red, marginTop: 3, lineHeight: 1.3, opacity: 0.8 }}>off</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green }} />
          <span style={{ fontSize: 11, color: T.muted }}>Crew lead</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'transparent', border: `2px solid ${T.green}` }} />
          <span style={{ fontSize: 11, color: T.muted }}>Paid</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'transparent', border: `2px solid ${T.red}` }} />
          <span style={{ fontSize: 11, color: T.muted }}>Unpaid</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: T.red + '44', border: `1px solid ${T.red + '55'}` }} />
          <span style={{ fontSize: 11, color: T.muted }}>Day off</span>
        </div>
      </div>
    </div>
  );
}
