import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';

const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export default function BirthdayForm({ initial, onSave, onClose }) {
  const [name,  setName]  = useState(initial?.name  || '');
  const [month, setMonth] = useState(initial?.month || 1);
  const [day,   setDay]   = useState(initial?.day   || 1);
  const [year,  setYear]  = useState(initial?.year  ? String(initial.year) : '');

  const maxDay     = MONTH_DAYS[month - 1];
  const clampedDay = Math.min(day, maxDay);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), Number(month), clampedDay, year ? Number(year) : null);
    onClose();
  };

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: T.card,
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
            {initial ? 'Edit Birthday' : 'Add Birthday'}
          </span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 22, padding: '2px 6px' }}>×</button>
        </div>

        <input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 10,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 15, outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{
              flex: 2, padding: '12px 10px', borderRadius: 10,
              background: T.bg, border: `1px solid ${T.cardBorder}`,
              color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark',
            }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>

          <select
            value={clampedDay}
            onChange={e => setDay(Number(e.target.value))}
            style={{
              flex: 1, padding: '12px 10px', borderRadius: 10,
              background: T.bg, border: `1px solid ${T.cardBorder}`,
              color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark',
            }}
          >
            {Array.from({ length: maxDay }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>

        <input
          placeholder="Birth year (optional — shows age)"
          value={year}
          onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 10,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 15, outline: 'none',
          }}
        />

        <button
          onClick={handleSave}
          disabled={!name.trim()}
          style={{
            padding: 14, borderRadius: 12, marginTop: 2,
            background: name.trim() ? T.olive : T.subtle,
            color: '#fff', fontSize: 15, fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          {initial ? 'Save Changes' : 'Add Birthday'}
        </button>
      </div>
    </div>,
    document.body
  );
}
