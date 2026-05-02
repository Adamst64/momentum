import React, { useState, useEffect } from 'react';
import { T } from '../../theme';
import DonutChart from '../DonutChart';
import TaskItem from './TaskItem';
import CreateTaskModal from './CreateTaskModal';
import { formatLongDate, todayStr, formatShortDate } from '../../utils/dateUtils';
import { requestPermission, checkRecurringNotifications } from '../../utils/notifications';

function Section({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', marginBottom: open ? 10 : 0,
          color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
        }}
      >
        <span>{title} <span style={{ color: T.subtle }}>({count})</span></span>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', fontSize: 14 }}>›</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </div>
  );
}

export default function TasksTab({ hook }) {
  const { tasks, addTask, deleteTask, completeTask, rescheduleTask, updateTask,
          todayTasks, doneTasks, backlogTasks, upcomingTasks, todayStats } = hook;

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);

  const today    = todayStr();
  const stats    = todayStats();
  const todays   = todayTasks();
  const done     = doneTasks();
  const backlog  = backlogTasks();
  const upcoming = upcomingTasks();

  useEffect(() => {
    requestPermission().then(granted => {
      if (granted) checkRecurringNotifications(tasks);
    });
  }, []); // eslint-disable-line

  const handleEdit = (task) => setEditing(task);

  const handleEditSave = (data) => {
    updateTask(editing.id, data);
    setEditing(null);
  };

  const itemProps = (section) => ({
    section,
    onComplete: completeTask,
    onDelete: deleteTask,
    onReschedule: rescheduleTask,
    onEdit: handleEdit,
  });

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
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
          }}>
            Nothing due today
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todays.map(t => <TaskItem key={t.id} task={t} {...itemProps('today')} />)}
          </div>
        )}
      </div>

      <Section title="Done" count={done.length} defaultOpen={false}>
        {done.map(t => <TaskItem key={t.id} task={t} {...itemProps('done')} />)}
      </Section>

      <Section title="Upcoming" count={upcoming.length} defaultOpen={true}>
        {upcoming.map(t => <TaskItem key={t.id} task={t} {...itemProps('upcoming')} />)}
      </Section>

      <Section title="Backlog" count={backlog.length}>
        {backlog.map(t => <TaskItem key={t.id} task={t} {...itemProps('backlog')} />)}
      </Section>

      <button
        type="button"
        onClick={() => setShowCreate(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 14, borderRadius: 14,
          border: `1.5px dashed ${T.cardBorder}`,
          color: T.muted, fontSize: 15, background: 'transparent',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Task
      </button>

      {showCreate && (
        <CreateTaskModal onSave={data => addTask(data)} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <CreateTaskModal initial={editing} onSave={handleEditSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
