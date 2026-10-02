import React, { useState } from 'react';
import Modal from './Modal';
import { T } from '../theme';
import { todayStr, addDays, formatLongDate, formatShortDate } from '../utils/dateUtils';
import { getCompletionCount, getRequiredForDate } from '../hooks/useRoutines';
import { daysUntil } from '../utils/birthdayUtils';
import RoutineItem from './routines/RoutineItem';
import { SlipSheet } from './routines/CommitmentSheets';
import { commitmentStats, streakLabel } from '../utils/commitments';

const TASK_BLUE = '#7FA9FF';

// Evening check-in: today's routines and tasks (check them off right here),
// commitments, overdue tasks, tomorrow's tasks and birthdays in the next week
export default function DailyReviewModal({ routinesHook, commitmentsHook, tasksHook, birthdays, onClose }) {
  const [slipping, setSlipping] = useState(null); // { commitment, streak }
  const today    = todayStr();
  const tomorrow = addDays(today, 1);

  const routines   = routinesHook.forDate(today);
  const doneR      = routines.filter(r => getCompletionCount(r, today) >= getRequiredForDate(r, today));
  const leftR      = routines.filter(r => !doneR.includes(r));
  const tasksToday = tasksHook.tasksForDate(today).filter(t => t.task.type !== 'backlog');
  const doneT      = tasksToday.filter(t => t.done);
  const leftT      = tasksToday.filter(t => !t.done);

  // Past-due one-time tasks; ones checked off today stay listed (as done) until tomorrow
  const overdue = tasksHook.tasks
    .filter(t => t.type === 'one-time' && t.date < today && (!t.completedAt || t.completedAt === today))
    .sort((a, b) => !!a.completedAt - !!b.completedAt || a.date.localeCompare(b.date));

  const commitments = [...commitmentsHook.commitments]
    .filter(c => !c.createdAt || c.createdAt <= today)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ c, s: commitmentStats(c, today) }));

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

        <Section title={routines.length ? `Routines (${doneR.length}/${routines.length})` : 'Routines'}>
          {routines.length === 0 ? <Empty>No routines today.</Empty> : (
            <Card>
              {[...leftR, ...doneR].map((r, i) => (
                <RoutineItem
                  key={r.id}
                  first={i === 0}
                  routine={r}
                  onIncrement={id => routinesHook.incrementDay(id, today)}
                  onDecrement={id => routinesHook.decrementDay(id, today)}
                />
              ))}
            </Card>
          )}
        </Section>

        {commitments.length > 0 && (
          <Section title="Commitments">
            <Card>
              {commitments.map(({ c, s }, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 50, padding: '6px 14px', borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 12, marginTop: 2, color: s.failedToday ? T.red : T.muted }}>
                      {s.failedToday ? 'Slipped today' : !s.scheduledToday ? `Rest day · ${streakLabel(s.current)}` : `Kept so far · ${streakLabel(s.current)}`}
                    </div>
                  </div>
                  {s.failedToday ? (
                    <button onClick={() => commitmentsHook.clearSlip(c.id, today)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: T.subtle, color: T.text }}>Undo</button>
                  ) : s.scheduledToday && (
                    <button onClick={() => setSlipping({ commitment: c, streak: s.current })} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${T.red}66`, color: T.red }}>I slipped</button>
                  )}
                </div>
              ))}
            </Card>
          </Section>
        )}

        {overdue.length > 0 && (
          <Section title={`Overdue tasks (${overdue.filter(t => !t.completedAt).length})`} color={T.red}>
            <Card>
              {overdue.map((t, i) => (
                <TaskRow key={t.id} first={i === 0} name={t.name} done={!!t.completedAt}
                  detail={`due ${formatShortDate(t.date)}`} detailColor={T.red}
                  onToggle={() => tasksHook.toggleTaskForDate(t.id, today)} />
              ))}
            </Card>
          </Section>
        )}

        <Section title={tasksToday.length ? `Today's tasks (${doneT.length}/${tasksToday.length})` : "Today's tasks"}>
          {tasksToday.length === 0 ? <Empty>No tasks today.</Empty> : (
            <Card>
              {[...leftT, ...doneT].map(({ task, done }, i) => (
                <TaskRow key={task.id} first={i === 0} name={task.name} done={done} onToggle={() => tasksHook.toggleTaskForDate(task.id, today)} />
              ))}
            </Card>
          )}
        </Section>

        <Section title="Tomorrow's tasks">
          {tasksTomorrow.length === 0 ? <Empty>No tasks tomorrow.</Empty> : (
            <Card>
              {tasksTomorrow.map(({ task }, i) => <TaskRow key={task.id} first={i === 0} name={task.name} />)}
            </Card>
          )}
        </Section>

        <Section title="Birthdays in the next 7 days">
          {birthdaysSoon.length === 0 ? <Empty>No birthdays in the next 7 days.</Empty> : birthdaysSoon.map(b => (
            <Line key={b.id} text={b.name} detail={b.days === 0 ? 'today' : b.days === 1 ? 'tomorrow' : `in ${b.days} days`} />
          ))}
        </Section>
      </div>
      {slipping && (
        <SlipSheet
          name={slipping.commitment.name}
          dateLabel="Today"
          streak={slipping.streak}
          onConfirm={note => commitmentsHook.markSlip(slipping.commitment.id, today, note)}
          onClose={() => setSlipping(null)}
        />
      )}
    </Modal>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: color || T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</div>
      {children}
    </div>
  );
}

function Line({ text, detail }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: T.bg, borderRadius: 10, border: `1px solid ${T.cardBorder}`,
    }}>
      <span style={{ fontSize: 14, color: T.text, flex: 1 }}>{text}</span>
      {detail && <span style={{ fontSize: 11, color: T.muted }}>{detail}</span>}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize: 13, color: T.muted, padding: '4px 2px' }}>{children}</div>;
}

function Card({ children }) {
  return <div style={{ background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 14 }}>{children}</div>;
}

// A task row; with onToggle its circle checks it off (like the routine rows)
function TaskRow({ name, done, onToggle, first, detail, detailColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 50, padding: '4px 14px', borderTop: first ? 'none' : `1px solid ${T.cardBorder}` }}>
      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={done ? `${name}: done (tap to undo)` : `Mark ${name} done`}
          style={{ width: 44, height: 44, marginLeft: -10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{
            width: 24, height: 24, borderRadius: '50%', boxSizing: 'border-box',
            border: done ? 'none' : `2px solid ${T.subtle}`, background: done ? TASK_BLUE : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            {done && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6.2l2.8 2.8L10 3.6" stroke={T.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </button>
      )}
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: done ? T.muted : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: onToggle ? 0 : '8px 0' }}>
        {name}
      </span>
      {detail && <span style={{ fontSize: 11, color: done ? T.muted : detailColor || T.muted, flexShrink: 0 }}>{detail}</span>}
    </div>
  );
}
