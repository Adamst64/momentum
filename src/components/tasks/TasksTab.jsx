import React, { useState } from 'react';
import { T } from '../../theme';
import DonutChart from '../DonutChart';
import TaskItem from './TaskItem';
import CreateTaskModal from './CreateTaskModal';
import {
  formatLongDate, formatMonthYear, todayStr, addDays,
  getDaysInMonth, getFirstDOW, parseDate, DAYS_SHORT,
} from '../../utils/dateUtils';

// ── Helpers ────────────────────────────────────────────────────────────────────
function getDayState(items, dateStr, today) {
  if (!items.length) return null;
  if (dateStr > today) return 'scheduled';
  const done = items.filter(i => i.done).length;
  if (done === items.length) return 'done';
  if (done === 0) return 'missed';
  return 'partial';
}

const STATE_BG    = { done: '#2A3A1A', missed: '#3A1C1C', partial: '#2A2814', scheduled: '#1C1E18' };
const STATE_COLOR = { done: '#6BAE5A', missed: '#E05050', partial: '#C8B87A', scheduled: '#8A9E52' };

// ── Day cell ───────────────────────────────────────────────────────────────────
function DayCell({ dateStr, items, today, isSelected, onClick }) {
  const day = parseInt(dateStr.slice(-2), 10);
  const isToday = dateStr === today;
  const state = getDayState(items, dateStr, today);
  return (
    <button onClick={onClick} style={{
      aspectRatio: '1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8, background: state ? STATE_BG[state] : 'transparent',
      border: isToday
        ? `2px solid ${T.khaki}`
        : isSelected
        ? `2px solid ${T.olive}`
        : '2px solid transparent',
    }}>
      <span style={{
        fontSize: 13,
        fontWeight: isToday ? 700 : 400,
        color: state ? STATE_COLOR[state] : (isToday ? T.khaki : T.muted),
      }}>
        {day}
      </span>
    </button>
  );
}

