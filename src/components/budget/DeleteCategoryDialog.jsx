import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { money } from '../../utils/budget';
import { PrimaryButton } from '../investing/ui';

// Deleting a category. With entries in it, choose: move them to another category
// (the default: the category is then gone for good), or keep them as they are
// (it's only hidden from the picker; history doesn't change).
export default function DeleteCategoryDialog({ category, categories, txs, onDelete, onClose }) {
  const used = txs.filter(t => t.category === category.id);
  const total = used.reduce((s, t) => s + t.amount, 0);
  const targets = categories.filter(c => c.kind === category.kind && c.id !== category.id && !c.hidden && !c.fixed);
  const fallback = targets.find(c => c.id === (category.kind === 'income' ? 'other-income' : 'other')) || targets[0];
  const [mode, setMode] = useState(used.length ? 'move' : 'delete');
  const [moveTo, setMoveTo] = useState(fallback?.id || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onDelete(mode === 'move' ? moveTo : null);
      onClose(true);
    } catch (e) {
      setErr(e.message || 'Could not delete. Try again.');
      setBusy(false);
    }
  };

  const radio = (value, title, sub) => (
    <button type="button" onClick={() => setMode(value)}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '10px 12px', borderRadius: 12,
        background: mode === value ? '#2A3A1A' : T.bg, border: `1px solid ${mode === value ? T.olive : T.cardBorder}` }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 1, border: `2px solid ${mode === value ? T.khaki : T.subtle}`,
        background: mode === value ? T.khaki : 'transparent', boxShadow: mode === value ? `inset 0 0 0 3px ${T.bg}` : 'none' }} />
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>{sub}</span>
      </span>
    </button>
  );

  return (
    <Modal title={`Delete ${category.emoji} ${category.label}?`} onClose={() => onClose(false)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {used.length === 0 ? (
          <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>Nothing is logged in it, so it's simply removed.</div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5 }}>
              It has <b>{used.length} entr{used.length === 1 ? 'y' : 'ies'}</b> ({money(total)}). What should happen to them?
            </div>
            {radio('move', 'Move them to another category', 'The category is removed completely; past totals count under the one you pick.')}
            {mode === 'move' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, paddingLeft: 4 }}>
                {targets.map(c => (
                  <button key={c.id} type="button" onClick={() => setMoveTo(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 8px', borderRadius: 10, minWidth: 0, fontSize: 12.5,
                      background: moveTo === c.id ? c.color + '2E' : T.bg, border: `1px solid ${moveTo === c.id ? c.color : T.cardBorder}`,
                      color: moveTo === c.id ? T.text : T.muted, fontWeight: moveTo === c.id ? 600 : 400 }}>
                    <span aria-hidden="true">{c.emoji}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                  </button>
                ))}
              </div>
            )}
            {radio('keep', 'Keep them as they are', "It's no longer offered for new entries, but your history doesn't change.")}
          </>
        )}
        {err && <div style={{ fontSize: 13, color: T.red }}>{err}</div>}
        <PrimaryButton danger onClick={go} disabled={busy || (mode === 'move' && !moveTo)}>
          {busy ? 'Deleting…' : mode === 'move' ? `Move ${used.length} & delete` : 'Delete category'}
        </PrimaryButton>
        <button onClick={() => onClose(false)} style={{ padding: 10, color: T.muted, fontSize: 14 }}>Cancel</button>
      </div>
    </Modal>
  );
}
