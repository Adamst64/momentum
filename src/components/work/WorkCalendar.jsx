import React, { useState } from 'react';
import { T } from '../../theme';

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

// Offset for Monday-first grid: (getDay() + 6) % 7
function mondayOffset(year, month) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

function pad(n) { return String(n).padStart(2, '0'); }

export default function WorkCalendar({ days, onSelectDay }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(null);

  const prevMonth = () => month === 1 ? (setMonth(12), setYear(y => y - 1)) : setMonth(m => m - 1);
  const nextMonth = () => month === 12 ? (setMonth(1),  setYear(y => y + 1)) : setMonth(m => m + 1);

  const offset      = mondayOffset(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dayMap = {};
  days.forEach(d => { dayMap[d.id] = d; });

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
          const ds       = `${year}-${pad(month)}-${pad(day)}`;
          const entry    = dayMap[ds];
          const isToday  = ds === todayStr;
          const isSel    = ds === selected;
          const hasEntry = !!entry;

          return (
            <button
              key={i}
              onClick={() => handleSelect(day)}
              style={{
                minHeight: 52, padding: '5px 2px 4px', borderRadius: 8, textAlign: 'center',
                background: isSel ? T.olive + '44' : hasEntry ? T.olive + '18' : 'transparent',
                border: `1px solid ${isToday ? T.khaki + '66' : isSel ? T.olive : hasEntry ? T.olive + '33' : 'transparent'}`,
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1, color: isToday ? T.khaki : hasEntry ? T.oliveLight : T.text, fontWeight: isToday || hasEntry ? 700 : 400 }}>
                {day}
              </div>
              {hasEntry && (
                <div style={{ fontSize: 8, color: T.muted, marginTop: 3, lineHeight: 1.3 }}>
                  {[entry.windows > 0 && `${entry.windows}w`, entry.doors > 0 && `${entry.doors}dr`].filter(Boolean).join(' ')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
