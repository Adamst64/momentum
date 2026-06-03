import React, { useState, useEffect } from 'react';
import { T } from '../../theme';

function Counter({ label, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const startEdit = () => { setRaw(value === 0 ? '' : String(value)); setEditing(true); };
  const commitEdit = () => {
    const n = parseInt(raw, 10);
    onChange(isNaN(n) || n < 0 ? 0 : n);
    setEditing(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0' }}>
      <span style={{ fontSize: 15, color: T.text }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          style={{ width: 36, height: 36, borderRadius: 10, background: T.subtle, color: T.text, fontSize: 22, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >−</button>
        {editing ? (
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
            style={{ width: 50, textAlign: 'center', fontSize: 18, fontWeight: 700, color: T.text, background: T.subtle, border: 'none', outline: 'none', borderRadius: 8, padding: '4px 0' }}
          />
        ) : (
          <button
            onClick={startEdit}
            style={{ minWidth: 30, textAlign: 'center', fontSize: 18, fontWeight: 700, color: T.text, background: 'transparent', padding: '4px 6px', borderRadius: 8 }}
          >{value}</button>
        )}
        <button
          onClick={() => onChange(value + 1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: T.subtle, color: T.text, fontSize: 22, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >+</button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, activeColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0' }}>
      <span style={{ fontSize: 15, color: T.text }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 50, height: 28, borderRadius: 14, background: value ? (activeColor || T.olive) : T.subtle, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
      >
        <div style={{ position: 'absolute', top: 3, left: value ? 25 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left 0.2s' }} />
      </button>
    </div>
  );
}

const EMPTY = { windows: 0, doors: 0, crewId: null, memberIds: [], isCrewLead: false, comment: '', isOff: false };
const norm = (base) => ({ ...EMPTY, ...base });

export default function WorkDayForm({ dateStr, initial, crews, members, onSave, onDelete }) {
  const [form, setForm]                   = useState(() => norm(initial));
  const [lastSaved, setLastSaved]         = useState(() => initial ? norm(initial) : null);
  const [confirmClear, setConfirmClear]   = useState(false);
  const [showCrewPicker, setShowCrewPicker]     = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  useEffect(() => {
    setForm(norm(initial));
    setLastSaved(initial ? norm(initial) : null);
  }, [dateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty   = lastSaved === null || JSON.stringify(form) !== JSON.stringify(lastSaved);
  const showSaved = lastSaved !== null && !isDirty;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    onSave(dateStr, form);
    setLastSaved({ ...form });
  };

  const isEmpty = !form.isOff && form.windows === 0 && form.doors === 0 && !form.crewId && form.memberIds.length === 0 && !form.comment;
  const selectedCrew = crews.find(c => c.id === form.crewId);
  const availableMembers = members.filter(m => !form.memberIds.includes(m.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Day off toggle */}
      <div style={{ background: T.card, borderRadius: 14, padding: '0 16px', border: `1px solid ${form.isOff ? T.red + '55' : T.cardBorder}` }}>
        <Toggle
          label="Day off"
          value={form.isOff}
          onChange={v => set('isOff', v)}
          activeColor={T.red}
        />
      </div>

      {!form.isOff && (
        <>
          {/* Windows & Doors */}
          <div style={{ background: T.card, borderRadius: 14, padding: '0 16px', border: `1px solid ${T.cardBorder}` }}>
            <Counter label="Windows" value={form.windows} onChange={v => set('windows', v)} />
            <div style={{ height: 1, background: T.cardBorder }} />
            <Counter label="Doors"   value={form.doors}   onChange={v => set('doors',   v)} />
          </div>

          {/* Crew & Lead */}
          <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.cardBorder}` }}>
            <button
              onClick={() => setShowCrewPicker(true)}
              style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span style={{ fontSize: 15, color: T.text }}>Crew</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {selectedCrew?.color && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedCrew.color }} />
                )}
                <span style={{ fontSize: 15, color: selectedCrew ? T.text : T.muted }}>
                  {selectedCrew ? selectedCrew.name : 'None'}
                </span>
                <span style={{ color: T.muted, fontSize: 13 }}>›</span>
              </div>
            </button>
            <div style={{ height: 1, background: T.cardBorder, marginLeft: 16 }} />
            <div style={{ padding: '0 16px' }}>
              <Toggle label="Crew Lead" value={form.isCrewLead} onChange={v => set('isCrewLead', v)} />
            </div>
          </div>

          {/* Members */}
          <div style={{ background: T.card, borderRadius: 14, padding: '12px 16px', border: `1px solid ${T.cardBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.memberIds.length > 0 ? 10 : 0 }}>
              <span style={{ fontSize: 15, color: T.text }}>Members on site</span>
              <button onClick={() => setShowMemberPicker(true)} style={{ fontSize: 13, color: T.oliveLight, fontWeight: 600 }}>+ Add</button>
            </div>
            {form.memberIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.memberIds.map(id => {
                  const m = members.find(x => x.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.subtle, borderRadius: 8, padding: '5px 10px' }}>
                      <span style={{ fontSize: 13, color: T.text }}>{m.name}</span>
                      <button onClick={() => set('memberIds', form.memberIds.filter(mid => mid !== id))} style={{ color: T.muted, fontSize: 16, lineHeight: 1, marginLeft: 2 }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comment */}
          <div style={{ background: T.card, borderRadius: 14, padding: '12px 16px', border: `1px solid ${T.cardBorder}` }}>
            <textarea
              value={form.comment}
              onChange={e => set('comment', e.target.value)}
              placeholder="Notes…"
              rows={3}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: 14, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </div>
        </>
      )}

      {/* Save / Clear */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: showSaved ? T.green + '33' : T.olive,
            color: showSaved ? T.green : '#fff',
            fontSize: 15, fontWeight: 600,
            transition: 'background 0.2s, color 0.2s',
            opacity: !isDirty ? 0.5 : 1,
          }}
        >
          {showSaved ? 'Saved ✓' : 'Save Day'}
        </button>
        {!isEmpty && onDelete && !confirmClear && (
          <button
            onClick={() => setConfirmClear(true)}
            style={{ padding: '14px 18px', borderRadius: 14, background: T.red + '22', color: T.red, fontSize: 14 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Clear confirmation */}
      {confirmClear && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: T.red + '11', border: `1px solid ${T.red + '44'}`, borderRadius: 14, padding: '12px 16px' }}>
          <span style={{ flex: 1, fontSize: 14, color: T.text }}>Clear this day's data?</span>
          <button
            onClick={() => setConfirmClear(false)}
            style={{ padding: '8px 14px', borderRadius: 10, background: T.subtle, color: T.muted, fontSize: 13, fontWeight: 600 }}
          >Cancel</button>
          <button
            onClick={() => { setConfirmClear(false); onDelete(dateStr); }}
            style={{ padding: '8px 14px', borderRadius: 10, background: T.red + '33', color: T.red, fontSize: 13, fontWeight: 700 }}
          >Clear</button>
        </div>
      )}

      {/* Crew picker sheet */}
      {showCrewPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000000AA' }} onClick={() => setShowCrewPicker(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: T.card, borderRadius: '20px 20px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, padding: '20px 20px 10px' }}>Select Crew</div>
            <button
              onClick={() => { set('crewId', null); setShowCrewPicker(false); }}
              style={{ width: '100%', padding: '14px 20px', textAlign: 'left', fontSize: 15, color: !form.crewId ? T.khaki : T.text, fontWeight: !form.crewId ? 700 : 400 }}
            >None</button>
            {crews.map(c => (
              <button
                key={c.id}
                onClick={() => { set('crewId', c.id); setShowCrewPicker(false); }}
                style={{ width: '100%', padding: '14px 20px', textAlign: 'left', fontSize: 15, color: form.crewId === c.id ? T.khaki : T.text, fontWeight: form.crewId === c.id ? 700 : 400 }}
              >{c.name}</button>
            ))}
            {crews.length === 0 && (
              <div style={{ padding: '8px 20px 16px', fontSize: 14, color: T.muted }}>No crews yet — add them in Manage Crews.</div>
            )}
            <div style={{ height: 20 }} />
          </div>
        </div>
      )}

      {/* Member picker sheet */}
      {showMemberPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000000AA' }} onClick={() => setShowMemberPicker(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: T.card, borderRadius: '20px 20px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, padding: '20px 20px 10px' }}>Add Members</div>
            {availableMembers.length === 0 ? (
              <div style={{ padding: '8px 20px 16px', fontSize: 14, color: T.muted }}>
                {members.length === 0 ? 'No members saved yet — add them in Manage Crews.' : 'All members already added.'}
              </div>
            ) : (
              availableMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => set('memberIds', [...form.memberIds, m.id])}
                  style={{ width: '100%', padding: '14px 20px', textAlign: 'left', fontSize: 15, color: T.text }}
                >+ {m.name}</button>
              ))
            )}
            <button onClick={() => setShowMemberPicker(false)} style={{ width: '100%', padding: '14px 20px', textAlign: 'center', fontSize: 14, color: T.muted, marginTop: 4 }}>Done</button>
            <div style={{ height: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
}
