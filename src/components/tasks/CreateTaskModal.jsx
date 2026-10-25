import React, { useState } from 'react';
import { StickyFooter } from '../investing/ui';
import { useDraft } from '../../utils/drafts';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr, getDOW, DAYS_SHORT } from '../../utils/dateUtils';
import { BEFORE_OPTIONS, remindersOf } from '../../utils/taskReminders';

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none',
};

// Monday first
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TYPE_LABELS = {
  'one-time':          'One-time',
  'recurring-weekly':  'Weekly',
  'recurring-monthly': 'Monthly',
  'backlog':           'Backlog',
};

export default function CreateTaskModal({ initial, onSave, onClose }) {
  // A new task keeps what's typed as a draft when you switch away (see utils/drafts)
  const dk = name => (initial ? null : `task-add.${name}`);
  const isEdit = !!initial;
  const [name,         setName]         = useDraft(dk('name'), initial?.name || '');
  const [type,         setType]         = useDraft(dk('type'), initial?.type || 'one-time');
  const [date,         setDate]         = useDraft(dk('date'), initial?.date || todayStr());
  const [dom,          setDom]          = useDraft(dk('dom'), String(initial?.dayOfMonth || 1));
  const [dow,          setDow]          = useDraft(dk('dow'), initial?.dayOfWeek ?? getDOW(todayStr()));
  const [notifyOn,     setNotifyOn]     = useDraft(dk('notifyOn'), initial?.notify?.enabled || false);
  const [reminders,    setReminders]    = useDraft(dk('reminders'), remindersOf(initial?.notify).length ? remindersOf(initial.notify) : [{ daysBefore: 0, time: '09:00' }]);
  const setReminder = (i, patch) => setReminders(rs => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  // One-time tasks: show the actual day each reminder lands on
  const dayLabel = before => {
    if (type !== 'one-time' || !date) return '';
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - before);
    return ` (${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`;
  };

  const valid = name.trim() && (
    type === 'backlog' ||
    (type === 'one-time' && date) ||
    type === 'recurring-weekly' ||
    (type === 'recurring-monthly' && parseInt(dom, 10) >= 1 && parseInt(dom, 10) <= 31)
  );

  const save = () => {
    if (!valid) return;
    const data = { name: name.trim(), type };
    if (type === 'one-time')          data.date       = date;
    if (type === 'recurring-monthly') data.dayOfMonth = Math.min(31, Math.max(1, parseInt(dom, 10) || 1));
    if (type === 'recurring-weekly')  data.dayOfWeek  = dow;
    if (type !== 'backlog') {
      // Same day and time twice is one reminder
      const list = [...new Map(reminders.filter(r => r.time).map(r => [`${r.daysBefore}@${r.time}`, r])).values()]
        .sort((a, b) => b.daysBefore - a.daysBefore || a.time.localeCompare(b.time));
      if (notifyOn && list.length) {
        data.notify = {
          enabled: true,
          time: list[0].time,
          reminders: list,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      } else {
        data.notify = { enabled: false };
      }
    }
    onSave(data);
    onClose();
  };

  return (
    <Modal title={isEdit ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          style={inputStyle}
          placeholder="Task name"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Type — locked in edit mode */}
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(TYPE_LABELS).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => !isEdit && setType(t)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12,
                fontWeight: type === t ? 600 : 400,
                background: type === t ? T.olive : '#0F0F0F',
                border: `1px solid ${type === t ? T.olive : T.cardBorder}`,
                color: type === t ? '#fff' : T.muted,
                opacity: isEdit && type !== t ? 0.35 : 1,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {type === 'one-time' && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Due date</div>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
        )}

        {type === 'recurring-monthly' && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Day of month
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                min="1" max="31"
                value={dom}
                onChange={e => setDom(e.target.value)}
                style={{ ...inputStyle, width: 100, textAlign: 'center' }}
              />
              <span style={{ color: T.muted, fontSize: 14 }}>of every month</span>
            </div>
          </div>
        )}

        {type === 'recurring-weekly' && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Every week on
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {WEEK_ORDER.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDow(d)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13,
                    fontWeight: dow === d ? 600 : 400,
                    background: dow === d ? T.olive : '#0F0F0F',
                    border: `1px solid ${dow === d ? T.olive : T.cardBorder}`,
                    color: dow === d ? '#fff' : T.muted,
                  }}
                >
                  {DAYS_SHORT[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'backlog' && (
          <div style={{ padding: '8px 12px', background: '#0F0F0F', borderRadius: 10, border: `1px solid ${T.cardBorder}` }}>
            <span style={{ fontSize: 13, color: T.muted }}>No due date — sits in your backlog until you schedule it</span>
          </div>
        )}

        {type !== 'backlog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: T.text }}>Notify me</span>
              {/* Pill switch */}
              <button
                type="button"
                onClick={() => setNotifyOn(v => !v)}
                style={{
                  width: 44, height: 26, borderRadius: 13,
                  background: notifyOn ? T.olive : T.subtle,
                  border: 'none', cursor: 'pointer',
                  position: 'relative', flexShrink: 0,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  left: notifyOn ? 21 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>
            {notifyOn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reminders.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={r.daysBefore}
                      onChange={e => setReminder(i, { daysBefore: Number(e.target.value) })}
                      style={{ ...inputStyle, flex: 1, minWidth: 0, colorScheme: 'dark', fontSize: 14, padding: '11px 10px' }}
                    >
                      {BEFORE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}{dayLabel(o.value)}</option>)}
                    </select>
                    <input
                      type="time"
                      value={r.time}
                      onChange={e => setReminder(i, { time: e.target.value })}
                      style={{ ...inputStyle, colorScheme: 'dark', width: 'auto', fontSize: 14, padding: '11px 10px' }}
                    />
                    {reminders.length > 1 && (
                      <button type="button" onClick={() => setReminders(rs => rs.filter((_, k) => k !== i))} aria-label="Remove reminder"
                        style={{ fontSize: 18, color: T.muted, padding: '0 4px', flexShrink: 0 }}>×</button>
                    )}
                  </div>
                ))}
                {reminders.length < 5 && (
                  <button type="button" onClick={() => setReminders(rs => [...rs, { daysBefore: 1, time: rs[rs.length - 1]?.time || '09:00' }])}
                    style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: T.khaki, padding: '4px 0' }}>
                    + Add another reminder
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <StickyFooter>
          <button
            type="button"
            onClick={save}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: valid ? T.olive : T.subtle,
              color: valid ? '#fff' : T.muted,
              fontSize: 16, fontWeight: 600, transition: 'background 0.2s',
            }}
          >
            {isEdit ? 'Save Changes' : 'Add Task'}
          </button>
        </StickyFooter>
      </div>
    </Modal>
  );
}
