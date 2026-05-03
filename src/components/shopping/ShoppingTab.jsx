import React, { useState, useRef } from 'react';
import { T } from '../../theme';

export default function ShoppingTab({ hook }) {
  const { items, addItem, toggleItem, deleteItem, clearFinished, clearAll } = hook;
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const unchecked = items.filter(i => !i.checked);
  const checked   = items.filter(i => i.checked);

  const handleAdd = () => {
    if (!input.trim()) return;
    addItem(input);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Add input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add item…"
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            background: T.card, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 15, outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          style={{
            padding: '12px 18px', borderRadius: 12,
            background: input.trim() ? T.olive : T.subtle,
            color: '#fff', fontSize: 15, fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          Add
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: '32px 16px', textAlign: 'center', color: T.muted, fontSize: 14,
        }}>
          Your shopping list is empty
        </div>
      )}

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {unchecked.map(item => (
            <ShoppingItem key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
          ))}
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, color: T.muted, textTransform: 'uppercase',
            letterSpacing: 0.8, marginBottom: 8,
          }}>
            In cart ({checked.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checked.map(item => (
              <ShoppingItem key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {checked.length > 0 && (
            <button
              onClick={clearFinished}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                border: `1px solid ${T.cardBorder}`,
                color: T.muted, fontSize: 13, fontWeight: 500, background: 'transparent',
              }}
            >
              Clear done ({checked.length})
            </button>
          )}
          <button
            onClick={clearAll}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              border: `1px solid ${T.red}33`,
              color: T.red, fontSize: 13, fontWeight: 500, background: 'transparent',
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function ShoppingItem({ item, onToggle, onDelete }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`,
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      opacity: item.checked ? 0.55 : 1,
      transition: 'opacity 0.15s',
    }}>
      <button
        onClick={() => onToggle(item.id)}
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: item.checked ? 'none' : `2px solid ${T.muted}`,
          background: item.checked ? T.olive : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {item.checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <span style={{
        flex: 1, fontSize: 15, color: T.text, fontWeight: 500,
        textDecoration: item.checked ? 'line-through' : 'none',
      }}>
        {item.name}
      </span>

      <button
        onClick={() => onDelete(item.id)}
        style={{ color: T.subtle, fontSize: 18, padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
