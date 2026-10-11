import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { Chips } from '../investing/ui';
import CategoryForm from './CategoryForm';

const KINDS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income',  label: 'Income' },
];

// Every category, to rename, re-emoji, recolor, delete or add to
export default function CategoriesSheet({ categories, onAdd, onUpdate, onRemove, onClose }) {
  const [kind, setKind]       = useState('expense');
  const [editing, setEditing] = useState(null); // null | 'new' | category

  const shown = categories.filter(c => c.kind === kind && !c.hidden && !c.fixed);

  return (
    <Modal title="Categories" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Chips options={KINDS} value={kind} onChange={setKind} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {shown.map(c => (
            <button
              key={c.id}
              onClick={() => setEditing(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', textAlign: 'left',
                borderBottom: `1px solid ${T.cardBorder}`,
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: 10, background: c.color + '2E', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {c.emoji}
              </span>
              <span style={{ flex: 1, fontSize: 15, color: T.text }}>{c.label}</span>
              <span style={{ color: T.muted, fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setEditing('new')}
          style={{ padding: 13, borderRadius: 12, border: `1px dashed ${T.subtle}`, color: T.khaki, fontSize: 15, fontWeight: 600 }}
        >
          + New {kind === 'income' ? 'income' : 'expense'} category
        </button>
      </div>

      {editing && (
        <CategoryForm
          initial={editing === 'new' ? null : editing}
          kind={kind}
          onSave={data => editing === 'new' ? onAdd(data) : onUpdate(editing.id, data)}
          onRemove={editing === 'new' ? null : () => onRemove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </Modal>
  );
}
