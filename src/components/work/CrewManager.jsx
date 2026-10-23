import React, { useState } from 'react';
import { T } from '../../theme';
import { CREW_COLORS } from '../../utils/workUtils';
import SortableList, { DragHandle } from '../SortableList';
import { useBackHandler } from '../../hooks/useBackHandler';
import { FULL_PAGE } from '../../utils/pageStyle';

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

// Optional number this crew's weekly summary gets texted to
function PhoneRow({ crew, onSave, onDone }) {
  const [val, setVal] = useState(crew.phone || '');
  const save = () => { onSave(crew.id, val); onDone(); };
  return (
    <div style={{ padding: '8px 14px 4px' }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Text the weekly summary to <span style={{ color: T.subtle }}>(optional)</span></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          autoFocus
          type="tel"
          inputMode="tel"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Phone number"
          style={{ flex: 1, minWidth: 0, background: T.subtle, border: 'none', outline: 'none', borderRadius: 10, padding: '10px 12px', color: T.text, fontSize: 14 }}
        />
        {crew.phone && (
          <button onClick={() => { onSave(crew.id, ''); onDone(); }} style={{ padding: '10px 12px', borderRadius: 10, background: T.subtle, color: T.red, fontSize: 13 }}>Remove</button>
        )}
        <button onClick={save} style={{ padding: '10px 14px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}>Save</button>
      </div>
    </div>
  );
}

function CrewList({ crews, onDelete, onUpdateColor, onUpdatePhone, onReorder }) {
  const [editingColorId, setEditingColorId] = useState(null);
  const [editingPhoneId, setEditingPhoneId] = useState(null);

  if (crews.length === 0) {
    return <div style={{ fontSize: 13, color: T.muted, padding: '8px 0 2px' }}>None added yet</div>;
  }

  return (
    <div style={{ marginTop: 8 }}>
      <SortableList items={crews} onReorder={onReorder} renderItem={(crew, handle) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.subtle, borderRadius: 10, padding: '6px 14px', minHeight: 32 }}>
            <DragHandle color={T.muted} {...handle} />
            {/* Color swatch — tap to open picker */}
            <button
              onClick={() => { setEditingColorId(editingColorId === crew.id ? null : crew.id); setEditingPhoneId(null); }}
              style={{ width: 22, height: 22, borderRadius: '50%', background: crew.color || CREW_COLORS[0], flexShrink: 0, border: editingColorId === crew.id ? '2px solid #fff' : '2px solid transparent', transition: 'border 0.15s' }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, color: T.text }}>{crew.name}</span>
              {crew.phone && <span style={{ display: 'block', fontSize: 11, color: T.muted }}>Texts to {crew.phone}</span>}
            </span>
            <button
              onClick={() => { setEditingPhoneId(editingPhoneId === crew.id ? null : crew.id); setEditingColorId(null); }}
              aria-label={`Text number for ${crew.name}`}
              style={{ padding: '4px 6px', color: crew.phone ? T.khaki : T.muted, display: 'flex' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 5h16v11H9l-5 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </button>
            <button onClick={() => { onDelete(crew.id); setEditingColorId(null); }} style={{ color: T.red, fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
          {editingPhoneId === crew.id && (
            <PhoneRow crew={crew} onSave={onUpdatePhone} onDone={() => setEditingPhoneId(null)} />
          )}
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
      )} />
    </div>
  );
}

function MemberList({ members, onDelete, onReorder }) {
  if (members.length === 0) {
    return <div style={{ fontSize: 13, color: T.muted, padding: '8px 0 2px' }}>None added yet</div>;
  }
  return (
    <div style={{ marginTop: 8 }}>
      <SortableList items={members} onReorder={onReorder} renderItem={(m, handle) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.subtle, borderRadius: 10, padding: '6px 14px', minHeight: 32 }}>
          <DragHandle color={T.muted} {...handle} />
          <span style={{ flex: 1, fontSize: 14, color: T.text }}>{m.name}</span>
          <button onClick={() => onDelete(m.id)} style={{ color: T.red, fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      )} />
    </div>
  );
}

export default function CrewManager({ crews, members, onAddCrew, onDeleteCrew, onUpdateCrewColor, onUpdateCrewPhone, onAddMember, onDeleteMember, onReorderCrews, onReorderMembers, onClose }) {
  useBackHandler(true, onClose);
  const nextCrewColor = CREW_COLORS[crews.length % CREW_COLORS.length];

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, top: 'var(--vv-top, 0px)', height: 'var(--vv-height, 100%)', zIndex: 100, background: '#000000AA' }} onClick={onClose}>
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: T.bg, borderRadius: '20px 20px 0 0', padding: '20px 20px 0', maxHeight: 'calc(var(--vv-height, 100vh) * 0.8)', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)', ...FULL_PAGE }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span>
            <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: T.text }}>Crews & Members</span>
            <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 2 }}>Hold ≡ and drag to reorder · tap the bubble to add a number for weekly texts</span>
          </span>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Crews</div>
          <CrewList crews={crews} onDelete={onDeleteCrew} onUpdateColor={onUpdateCrewColor} onUpdatePhone={onUpdateCrewPhone} onReorder={onReorderCrews} />
          <AddInput placeholder="Crew name…" onAdd={onAddCrew} nextColor={nextCrewColor} />
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Members</div>
          <MemberList members={members} onDelete={onDeleteMember} onReorder={onReorderMembers} />
          <AddInput placeholder="Member name…" onAdd={onAddMember} />
        </div>
      </div>
    </div>
  );
}
