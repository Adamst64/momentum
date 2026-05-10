import React, { useState } from 'react';
import { T } from '../../theme';
import { CREW_COLORS } from '../../utils/workUtils';

function AddInput({ placeholder, onAdd, nextColor }) {
  const [val, setVal] = useState('');
  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim(), nextColor);
    setVal('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        style={{ flex: 1, background: T.subtle, border: 'none', outline: 'none', borderRadius: 10, padding: '10px 12px', color: T.text, fontSize: 14 }}
      />
      <button onClick={submit} style={{ padding: '10px 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}>Add</button>
    </div>
  );
}

function CrewList({ crews, onDelete, onUpdateColor }) {
  const [editingColorId, setEditingColorId] = useState(null);

  if (crews.length === 0) {
    return <div style={{ fontSize: 13, color: T.muted, padding: '8px 0 2px' }}>None added yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {crews.map(crew => (
        <div key={crew.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.subtle, borderRadius: 10, padding: '10px 14px' }}>
            {/* Color swatch — tap to open picker */}
            <button
              onClick={() => setEditingColorId(editingColorId === crew.id ? null : crew.id)}
              style={{ width: 22, height: 22, borderRadius: '50%', background: crew.color || CREW_COLORS[0], flexShrink: 0, border: editingColorId === crew.id ? '2px solid #fff' : '2px solid transparent', transition: 'border 0.15s' }}
            />
            <span style={{ flex: 1, fontSize: 14, color: T.text }}>{crew.name}</span>
            <button onClick={() => { onDelete(crew.id); setEditingColorId(null); }} style={{ color: T.red, fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
          {editingColorId === crew.id && (
            <div style={{ display: 'flex', gap: 8, padding: '8px 14px 4px', flexWrap: 'wrap' }}>
              {CREW_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { onUpdateColor(crew.id, color); setEditingColorId(null); }}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: color, border: crew.color === color ? '2.5px solid #fff' : '2.5px solid transparent', transition: 'border 0.1s' }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MemberList({ members, onDelete }) {
  if (members.length === 0) {
    return <div style={{ fontSize: 13, color: T.muted, padding: '8px 0 2px' }}>None added yet</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {members.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.subtle, borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: 14, color: T.text }}>{m.name}</span>
          <button onClick={() => onDelete(m.id)} style={{ color: T.red, fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      ))}
    </div>
  );
}

export default function CrewManager({ crews, members, onAddCrew, onDeleteCrew, onUpdateCrewColor, onAddMember, onDeleteMember, onClose }) {
  const nextCrewColor = CREW_COLORS[crews.length % CREW_COLORS.length];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000000AA' }} onClick={onClose}>
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: T.bg, borderRadius: '20px 20px 0 0', padding: '20px 20px 0', maxHeight: '80vh', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Crews & Members</span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 24, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Crews</div>
          <CrewList crews={crews} onDelete={onDeleteCrew} onUpdateColor={onUpdateCrewColor} />
          <AddInput placeholder="Crew name…" onAdd={onAddCrew} nextColor={nextCrewColor} />
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Members</div>
          <MemberList members={members} onDelete={onDeleteMember} />
          <AddInput placeholder="Member name…" onAdd={onAddMember} />
        </div>
      </div>
    </div>
  );
}
