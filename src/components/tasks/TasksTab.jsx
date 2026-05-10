import React, { useState } from 'react';
import { T } from '../../theme';
import DonutChart from '../DonutChart';
import TaskItem from './TaskItem';
import CreateTaskModal from './CreateTaskModal';
import TaskCalendar from './TaskCalendar';
import { formatLongDate, todayStr } from '../../utils/dateUtils';

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

export default function TasksTab({ hook }) {
  const {
    addTask, deleteTask, rescheduleTask, updateTask,
    toggleTaskForDate, tasksForDate,
    todayTasks, backlogTasks, upcomingTasks, todayStats,
  } = hook;

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);

  const today   = todayStr();
  const stats   = todayStats();
  const todays  = todayTasks();
  const backlog = backlogTasks();
  const upcoming = upcomingTasks();

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
        <CreateTaskModal
          initial={editing}
          onSave={data => { updateTask(editing.id, data); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
