import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { getDaysInMonth, getFirstDOW, todayStr, formatMonthYear, formatShortDate, DAYS_SHORT } from '../../utils/dateUtils';
import { useSwipe, animateSlide } from '../../hooks/useSwipe';

function pad(n) { return String(n).padStart(2, '0'); }

function computeStats(commitment, today) {
  const created  = commitment.createdAt || today;
  const seedDate = commitment.seedDate || null;
  let clean = 0, total = 0;
  let d = new Date(created + 'T12:00:00');
  const end = new Date(today + 'T12:00:00');
  while (d <= end) {
    const ds     = d.toISOString().slice(0, 10);
    const failed = !!commitment.failures?.[ds];
    // Skip the seeded failure used only to establish the starting streak
    if (ds === seedDate) { d.setDate(d.getDate() + 1); continue; }
    if (ds === today) {
      if (failed) total++;
    } else {
      total++;
      if (!failed) clean++;
    }
    d.setDate(d.getDate() + 1);
  }
  return { clean, total, pct: total > 0 ? Math.round(clean / total * 100) : null };
}

export default function CommitmentCalendarModal({ commitment, onClose }) {
  const today = todayStr();
  const now   = new Date(today + 'T12:00:00');

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const gridRef = useRef(null);

  const prevMonth = () => {
    animateSlide(gridRef.current, 'prev');
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    animateSlide(gridRef.current, 'next');
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const swipeRef = useSwipe(nextMonth, prevMonth);

  const stats    = computeStats(commitment, today);
  const created  = commitment.createdAt || today;
  const dim      = getDaysInMonth(year, month);
  const firstDow = getFirstDOW(year, month);
  const cells    = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
        borderBottom: `1px solid ${T.cardBorder}`,
      }}>
        <button onClick={onClose} style={{ color: T.khaki, fontSize: 22, lineHeight: 1, padding: '2px 0' }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{commitment.name}</span>
      </div>

      {/* Swipeable calendar area */}
      <div ref={swipeRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>

        {/* Stats */}
        {stats.pct !== null && (
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '14px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 18,
          }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: T.green, lineHeight: 1, flexShrink: 0 }}>
              {stats.pct}%
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                {stats.clean} of {stats.total} days clean
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                since {formatShortDate(created)}
              </div>
            </div>
          </div>
        )}

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ color: T.muted, fontSize: 22, padding: '4px 10px' }}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{formatMonthYear(year, month)}</span>
          <button onClick={nextMonth} style={{ color: T.muted, fontSize: 22, padding: '4px 10px' }}>›</button>
        </div>

        {/* Day labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, color: T.muted }}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ overflow: 'hidden', borderRadius: 10 }}>
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const ds       = `${year}-${pad(month + 1)}-${pad(day)}`;
              const isBefore = ds < created;
              const isFuture = ds > today;
              const isToday  = ds === today;
              const failed   = !!commitment.failures?.[ds];

              let bg = 'transparent', textColor = T.subtle;
              if (!isBefore && !isFuture) {
                if (failed) { bg = '#2A0D0D'; textColor = T.red; }
                else        { bg = '#0D2A0D'; textColor = T.green; }
              }

              return (
                <div key={day} style={{
                  aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 7, background: bg,
                  border: `1.5px solid ${isToday ? T.khaki : 'transparent'}`,
                  fontSize: 12, fontWeight: isToday ? 700 : 400,
                  color: isToday && (isBefore || isFuture) ? T.khaki : textColor,
                }}>
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {[['#0D2A0D', T.green, 'Clean'], ['#2A0D0D', T.red, 'Failed']].map(([bg, c, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${c}88` }} />
              <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>,
    document.body
  );
}
