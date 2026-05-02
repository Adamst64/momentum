import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { DAYS_SHORT } from '../../utils/dateUtils';

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none',
};

export default function CreateRoutineModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [days, setDays] = useState(initial?.days || [1, 2, 3, 4, 5]);

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const save = () => {
    if (!name.trim() || days.length === 0) return;
    onSave(name.trim(), days);
    onClose();
  };

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