// ── Day panel task row ─────────────────────────────────────────────────────────
function DayTaskRow({ item, dateStr, today, editable, onToggle, onDelete, onEdit, onReschedule }) {
  const [showMenu, setShowMenu] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(today);
  const { task, done } = item;

  return (
    <div>
      <div style={{
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

        <button onClick={() => setShowMenu(m => !m)} style={{
          color: T.muted, fontSize: 16, padding: '2px 6px', lineHeight: 1, flexShrink: 0,
        }}>···</button>
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
            width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14, color: T.red,
          }}>Delete</button>
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
            <button onClick={() => { onReschedule(task.id, newDate); setRescheduling(false); }} style={{
              flex: 1, padding: '8px', borderRadius: 7, background: T.olive, color: T.text, fontSize: 13, fontWeight: 600,
            }}>Set Date</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar ───────────────────────────────────────────────────────────────────
function TaskCalendar({ today, tasksForDate, toggleTaskForDate, deleteTask, rescheduleTask, onEdit }) {
  const d0 = parseDate(today);
  const [calYear, setCalYear] = useState(d0.getFullYear());
  const [calMonth, setCalMonth] = useState(d0.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const minEditableDate = addDays(today, -6);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null);
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDow = getFirstDOW(calYear, calMonth);
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const selectedItems = selectedDate ? tasksForDate(selectedDate) : [];
  const isEditable = !!(selectedDate && selectedDate >= minEditableDate && selectedDate <= today);

  return (
    <div>
      {/* Header */}
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

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: T.muted, fontWeight: 600, padding: '3px 0' }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
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

      {/* Selected day panel */}
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

// ── Today task row (toggleable) ────────────────────────────────────────────────
function TodayItem({ task, today, onToggle, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const ym = today.slice(0, 7);
  const isDone = task.type === 'recurring-monthly'
    ? !!task.completedOccurrences?.[ym]
    : task.completedAt === today;

  return (
    <>
      <div style={{
        background: T.card,
        border: `1px solid ${isDone ? T.olive + '44' : T.cardBorder}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: isDone ? 0.7 : 1,
      }}>
        <button onClick={onToggle} style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: isDone ? 'none' : `2px solid ${T.muted}`,
          background: isDone ? T.olive : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isDone && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, color: T.text, fontWeight: 500,
            textDecoration: isDone ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{task.name}</div>
          {task.type === 'recurring-monthly' && (
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Monthly</div>
          )}
        </div>

        {task.type === 'recurring-monthly' && !isDone && (
          <div style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: '#2A3A1A', color: T.oliveLight, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0,
          }}>Monthly</div>
        )}

        <button onClick={() => setShowMenu(m => !m)} style={{
          color: T.muted, fontSize: 18, padding: '4px 6px', lineHeight: 1, flexShrink: 0,
        }}>···</button>
      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -6,
        }}>
          <button onClick={() => { onEdit(task); setShowMenu(false); }} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14,
            color: T.text, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Edit</button>
          <button onClick={() => { onDelete(task.id); setShowMenu(false); }} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red,
          }}>Delete</button>
        </div>
      )}
    </>
  );
}

// ── Collapsible section ────────────────────────────────────────────────────────
function Section({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', marginBottom: open ? 10 : 0,
        color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        <span>{title} <span style={{ color: T.subtle }}>({count})</span></span>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', fontSize: 14 }}>›</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </div>
  );
}

// ── TasksTab ───────────────────────────────────────────────────────────────────
export default function TasksTab({ hook }) {
  const {
    addTask, deleteTask, rescheduleTask, updateTask,
    toggleTaskForDate, tasksForDate,
    todayTasks, backlogTasks, upcomingTasks, todayStats,
  } = hook;

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const today   = todayStr();
  const stats   = todayStats();
  const todays  = todayTasks();
  const backlog = backlogTasks();
  const upcoming = upcomingTasks();

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stats */}
      <div style={{
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 16, padding: '20px',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <DonutChart done={stats.done} total={stats.total} />
        <div>
          <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
            Today's Tasks
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>
            {stats.done}/{stats.total}
            <span style={{ fontSize: 14, color: T.muted, fontWeight: 400, marginLeft: 6 }}>done</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{formatLongDate(today)}</div>
        </div>
      </div>

      {/* Today */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Today</div>
        {todays.length === 0 ? (
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '20px 16px', textAlign: 'center', color: T.muted, fontSize: 14,
          }}>Nothing due today</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todays.map(t => (
              <TodayItem
                key={t.id}
                task={t}
                today={today}
                onToggle={() => toggleTaskForDate(t.id, today)}
                onEdit={setEditing}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Calendar */}
      <TaskCalendar
        today={today}
        tasksForDate={tasksForDate}
        toggleTaskForDate={toggleTaskForDate}
        deleteTask={deleteTask}
        rescheduleTask={rescheduleTask}
        onEdit={setEditing}
      />

      {/* Backlog */}
      <Section title="Backlog" count={backlog.length} defaultOpen={false}>
        {backlog.map(t => (
          <TaskItem
            key={t.id} task={t} section="backlog"
            onComplete={() => toggleTaskForDate(t.id, today)}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
            onEdit={setEditing}
          />
        ))}
      </Section>

      {/* Upcoming */}
      <Section title="Upcoming" count={upcoming.length} defaultOpen={true}>
        {upcoming.map(t => (
          <TaskItem
            key={t.id} task={t} section="upcoming"
            onComplete={() => toggleTaskForDate(t.id, today)}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
            onEdit={setEditing}
          />
        ))}
      </Section>

      <button type="button" onClick={() => setShowCreate(true)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: 14, borderRadius: 14,
        border: `1.5px dashed ${T.cardBorder}`,
        color: T.muted, fontSize: 15, background: 'transparent',
      }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Task
      </button>

      {showCreate && (
        <CreateTaskModal onSave={data => addTask(data)} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <CreateTaskModal initial={editing} onSave={data => { updateTask(editing.id, data); setEditing(null); }} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
