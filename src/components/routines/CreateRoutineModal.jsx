import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { DAYS_SHORT, DAYS_FULL } from '../../utils/dateUtils';

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none',
};

function CountStepper({ value, onChange, min = 1, max = 10 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 32, height: 32, borderRadius: '8px 0 0 8px',
          background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
          color: value <= min ? T.subtle : T.text, fontSize: 18, lineHeight: 1,
        }}
      >−</button>
      <div style={{
        width: 36, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F0F0F', borderTop: `1px solid ${T.cardBorder}`, borderBottom: `1px solid ${T.cardBorder}`,
        fontSize: 15, fontWeight: 600, color: T.text,
      }}>{value}</div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 32, height: 32, borderRadius: '0 8px 8px 0',
          background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
          color: value >= max ? T.subtle : T.text, fontSize: 18, lineHeight: 1,
        }}
      >+</button>
    </div>
  );
}

export default function CreateRoutineModal({ initial, onSave, onClose }) {
  const [name,             setName]             = useState(initial?.name || '');
  const [days,             setDays]             = useState(initial?.days || [1, 2, 3, 4, 5]);
  const [timesPerDay,      setTimesPerDay]      = useState(initial?.timesPerDay || 1);
  const [timesPerDayByDow, setTimesPerDayByDow] = useState(initial?.timesPerDayByDow || {});

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSetTimesPerDay = (val) => {
    setTimesPerDay(val);
    if (val === 1) setTimesPerDayByDow({});
  };

  const setDowOverride = (dow, value) => {
    setTimesPerDayByDow(prev => {
      const next = { ...prev };
      if (value === timesPerDay) delete next[String(dow)];
      else next[String(dow)] = value;
      return next;
    });
  };

  const save = () => {
    if (!name.trim() || days.length === 0) return;
    const byDow = Object.fromEntries(
      Object.entries(timesPerDayByDow).filter(([dow]) => days.includes(Number(dow)))
    );
    onSave(name.trim(), days, timesPerDay, byDow);
    onClose();
  };

  const sortedDays = [...days].sort((a, b) => a - b);

  return (
    <Modal title={initial ? 'Edit Routine' : 'New Routine'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          style={inputStyle}
          placeholder="Routine name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />

        <div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Repeat on
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DAYS_SHORT.map((label, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  style={{
                    flex: 1, height: 40, borderRadius: 8,
                    background: on ? T.olive : '#0F0F0F',
                    border: `1px solid ${on ? T.olive : T.cardBorder}`,
                    color: on ? '#fff' : T.muted,
                    fontSize: 12, fontWeight: on ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: T.muted }}>Times per day</span>
          <div style={{ marginLeft: 'auto' }}>
            <CountStepper value={timesPerDay} onChange={handleSetTimesPerDay} />
          </div>
        </div>

        {timesPerDay > 1 && sortedDays.length > 0 && (
          <div style={{
            background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
            borderRadius: 10, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Override per day
            </div>
            {sortedDays.map(dow => {
              const val = timesPerDayByDow[String(dow)] ?? timesPerDay;
              return (
                <div key={dow} style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: val !== timesPerDay ? T.khaki : T.text, minWidth: 90 }}>
                    {DAYS_FULL[dow]}
                  </span>
                  <div style={{ marginLeft: 'auto' }}>
                    <CountStepper value={val} onChange={v => setDowOverride(dow, v)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={save}
          style={{
            width: '100%', padding: 14, borderRadius: 12,
            background: name.trim() && days.length ? T.olive : T.subtle,
            color: name.trim() && days.length ? '#fff' : T.muted,
            fontSize: 16, fontWeight: 600,
            transition: 'background 0.2s',
          }}
        >
          {initial ? 'Save Changes' : 'Add Routine'}
        </button>
      </div>
    </Modal>
  );
}
