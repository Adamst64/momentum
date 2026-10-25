import React, { useState } from 'react';
import { T } from '../../theme';
import TaskItem from './TaskItem';
import CreateTaskModal from './CreateTaskModal';
import TaskCalendar from './TaskCalendar';
import MonthlyTaskHistoryModal from './MonthlyTaskHistoryModal';
import { formatLongDate, formatMonthYear, todayStr, addDays, getDOW, DAYS_FULL, DAYS_SHORT } from '../../utils/dateUtils';
import { weeklyDueOn } from '../../hooks/useTasks';
import { registerPushToken } from '../../utils/pushNotifications';
import { useLongPress } from '../../hooks/useLongPress';
import TabBar, { SubBar, ICONS, scrollToTop } from '../TabBar';
import { remindersSummary } from '../../utils/taskReminders';

const BLUE = '#8FA89B'; // slate-sage, the Tasks colour

function TodayItem({ task, today, onToggle, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useLongPress(() => setShowMenu(true));
  const ym = today.slice(0, 7);
  const isDone = task.type === 'recurring-monthly' ? !!task.completedOccurrences?.[ym]
    : task.type === 'recurring-weekly' ? !!task.completedOccurrences?.[today]
    : task.completedAt === today;
  const repeat = task.type === 'recurring-monthly' ? 'Monthly' : task.type === 'recurring-weekly' ? 'Weekly' : null;

  return (
    <>
      <div ref={longPressRef} style={{
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
          {repeat && (
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{repeat}</div>
          )}
        </div>

        {repeat && !isDone && (
          <div style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: '#2A3A1A', color: T.oliveLight, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0,
          }}>{repeat}</div>
        )}
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
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Delete</button>
          <button onClick={() => setShowMenu(false)} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.muted,
          }}>Cancel</button>
        </div>
      )}
    </>
  );
}

function ord(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

function MonthlyItem({ task, viewYM, todayYM, todayDom, onEdit, onDelete, onShowHistory }) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useLongPress(() => setShowMenu(true));
  const effectiveDay      = task.monthOverrides?.[viewYM] ?? task.dayOfMonth;
  const isDone            = !!task.completedOccurrences?.[viewYM];
  const createdAtStr      = task.createdAt;
  const createdYM         = createdAtStr?.slice(0, 7);
  // Was the task created on or before its due day for the viewed month?
  const dueDateForMonth   = `${viewYM}-${String(effectiveDay).padStart(2, '0')}`;
  const taskExistedOnDueDay = !createdAtStr || createdAtStr <= dueDateForMonth;

  const isPast    = viewYM < todayYM;
  const isCurrent = viewYM === todayYM;
  const isFuture  = viewYM > todayYM;

  // Not applicable: month is before the task existed, or same month but task was created after its due day
  const notApplicable = (createdYM && viewYM < createdYM)
    || (createdYM && viewYM === createdYM && !taskExistedOnDueDay);

  // Roll to today only if the task genuinely existed on the original due day
  const shouldRoll = isCurrent && !isDone && effectiveDay < todayDom && taskExistedOnDueDay;
  const displayDay = shouldRoll ? todayDom : effectiveDay;

  let statusColor, statusText;
  if (notApplicable) {
    statusColor = T.subtle;
    statusText  = '—';
  } else if (isDone) {
    statusColor = T.green;
    statusText  = 'Done ✓';
  } else if (isFuture) {
    statusColor = T.muted;
    statusText  = `Due ${effectiveDay}${ord(effectiveDay)}`;
  } else if (isPast) {
    statusColor = T.red;
    statusText  = 'Missed';
  } else {
    // current month, not done
    if (displayDay > todayDom) {
      statusColor = T.muted;
      statusText  = `Due ${displayDay}${ord(displayDay)}`;
    } else if (shouldRoll) {
      statusColor = T.khaki;
      statusText  = 'Missed · due today';
    } else {
      statusColor = T.khaki;
      statusText  = 'Due today';
    }
  }

  const isOverridden = task.monthOverrides?.[viewYM] != null;

  return (
    <>
      <div ref={longPressRef} style={{
        background: T.card,
        border: `1px solid ${isDone ? T.olive + '44' : T.cardBorder}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: isDone ? 0.75 : 1,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, color: T.text, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{task.name}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Every {task.dayOfMonth}{ord(task.dayOfMonth)}
            {isOverridden && ` · this month: ${effectiveDay}${ord(effectiveDay)}`}
          </div>
        </div>

        {task.notify?.enabled && <Bell />}

        <div style={{ fontSize: 12, color: statusColor, fontWeight: 600, flexShrink: 0, textAlign: 'right', maxWidth: 110 }}>
          {statusText}
        </div>
      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -6,
        }}>
          <button onClick={() => { onShowHistory(task); setShowMenu(false); }} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14,
            color: T.text, borderBottom: `1px solid ${T.cardBorder}`,
          }}>View History</button>
          <button onClick={() => { onEdit(task); setShowMenu(false); }} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14,
            color: T.text, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Edit</button>
          <button onClick={() => { onDelete(task.id); setShowMenu(false); }} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Delete</button>
          <button onClick={() => setShowMenu(false)} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.muted,
          }}>Cancel</button>
        </div>
      )}
    </>
  );
}

const Bell = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.73 21a2 2 0 01-3.46 0" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// This week (Monday–Sunday): where the task falls and whether it's done
function WeeklyItem({ task, today, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useLongPress(() => setShowMenu(true));
  const monday = addDays(today, -((getDOW(today) + 6) % 7));
  const due = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).find(d => weeklyDueOn(task, d));
  const isDone = !!(due && task.completedOccurrences?.[due]);

  let statusColor = T.muted, statusText = '—';
  if (isDone) { statusColor = T.green; statusText = 'Done ✓'; }
  else if (due === today) { statusColor = T.khaki; statusText = 'Due today'; }
  else if (due && due < today) { statusColor = T.red; statusText = 'Missed'; }
  else if (due) statusText = `Due ${DAYS_SHORT[getDOW(due)]}`;

  return (
    <>
      <div ref={longPressRef} style={{
        background: T.card,
        border: `1px solid ${isDone ? T.olive + '44' : T.cardBorder}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: isDone ? 0.75 : 1,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, color: T.text, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{task.name}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Every {DAYS_FULL[task.dayOfWeek]}
            {task.notify?.enabled && remindersSummary(task.notify) && ` · ${remindersSummary(task.notify)}`}
          </div>
        </div>

        {task.notify?.enabled && <Bell />}

        <div style={{ fontSize: 12, color: statusColor, fontWeight: 600, flexShrink: 0, textAlign: 'right', maxWidth: 110 }}>
          {statusText}
        </div>
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
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red, borderBottom: `1px solid ${T.cardBorder}`,
          }}>Delete</button>
          <button onClick={() => setShowMenu(false)} style={{
            width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.muted,
          }}>Cancel</button>
        </div>
      )}
    </>
  );
}

