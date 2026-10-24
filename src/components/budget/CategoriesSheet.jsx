import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { SubBar } from '../TabBar';
import CategoryForm from './CategoryForm';

// Every category, to rename, re-emoji, recolor, delete or add to
export default function CategoriesSheet({ categories, txs, onAdd, onUpdate, onRemove, onClose }) {
  const [kind, setKind]       = useState('expense');
  const [editing, setEditing] = useState(null); // null | 'new' | category

  const shown = categories.filter(c => c.kind === kind && !c.hidden && !c.fixed);

  return (
    <Modal title="Categories" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Expenses · Income · New, in the sub-bar (no scrolling to the bottom to add one) */}
        <SubBar
          items={[
            { value: 'expense', label: 'Expenses', icon: 'M12 4v16M6 14l6 6 6-6' },
            { value: 'income', label: 'Income', icon: 'M12 20V4M6 10l6-6 6 6' },
            { value: 'new', label: `New ${kind === 'income' ? 'income' : 'expense'}`, icon: 'M12 5v14M5 12h14', onPress: () => setEditing('new') },
          ]}
          value={kind} onChange={setKind}
        />

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
      </div>

      {editing && (
        <CategoryForm
          initial={editing === 'new' ? null : editing}
          kind={kind}
          categories={categories}
          txs={txs}
          onSave={data => editing === 'new' ? onAdd(data) : onUpdate(editing.id, data)}
          onRemove={editing === 'new' ? null : moveTo => onRemove(editing.id, moveTo)}
          onClose={() => setEditing(null)}
        />
      )}
    </Modal>
  );
}
