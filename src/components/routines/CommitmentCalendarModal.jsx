import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { getDaysInMonth, getFirstDOW, todayStr, formatMonthYear, formatShortDate, DAYS_SHORT, addDays } from '../../utils/dateUtils';
import { useSwipe, animateSlide } from '../../hooks/useSwipe';
import { useBackHandler } from '../../hooks/useBackHandler';
import { commitmentStats, isScheduled, MILESTONES } from '../../utils/commitments';
import { SlipSheet, ConfirmSheet } from './CommitmentSheets';

function pad(n) { return String(n).padStart(2, '0'); }

export default function CommitmentCalendarModal({ commitment, onMarkSlip, onClearSlip, onClose }) {
  useBackHandler(true, onClose);
  const today           = todayStr();
  const minEditableDate = addDays(today, -6);
  const now             = new Date(today + 'T12:00:00');

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [slipDay, setSlipDay]   = useState(null); // mark a clean day as a slip
  const [cleanDay, setCleanDay] = useState(null); // turn a slip back into a clean day

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

  const stats    = commitmentStats(commitment, today);
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

        {/* Streaks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <Stat value={stats.current} label={stats.failedToday ? 'current streak (slipped today)' : 'current streak'} color={stats.failedToday ? T.red : T.green} />
          <Stat value={stats.best} label="best streak" color={T.khaki} />
          <Stat value={stats.pct === null ? '–' : `${stats.pct}%`} label={`${stats.clean} of ${stats.total} days clean since ${formatShortDate(created)}`} color={T.green} />
          <Stat value={`${stats.slipsThisMonth} · ${stats.slipsThisYear}`} label="slips this month · this year" color={stats.slipsThisMonth ? T.red : T.muted} />
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 20 }}>
          Streaks count finished days; today counts once it's over.
          {Array.isArray(commitment.days) && ` Applies on ${[1, 2, 3, 4, 5, 6, 0].filter(d => commitment.days.includes(d)).map(d => DAYS_SHORT[d]).join(' ')}.`}
        </div>

        {/* Badges: earned by the best streak so far */}
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          Badges <span style={{ color: T.subtle }}>({MILESTONES.filter(m => stats.best >= m.days).length}/{MILESTONES.length})</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 }}>
          {MILESTONES.map(m => {
            const earned = stats.best >= m.days;
            return (
              <div key={m.days} style={{
                padding: '8px 2px', borderRadius: 10, textAlign: 'center',
                background: earned ? '#1E2A12' : T.card, border: `1px solid ${earned ? T.olive + '66' : T.cardBorder}`,
                opacity: earned ? 1 : 0.45,
              }}>
                <div style={{ fontSize: 20, filter: earned ? 'none' : 'grayscale(1)' }}>{m.icon}</div>
                <div style={{ fontSize: 9, color: earned ? T.khaki : T.muted, marginTop: 2 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>
          {stats.next ? `${stats.toNext} more clean day${stats.toNext === 1 ? '' : 's'} for ${stats.next.icon} ${stats.next.label}` : 'Every badge earned. Legendary.'}
        </div>

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
              const isBefore   = ds < created;
              const isFuture   = ds > today;
              const isToday    = ds === today;
              const inRange    = !isBefore && !isFuture && ds >= minEditableDate;
              const failed     = !!commitment.failures?.[ds];
              const rest       = !failed && !isScheduled(commitment, ds);
              const isEditable = inRange && !rest;

              let bg = 'transparent', textColor = T.subtle;
              if (!isBefore && !isFuture && !rest) {
                if (failed)        { bg = '#2A0D0D'; textColor = T.red; }
                else if (!isToday) { bg = '#0D2A0D'; textColor = T.green; }
                else               { textColor = T.green; }
              }

              return (
                <div
                  key={day}
                  onPointerUp={isEditable ? () => (failed ? setCleanDay(ds) : setSlipDay(ds)) : undefined}
                  style={{
                    aspectRatio: '1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 7, background: bg,
                    border: `1.5px solid ${isToday ? T.khaki : isEditable ? (failed ? T.red + '88' : T.green + '88') : 'transparent'}`,
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                    color: isToday && (isBefore || isFuture) ? T.khaki : textColor,
                    cursor: isEditable ? 'pointer' : 'default',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {[['#0D2A0D', T.green, 'Clean'], ['#2A0D0D', T.red, 'Slip'], ['transparent', T.subtle, 'Rest day / not started']].map(([bg, c, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${c}88` }} />
              <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: T.muted, textAlign: 'center' }}>
          Tap a day in the past week to mark or clear a slip
        </div>

        {/* Slips and their reasons */}
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, margin: '24px 0 8px' }}>
          Slip history <span style={{ color: T.subtle }}>({stats.slips.length})</span>
        </div>
        {stats.slips.length === 0 ? (
          <div style={{ fontSize: 13, color: T.muted }}>No slips recorded. Keep it going.</div>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14 }}>
            {stats.slips.map((sl, i) => (
              <div key={sl.date} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
                <div style={{ fontSize: 13, color: T.red, fontWeight: 600, width: 56, flexShrink: 0 }}>{formatShortDate(sl.date)}</div>
                <div style={{ fontSize: 13, color: sl.note ? T.text : T.muted, fontStyle: sl.note ? 'normal' : 'italic' }}>{sl.note || 'No reason given'}</div>
              </div>
            ))}
          </div>
        )}

      </div>

      {slipDay && (
        <SlipSheet
          name={commitment.name}
          dateLabel={formatShortDate(slipDay)}
          streak={slipDay === today ? stats.current : 0}
          onConfirm={note => onMarkSlip(commitment.id, slipDay, note)}
          onClose={() => setSlipDay(null)}
        />
      )}
      {cleanDay && (
        <ConfirmSheet
          title={`Mark ${formatShortDate(cleanDay)} as clean?`}
          message={commitment.failureNotes?.[cleanDay] ? `This removes the slip and its reason: “${commitment.failureNotes[cleanDay]}”.` : 'This removes the slip for that day.'}
          confirmLabel="Mark clean"
          onConfirm={() => onClearSlip(commitment.id, cleanDay)}
          onClose={() => setCleanDay(null)}
        />
      )}
    </div>,
    document.body
  );
}

function Stat({ value, label, color }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 5, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}
