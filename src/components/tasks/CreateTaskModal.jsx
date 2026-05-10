import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr } from '../../utils/dateUtils';

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none',
};

const TYPE_LABELS = {
  'one-time':          'One-time',
  'recurring-monthly': 'Monthly',
  'backlog':           'Backlog',
};

export default function CreateTaskModal({ initial, onSave, onClose }) {
  const isEdit = !!initial;
  const [name,         setName]         = useState(initial?.name || '');
  const [type,         setType]         = useState(initial?.type || 'one-time');
  const [date,         setDate]         = useState(initial?.date || todayStr());
  const [dom,          setDom]          = useState(initial?.dayOfMonth || 1);
  const [notifyOn,     setNotifyOn]     = useState(initial?.notify?.enabled || false);
  const [notifyTime,   setNotifyTime]   = useState(initial?.notify?.time || '09:00');

  const valid = name.trim() && (
    type === 'backlog' ||
    (type === 'one-time' && date) ||
    (type === 'recurring-monthly' && dom >= 1 && dom <= 31)
  );

  const save = () => {
    if (!valid) return;
    const data = { name: name.trim(), type };
    if (type === 'one-time')          data.date       = date;
    if (type === 'recurring-monthly') data.dayOfMonth = Number(dom);
    if (type === 'one-time' || type === 'recurring-monthly') {
      if (notifyOn) {
        data.notify = {
          enabled: true,
          time: notifyTime,
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
          autoFocus
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
                onChange={e => setDom(Math.min(31, Math.max(1, Number(e.target.value))))}
                style={{ ...inputStyle, width: 100, textAlign: 'center' }}
              />
              <span style={{ color: T.muted, fontSize: 14 }}>of every month</span>
            </div>
          </div>
        )}

        {type === 'backlog' && (
          <div style={{ padding: '8px 12px', background: '#0F0F0F', borderRadius: 10, border: `1px solid ${T.cardBorder}` }}>
            <span style={{ fontSize: 13, color: T.muted }}>No due date — sits in your backlog until you schedule it</span>
          </div>
        )}

        {(type === 'one-time' || type === 'recurring-monthly') && (
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
              <input
                type="time"
                value={notifyTime}
                onChange={e => setNotifyTime(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark', width: 'auto' }}
              />
            )}
          </div>
        )}

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
      </div>
    </Modal>
  );
}
