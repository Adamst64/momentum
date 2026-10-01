import React from 'react';
import Modal from './Modal';
import { T } from '../theme';
import { todayStr, addDays, formatLongDate } from '../utils/dateUtils';
import { getCompletionCount, getRequiredForDate } from '../hooks/useRoutines';
import { daysUntil } from '../utils/birthdayUtils';

// Evening check-in: how today went, and what tomorrow holds
export default function DailyReviewModal({ routinesHook, tasksHook, birthdays, onIncrement, onWriteEntry, onClose }) {
  const today    = todayStr();
  const tomorrow = addDays(today, 1);

  const routines   = routinesHook.forDate(today);
  const doneR      = routines.filter(r => getCompletionCount(r, today) >= getRequiredForDate(r, today));
  const leftR      = routines.filter(r => !doneR.includes(r));
  const tasksToday = tasksHook.tasksForDate(today).filter(t => t.task.type !== 'backlog');
  const doneT      = tasksToday.filter(t => t.done);
  const leftT      = tasksToday.filter(t => !t.done);

  const routinesTomorrow = routinesHook.forDate(tomorrow);
  const tasksTomorrow    = tasksHook.tasksForDate(tomorrow).filter(t => t.task.type !== 'backlog');
  const birthdaysSoon    = birthdays
    .map(b => ({ ...b, days: daysUntil(b.month, b.day) }))
    .filter(b => b.days <= 7)
    .sort((a, b) => a.days - b.days);

  const total = routines.length + tasksToday.length;
  const done  = doneR.length + doneT.length;
  const pct   = total ? Math.round(done / total * 100) : null;

  const headline =
    pct === null ? 'Nothing was scheduled today.'
    : pct === 100 ? 'Everything done. Nice work.'
    : pct >= 70   ? 'Solid day.'
    : pct > 0     ? 'Some progress today.'
    :               'A quiet day. Tomorrow is a fresh start.';

  return (
    <Modal title="Daily Review" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: T.muted }}>{formatLongDate(today)}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            {pct !== null && <span style={{ fontSize: 32, fontWeight: 800, color: T.oliveLight }}>{pct}%</span>}
            <span style={{ fontSize: 14, color: T.text }}>{headline}</span>
          </div>
          {total > 0 && (
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
              {doneR.length}/{routines.length} routines · {doneT.length}/{tasksToday.length} tasks
            </div>
          )}
        </div>

        {(leftR.length > 0 || leftT.length > 0) && (
          <Section title="Still open today">
            {leftR.map(r => {
              const req = getRequiredForDate(r, today);
              const cnt = getCompletionCount(r, today);
              return (
                <Line
                  key={r.id}
                  text={r.name}
                  detail={req > 1 ? `${cnt}/${req}` : 'routine'}
                  action="Done"
                  onAction={() => onIncrement(r.id)}
                />
              );
            })}
            {leftT.map(({ task }) => <Line key={task.id} text={task.name} detail="task" />)}
          </Section>
        )}

        {(doneR.length > 0 || doneT.length > 0) && (
          <Section title="Done today">
            {doneR.map(r => <Line key={r.id} text={r.name} done />)}
            {doneT.map(({ task }) => <Line key={task.id} text={task.name} done />)}
          </Section>
        )}

        <Section title="Tomorrow">
          {routinesTomorrow.length === 0 && tasksTomorrow.length === 0 && (
            <div style={{ fontSize: 13, color: T.muted, padding: '4px 2px' }}>Nothing scheduled.</div>
          )}
          {tasksTomorrow.map(({ task }) => <Line key={task.id} text={task.name} detail="task" />)}
          {routinesTomorrow.length > 0 && (
            <div style={{ fontSize: 13, color: T.muted, padding: '4px 2px' }}>
              {routinesTomorrow.length} routine{routinesTomorrow.length !== 1 ? 's' : ''}: {routinesTomorrow.map(r => r.name).join(', ')}
            </div>
          )}
        </Section>

        {birthdaysSoon.length > 0 && (
          <Section title="Birthdays this week">
            {birthdaysSoon.map(b => (
              <Line key={b.id} text={b.name} detail={b.days === 0 ? 'today' : b.days === 1 ? 'tomorrow' : `in ${b.days} days`} />
            ))}
          </Section>
        )}

        <button
          onClick={onWriteEntry}
          style={{ padding: 13, borderRadius: 12, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 600 }}
        >
          Write a journal entry
        </button>
      </div>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</div>
      {children}
    </div>
  );
}

function Line({ text, detail, done, action, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: T.bg, borderRadius: 10, border: `1px solid ${T.cardBorder}`,
    }}>
      <span style={{ fontSize: 14, color: done ? T.oliveLight : T.text, flex: 1 }}>
        {done ? '✓ ' : ''}{text}
      </span>
      {detail && <span style={{ fontSize: 11, color: T.muted }}>{detail}</span>}
      {action && (
        <button
          onClick={onAction}
          style={{ padding: '5px 10px', borderRadius: 8, background: '#2A3A1A', color: T.khaki, fontSize: 12, fontWeight: 600 }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
