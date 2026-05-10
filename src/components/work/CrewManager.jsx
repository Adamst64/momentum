import React, { useState } from 'react';
import { T } from '../../theme';

function AddInput({ placeholder, onAdd }) {
  const [val, setVal] = useState('');
  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim());
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

function ItemList({ items, onDelete }) {
  if (items.length === 0) {
    return <div style={{ fontSize: 13, color: T.muted, padding: '8px 0 2px' }}>None added yet</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.subtle, borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: 14, color: T.text }}>{item.name}</span>
          <button onClick={() => onDelete(item.id)} style={{ color: T.red, fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      ))}
    </div>
  );
}

export default function CrewManager({ crews, members, onAddCrew, onDeleteCrew, onAddMember, onDeleteMember, onClose }) {
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
          <ItemList items={crews} onDelete={onDeleteCrew} />
          <AddInput placeholder="Crew name…" onAdd={onAddCrew} />
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Members</div>
          <ItemList items={members} onDelete={onDeleteMember} />
          <AddInput placeholder="Member name…" onAdd={onAddMember} />
        </div>
      </div>
    </div>
  );
}