function Section({ title, count, children, defaultOpen = true, color = T.muted }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', marginBottom: open ? 10 : 0,
        color, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        <span>{title} <span style={{ color: T.subtle }}>({count})</span></span>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', fontSize: 14 }}>›</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </div>
  );
}

// A task coming up in the next week (tap to edit; it's ticked off on its day)
function UpcomingRow({ task, onEdit }) {
  const repeat = task.type === 'recurring-weekly' ? 'Weekly' : task.type === 'recurring-monthly' ? 'Monthly' : null;
  return (
    <button type="button" onClick={() => onEdit(task)} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: '11px 14px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: repeat ? T.muted : BLUE, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</span>
      {repeat && <span style={{ fontSize: 11, color: T.muted }}>{repeat}</span>}
      {task.notify?.enabled && remindersSummary(task.notify) && <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>🔔 {remindersSummary(task.notify)}</span>}
    </button>
  );
}

export default function TasksTab({ hook, userId }) {
  const {
    addTask, deleteTask, rescheduleTask, updateTask,
    toggleTaskForDate, tasksForDate,
    todayTasks, backlogTasks, scheduledTasks, monthlyTasks, weeklyTasks, tasks: allTasks = [],
  } = hook;

  const [showCreate, setShowCreate]     = useState(false);
  // Today (overdue, today, the next 7 days) · All tasks (a task manager) · Calendar
  const [view, setView]                 = useState('today');
  const [allView, setAllView]           = useState('once'); // All tasks: once | repeat | backlog | done
  const [editing,    setEditing]        = useState(null);
  const [historyTask, setHistoryTask]   = useState(null);
  const [quick, setQuick]               = useState('');
  const [showDone, setShowDone]         = useState(false);

  const today    = todayStr();
  const todayYM  = today.slice(0, 7);
  const todayDom = parseInt(today.slice(-2), 10);

  const d0 = new Date(today + 'T00:00:00');
  const [calYear,  setCalYear]  = useState(d0.getFullYear());
  const [calMonth, setCalMonth] = useState(d0.getMonth()); // 0-indexed

  const prevCalMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextCalMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  // viewYM derived from the shared calendar month (calMonth is 0-indexed)
  const viewYM = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;

  const todays    = todayTasks();
  const backlog   = backlogTasks();
  const scheduled = scheduledTasks();
  const monthly   = monthlyTasks();
  const weekly    = weeklyTasks();

  const overdue = backlog.filter(b => b.missed);
  const undated = backlog.filter(b => !b.missed);
  const ym = today.slice(0, 7);
  const isDoneToday = t => (t.type === 'recurring-monthly' ? !!t.completedOccurrences?.[ym]
    : t.type === 'recurring-weekly' ? !!t.completedOccurrences?.[today]
    : t.completedAt === today);
  // The next 7 days, day by day (not yet done)
  const nextWeek = [1, 2, 3, 4, 5, 6, 7].map(n => {
    const date = addDays(today, n);
    return { date, items: tasksForDate(date).filter(x => !x.done).map(x => x.task) };
  }).filter(d => d.items.length);
  // Finished one-time and no-date tasks, newest first
  const doneList = allTasks.filter(t => (t.type === 'one-time' || t.type === 'backlog') && t.completedAt)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 60);
  const todayOpen = todays.filter(t => !isDoneToday(t));
  const todayDone = todays.filter(isDoneToday);

  const addQuick = () => {
    const name = quick.trim();
    if (!name) return;
    setQuick('');
    addTask({ name, type: 'one-time', date: today, notify: { enabled: false } });
  };

  const handleSave = (data) => {
    addTask(data);
    if (data.notify?.enabled && userId) registerPushToken(userId);
  };

  const handleEditSave = (data) => {
    updateTask(editing.id, data);
    if (data.notify?.enabled && userId) registerPushToken(userId);
    setEditing(null);
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <TabBar
        items={[
          { value: 'today', label: 'Today', icon: ICONS.today },
          { value: 'all', label: 'All tasks', icon: ICONS.list },
          { value: 'calendar', label: 'Calendar', icon: ICONS.calendar },
          { value: 'add', label: 'Add', icon: 'M12 5v14M5 12h14' },
        ]}
        value={showCreate ? 'add' : view}
        onChange={v => { if (v === 'add') setShowCreate(true); else { setView(v); scrollToTop(); } }}
      />

      {view === 'today' && <>
      <Section title="Overdue" count={overdue.length} color={T.red}>
        {overdue.map(({ task, missed }) => (
          <TaskItem
            key={task.id} task={task} section="backlog" missed={missed}
            onComplete={() => toggleTaskForDate(task.id, today)}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
            onEdit={setEditing}
          />
        ))}
      </Section>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Today {todays.length > 0 && <span style={{ color: T.subtle }}>({todayDone.length}/{todays.length} done)</span>}
          </span>
          <span style={{ fontSize: 12, color: T.muted }}>{formatLongDate(today)}</span>
        </div>
        {todays.length > 0 && (
          <div style={{ height: 4, borderRadius: 2, background: T.cardBorder, marginBottom: 10 }}>
            <div style={{ height: 4, borderRadius: 2, background: BLUE, width: `${(todayDone.length / todays.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todayOpen.length === 0 && (
            <div style={{ fontSize: 14, color: T.muted, padding: '4px 2px' }}>{todays.length ? 'All done for today 🎉' : 'Nothing due today'}</div>
          )}
          {todayOpen.map(t => (
            <TodayItem
              key={t.id} task={t} today={today}
              onToggle={() => toggleTaskForDate(t.id, today)}
              onEdit={setEditing}
              onDelete={deleteTask}
            />
          ))}

          {/* Quick add straight into today */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 0 14px', height: 46, borderRadius: 12,
            border: `1px dashed ${T.cardBorder}`,
          }}>
            <span style={{ color: BLUE, fontSize: 20, lineHeight: 1 }}>+</span>
            <input
              value={quick}
              onChange={e => setQuick(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuick()}
              placeholder="Quick add for today"
              aria-label="Quick add a task for today"
              enterKeyHint="done"
              style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 'none', color: T.text, fontSize: 15, outline: 'none' }}
            />
            {quick.trim() && (
              <button type="button" onClick={addQuick} style={{ padding: '6px 12px', borderRadius: 8, background: '#4E6A5C', color: '#fff', fontSize: 13, fontWeight: 600 }}>Add</button>
            )}
          </div>
        </div>
        {todayDone.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowDone(v => !v)}
              style={{ fontSize: 13, color: T.muted, padding: '6px 0' }}
            >
              ✓ {todayDone.length} done today {showDone ? '▾' : '›'}
            </button>
            {showDone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {todayDone.map(t => (
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
        )}
      </div>

      {/* The coming week, day by day */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Next 7 days</div>
        {nextWeek.length === 0 && <div style={{ fontSize: 14, color: T.muted, padding: '4px 2px' }}>Nothing planned for the week ahead.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {nextWeek.map(d => (
            <div key={d.date}>
              <div style={{ fontSize: 12, color: T.khaki, fontWeight: 600, marginBottom: 6 }}>
                {d.date === addDays(today, 1) ? 'Tomorrow' : new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {d.items.map(t => <UpcomingRow key={t.id} task={t} onEdit={setEditing} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
      </>}

      {view === 'all' && <>
      {/* One-time · Repeating · Backlog · Done: each its own list */}
      <SubBar
        items={[
          { value: 'once', label: `One-time${overdue.length + scheduled.length ? ` (${overdue.length + scheduled.length})` : ''}`, icon: ICONS.calendar },
          { value: 'repeat', label: `Repeating${weekly.length + monthly.length ? ` (${weekly.length + monthly.length})` : ''}`, icon: 'M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4' },
          { value: 'backlog', label: `Backlog${undated.length ? ` (${undated.length})` : ''}`, icon: ICONS.box },
          { value: 'done', label: 'Done', icon: ICONS.check },
        ]}
        value={allView} onChange={v => { setAllView(v); scrollToTop(); }}
      />

      {allView === 'once' && <>
        {overdue.length === 0 && scheduled.length === 0 && (
          <div style={{ fontSize: 14, color: T.muted }}>No one-time tasks coming up. Tasks with a date show here; ones without a date are in Backlog.</div>
        )}
        <Section title="Overdue" count={overdue.length} color={T.red}>
          {overdue.map(({ task, missed }) => (
            <TaskItem
              key={task.id} task={task} section="backlog" missed={missed} scheduleButton
              onComplete={() => toggleTaskForDate(task.id, today)}
              onDelete={deleteTask}
              onReschedule={rescheduleTask}
              onEdit={setEditing}
            />
          ))}
        </Section>
        <Section title="Scheduled" count={scheduled.length}>
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
      </>}

      {allView === 'repeat' && <>
        {weekly.length === 0 && monthly.length === 0 && (
          <div style={{ fontSize: 14, color: T.muted }}>No weekly or monthly tasks yet. Tap Add and choose how often it repeats.</div>
        )}
        {weekly.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Weekly <span style={{ color: T.subtle }}>({weekly.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weekly.map(t => (
                <WeeklyItem key={t.id} task={t} today={today} onEdit={setEditing} onDelete={deleteTask} />
              ))}
            </div>
          </div>
        )}

        {monthly.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Monthly <span style={{ color: T.subtle }}>({monthly.length})</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: viewYM === todayYM ? T.khaki : T.muted }}>
                {formatMonthYear(calYear, calMonth)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthly.map(t => (
                <MonthlyItem
                  key={t.id}
                  task={t}
                  viewYM={viewYM}
                  todayYM={todayYM}
                  todayDom={todayDom}
                  onEdit={setEditing}
                  onDelete={deleteTask}
                  onShowHistory={setHistoryTask}
                />
              ))}
            </div>
          </div>
        )}

      </>}

      {allView === 'backlog' && <>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.4 }}>Tasks without a date. Tap Schedule to give one a day.</div>
        {undated.length === 0 && <div style={{ fontSize: 14, color: T.muted }}>Backlog is empty. Add a task without a date to park it here.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {undated.map(({ task, missed }) => (
            <TaskItem
              key={task.id} task={task} section="backlog" missed={missed} scheduleButton
              onComplete={() => toggleTaskForDate(task.id, today)}
              onDelete={deleteTask}
              onReschedule={rescheduleTask}
              onEdit={setEditing}
            />
          ))}
        </div>
      </>}

      {allView === 'done' && <>
        {doneList.length === 0 && <div style={{ fontSize: 14, color: T.muted }}>Finished one-time and backlog tasks show up here.</div>}
        {doneList.length > 0 && <div style={{ fontSize: 13, color: T.muted }}>Newest first. Hold one to undo or delete it.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {doneList.map(t => (
            <TaskItem
              key={t.id} task={t} section="done"
              onComplete={() => toggleTaskForDate(t.id, t.completedAt)}
              onDelete={deleteTask}
              onReschedule={rescheduleTask}
              onEdit={setEditing}
            />
          ))}
        </div>
      </>}
      </>}

      {view === 'calendar' && <TaskCalendar
        today={today}
        calYear={calYear}
        calMonth={calMonth}
        onPrevMonth={prevCalMonth}
        onNextMonth={nextCalMonth}
        tasksForDate={tasksForDate}
        toggleTaskForDate={toggleTaskForDate}
        deleteTask={deleteTask}
        rescheduleTask={rescheduleTask}
        onEdit={setEditing}
      />}

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
      {historyTask && (
        <MonthlyTaskHistoryModal task={historyTask} onClose={() => setHistoryTask(null)} />
      )}
    </div>
  );
}
