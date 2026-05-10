import React, { useState } from 'react';
import { T } from '../../theme';
import BirthdayRow from './BirthdayRow';
import { daysUntil, turningAge } from '../../utils/birthdayUtils';

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function BirthdayCalendar({ birthdays, onEdit, onDelete }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const firstDow    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDay    = today.getMonth() + 1 === month && today.getFullYear() === year ? today.getDate() : null;

  const bdMap = {};
  birthdays.forEach(b => {
    if (b.month === month) {
      if (!bdMap[b.day]) bdMap[b.day] = [];
      bdMap[b.day].push(b);
    }
  });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const thisMonthBirthdays = Object.entries(bdMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([, bds]) => bds);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prevMonth} style={{ color: T.muted, fontSize: 24, padding: '4px 10px', lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
          {MONTH_FULL[month - 1]} {year}
        </span>
        <button onClick={nextMonth} style={{ color: T.muted, fontSize: 24, padding: '4px 10px', lineHeight: 1 }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: T.muted, fontWeight: 600, paddingBottom: 6 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const bds     = bdMap[day] || [];
          const isToday = day === todayDay;
          const hasBd   = bds.length > 0;
          return (
            <div key={i} style={{
              minHeight: 46, padding: '5px 3px 4px',
              borderRadius: 8, textAlign: 'center',
              background: isToday ? T.khaki + '22' : hasBd ? T.olive + '18' : 'transparent',
              border: `1px solid ${isToday ? T.khaki + '55' : hasBd ? T.olive + '44' : 'transparent'}`,
            }}>
              <div style={{
                fontSize: 13, lineHeight: 1,
                color: isToday ? T.khaki : hasBd ? T.oliveLight : T.text,
                fontWeight: isToday || hasBd ? 700 : 400,
              }}>
                {day}
              </div>
              {bds.slice(0, 2).map(b => (
                <div key={b.id} style={{
                  fontSize: 8, color: T.oliveLight, marginTop: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2,
                }}>
                  {b.name.split(' ')[0]}
                </div>
              ))}
              {bds.length > 2 && (
                <div style={{ fontSize: 8, color: T.muted, marginTop: 2 }}>+{bds.length - 2}</div>
              )}
            </div>
          );
        })}
      </div>

      {thisMonthBirthdays.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            This month
          </div>
          {thisMonthBirthdays.map(b => (
            <BirthdayRow
              key={b.id}
              birthday={b}
              days={daysUntil(b.month, b.day)}
              age={turningAge(b.year, b.month, b.day)}
              onEdit={() => onEdit(b)}
              onDelete={() => onDelete(b.id)}
            />
          ))}
        </div>
      )}

      {thisMonthBirthdays.length === 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 12, padding: '20px 16px', textAlign: 'center',
          color: T.muted, fontSize: 13,
        }}>
          No birthdays in {MONTH_FULL[month - 1]}
        </div>
      )}
    </div>
  );
}
