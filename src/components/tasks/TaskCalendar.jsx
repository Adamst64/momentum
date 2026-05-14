import React, { useState } from 'react';
import { T } from '../../theme';
import {
  formatLongDate, formatMonthYear, todayStr, addDays,
  getDaysInMonth, getFirstDOW, DAYS_SHORT,
} from '../../utils/dateUtils';
import { completionColor } from '../../utils/colors';
import { useSwipe } from '../../hooks/useSwipe';
import { useLongPress } from '../../hooks/useLongPress';

function getDayState(items, dateStr, today) {
  if (!items.length) return null;
  if (dateStr > today) return 'scheduled';
  const done = items.filter(i => i.done).length;
  if (done === items.length) return 'done';
  if (done === 0) return 'missed';
  return 'partial';
}

const STATE_TEXT = { done: '#6BAE5A', missed: '#E05050', partial: '#C8B87A' };

function DayCell({ dateStr, items, today, isSelected, onClick }) {
  const day = parseInt(dateStr.slice(-2), 10);
  const isToday    = dateStr === today;
  const isFuture   = dateStr > today;
  const state      = getDayState(items, dateStr, today);

  // Numeric ratio for water-fill (matches routines calendar style)
  let ratio = null;
  if (state === 'done')    ratio = 1;
  else if (state === 'missed')  ratio = 0;
  else if (state === 'partial') ratio = items.filter(i => i.done).length / items.length;

  const fillColor = ratio !== null ? completionColor(ratio) : null;
  const textWhite = ratio !== null && ratio >= 0.82;

  return (
    <button onClick={onClick} style={{
      aspectRatio: '1',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 3,
      borderRadius: 8,
      background: T.bg,
      position: 'relative',
      overflow: 'hidden',
      border: isToday
        ? `2px solid ${T.khaki}`
        : isSelected
        ? `2px solid ${T.olive}`
        : '2px solid transparent',
    }}>
      {/* Water fill for past days */}
      {fillColor && ratio > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${ratio * 100}%`,
          background: fillColor,
          transition: 'height 0.4s ease',
        }} />
      )}

      {/* 3px red baseline for 0% missed days */}
      {state === 'missed' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 3, background: '#FF453A', opacity: 0.7,
        }} />
      )}

      <span style={{
        position: 'relative', zIndex: 1,
        fontSize: 13, fontWeight: isToday ? 700 : 400,
        color: textWhite ? '#fff'
          : isToday ? T.khaki
          : isFuture ? T.muted
          : state ? STATE_TEXT[state]
          : T.muted,
      }}>
        {day}
      </span>

      {/* Green dot for future days with scheduled tasks */}
      {state === 'scheduled' && (
        <div style={{
          position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
          width: 4, height: 4, borderRadius: '50%', background: T.green,
        }} />
      )}
    </button>
  );
}

function DayTaskRow({ item, dateStr, today, editable, onToggle, onDelete, onEdit, onReschedule }) {
  const [showMenu, setShowMenu] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(today);
  const longPressRef = useLongPress(() => setShowMenu(true));
  const { task, done } = item;

  return (
    <div>
      <div ref={longPressRef} style={{
        background: T.bg, border: `1px solid ${done ? T.olive + '44' : T.cardBorder}`,
        borderRadius: 10, padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: done ? 0.75 : 1,
      }}>
        <button onClick={() => editable && onToggle(task.id, dateStr)} style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
          border: done ? 'none' : editable ? `2px solid ${T.muted}` : 'none',
          background: done ? T.olive : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: editable ? 'pointer' : 'default',
        }}>
          {done ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : !editable && (
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.red }} />
          )}
        </button>

        <span style={{
          flex: 1, fontSize: 14, color: T.text, fontWeight: 500,
          textDecoration: done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{task.name}</span>

        {task.type === 'recurring-monthly' && (
          <span style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 4, flexShrink: 0,
            background: '#2A3A1A', color: T.oliveLight, fontWeight: 600, textTransform: 'uppercase',
          }}>mo</span>
        )}
      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -4,
        }}>
          <button onClick={() => { onEdit(task); setShowMenu(false); }} style={{
            width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14,
            color: T.text, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Edit</button>
          <button onClick={() => { setRescheduling(true); setShowMenu(false); }} style={{
            width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14,
            color: T.khaki, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Reschedule</button>
          <button onClick={() => { onDelete(task.id); setShowMenu(false); }} style={{
            width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14, color: T.red, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Delete</button>
          <button onClick={() => setShowMenu(false)} style={{
            width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14, color: T.muted,
          }}>Cancel</button>
        </div>
      )}

      {rescheduling && (
        <div style={{
          background: T.bg, border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, padding: '10px 12px', marginTop: 4,
        }}>
          <input
            type="date"
            value={newDate}
            min={today}
            onChange={e => setNewDate(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, marginBottom: 8,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              color: T.text, fontSize: 14, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setRescheduling(false)} style={{
              flex: 1, padding: '8px', borderRadius: 7, background: 'transparent',
              border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 13,
            }}>Cancel</button>
            <button onClick={() => { onReschedule(task.id, newDate, dateStr.slice(0, 7)); setRescheduling(false); }} style={{
              flex: 1, padding: '8px', borderRadius: 7, background: T.olive, color: T.text, fontSize: 13, fontWeight: 600,
            }}>Set Date</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskCalendar({ today, calYear, calMonth, onPrevMonth, onNextMonth, tasksForDate, toggleTaskForDate, deleteTask, rescheduleTask, onEdit }) {
  const [selectedDate, setSelectedDate] = useState(null);

  const minEditableDate = addDays(today, -6);

  const prevMonth = () => { onPrevMonth(); setSelectedDate(null); };
  const nextMonth = () => { onNextMonth(); setSelectedDate(null); };
  const swipeRef = useSwipe(nextMonth, prevMonth);

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDow    = getFirstDOW(calYear, calMonth);
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const selectedItems = selectedDate ? tasksForDate(selectedDate) : [];
  const isEditable = !!(selectedDate && selectedDate >= minEditableDate && selectedDate <= today);

  return (
    <div ref={swipeRef}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Calendar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={prevMonth} style={{ color: T.muted, fontSize: 18, padding: '2px 8px', background: 'none', border: 'none' }}>‹</button>
          <span style={{ fontSize: 13, color: T.text, fontWeight: 600, minWidth: 116, textAlign: 'center' }}>
            {formatMonthYear(calYear, calMonth)}
          </span>
          <button onClick={nextMonth} style={{ color: T.muted, fontSize: 18, padding: '2px 8px', background: 'none', border: 'none' }}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: T.muted, fontWeight: 600, padding: '3px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{
        background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 8,
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
      }}>
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`_${i}`} />;
          return (
            <DayCell
              key={dateStr}
              dateStr={dateStr}
              items={tasksForDate(dateStr)}
              today={today}
              isSelected={selectedDate === dateStr}
              onClick={() => setSelectedDate(prev => prev === dateStr ? null : dateStr)}
            />
          );
        })}
      </div>

      {selectedDate && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: 14, marginTop: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{formatLongDate(selectedDate)}</span>
            {isEditable ? (
              <span style={{ fontSize: 11, color: T.oliveLight, background: '#1A2410', padding: '2px 8px', borderRadius: 10 }}>editable</span>
            ) : selectedDate > today ? (
              <span style={{ fontSize: 11, color: T.khaki, background: '#1A1A0C', padding: '2px 8px', borderRadius: 10 }}>upcoming</span>
            ) : (
              <span style={{ fontSize: 11, color: T.muted }}>read-only</span>
            )}
          </div>

          {selectedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: '10px 0' }}>No tasks this day</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedItems.map(item => (
                <DayTaskRow
                  key={item.task.id}
                  item={item}
                  dateStr={selectedDate}
                  today={today}
                  editable={isEditable}
                  onToggle={toggleTaskForDate}
                  onDelete={deleteTask}
                  onEdit={onEdit}
                  onReschedule={rescheduleTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
