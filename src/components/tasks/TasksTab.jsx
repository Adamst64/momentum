import React, { useState } from 'react';
import { T } from '../../theme';
import DonutChart from '../DonutChart';
import TaskItem from './TaskItem';
import CreateTaskModal from './CreateTaskModal';
import TaskCalendar from './TaskCalendar';
import { formatLongDate, todayStr } from '../../utils/dateUtils';
import { registerPushToken } from '../../utils/pushNotifications';

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

function ord(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

function MonthlyItem({ task, today, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const ym  = today.slice(0, 7);
  const dom = parseInt(today.slice(-2), 10);
  const effectiveDay = task.monthOverrides?.[ym] ?? task.dayOfMonth;
  const isDone    = !!task.completedOccurrences?.[ym];
  const isOverdue = !isDone && effectiveDay < dom;
  const isToday   = !isDone && effectiveDay === dom;

  let statusColor = T.muted;
  let statusText  = `Due ${effectiveDay}${ord(effectiveDay)}`;
  if (isDone) {
    statusColor = T.green;
    statusText  = `Done ✓`;
  } else if (isOverdue) {
    statusColor = T.red;
    statusText  = `${effectiveDay}${ord(effectiveDay)} passed`;
  } else if (isToday) {
    statusColor = T.khaki;
    statusText  = `Due today`;
  }

  return (
    <>
      <div style={{
        background: T.card,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, color: T.text, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{task.name}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Every {task.dayOfMonth}{ord(task.dayOfMonth)}
          </div>
        </div>

        {task.notify?.enabled && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: T.muted }}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 01-3.46 0" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}

        <div style={{ fontSize: 12, color: statusColor, fontWeight: 500, flexShrink: 0 }}>
          {statusText}
        </div>

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

export default function TasksTab({ hook, userId }) {
  const {
    addTask, deleteTask, rescheduleTask, updateTask,
    toggleTaskForDate, tasksForDate,
    todayTasks, backlogTasks, scheduledTasks, monthlyTasks, todayStats,
  } = hook;

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);

  const today    = todayStr();
  const stats    = todayStats();
  const todays   = todayTasks();
  const backlog  = backlogTasks();
  const scheduled = scheduledTasks();
  const monthly  = monthlyTasks();

  const handleSave = (data) => {
    addTask(data);
    if (data.notify?.enabled && userId) {
      registerPushToken(userId);
    }
  };

  const handleEditSave = (data) => {
    updateTask(editing.id, data);
    if (data.notify?.enabled && userId) {
      registerPushToken(userId);
    }
    setEditing(null);
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

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
                key={t.id} task={t} today={today}
                onToggle={() => toggleTaskForDate(t.id, today)}
                onEdit={setEditing}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>

      <TaskCalendar
        today={today}
        tasksForDate={tasksForDate}
        toggleTaskForDate={toggleTaskForDate}
        deleteTask={deleteTask}
        rescheduleTask={rescheduleTask}
        onEdit={setEditing}
      />

      <Section title="Backlog" count={backlog.length} defaultOpen={false}>
        {backlog.map(({ task, missed }) => (
          <TaskItem
            key={task.id} task={task} section="backlog" missed={missed}
            onComplete={() => toggleTaskForDate(task.id, today)}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
            onEdit={setEditing}
          />
        ))}
      </Section>

      <Section title="Scheduled" count={scheduled.length} defaultOpen={true}>
        {scheduled.map(t => (
          <TaskItem
            key={t.id} task={t} section="scheduled"
            onComplete={() => toggleTaskForDate(t.id, today)}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
            onEdit={setEditing}
          />
        ))}
      </Section>

      <Section title="Monthly" count={monthly.length} defaultOpen={true}>
        {monthly.map(t => (
          <MonthlyItem
            key={t.id} task={t} today={today}
            onEdit={setEditing}
            onDelete={deleteTask}
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
        <CreateTaskModal onSave={handleSave} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <CreateTaskModal
          initial={editing}
          onSave={handleEditSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
