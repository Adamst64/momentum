import React, { useState } from 'react';
import { T } from '../../theme';
import TagBadge from './TagBadge';
import TagPickerSheet from './TagPickerSheet';

function InventoryItem({ item, tags, inList, onEdit, onDelete, onAddToList, onOpenTagPicker }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  const saveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== item.name) onEdit(item.id, { name: trimmed });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditName(item.name);
    setEditing(false);
  };

  const itemTags = tags.filter(t => item.tagIds?.includes(t.id));

  if (editing) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.olive}`, borderRadius: 12, padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 8,
              background: T.bg, border: `1px solid ${T.cardBorder}`, color: T.text,
              fontSize: 15, outline: 'none',
            }}
          />
          <button onClick={saveEdit} style={{
            padding: '7px 14px', borderRadius: 8,
            background: T.olive, color: T.text, fontSize: 13, fontWeight: 600,
          }}>Save</button>
          <button onClick={cancelEdit} style={{ color: T.muted, fontSize: 20, padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
        <button onClick={() => onOpenTagPicker(item)} style={{
          marginTop: 8, padding: '5px 10px', borderRadius: 8,
          background: T.subtle, border: 'none', color: T.muted, fontSize: 12,
        }}>
          {itemTags.length > 0 ? `${itemTags.length} tag${itemTags.length > 1 ? 's' : ''} — edit` : 'Add tags'}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`,
      borderRadius: 12, padding: '11px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontSize: 15, color: T.text, fontWeight: 500 }}>{item.name}</span>

        <button
          onClick={() => !inList && onAddToList(item)}
          disabled={inList}
          style={{
            padding: '4px 10px', borderRadius: 8, flexShrink: 0,
            background: inList ? 'transparent' : '#1A2410',
            border: `1px solid ${inList ? T.cardBorder : T.olive + '44'}`,
            color: inList ? T.subtle : T.oliveLight,
            fontSize: 12, fontWeight: 600,
            cursor: inList ? 'default' : 'pointer',
          }}
        >{inList ? 'In list' : '+ List'}</button>

        <button onClick={() => { setEditName(item.name); setEditing(true); }} style={{
          color: T.muted, fontSize: 13, padding: '2px 7px', borderRadius: 6,
          background: T.subtle, border: 'none', lineHeight: 1, flexShrink: 0,
        }}>✎</button>

        <button onClick={() => onDelete(item.id)} style={{
          color: T.red, fontSize: 18, padding: '2px 4px', lineHeight: 1, flexShrink: 0,
          background: 'none', border: 'none',
        }}>×</button>
      </div>

      {itemTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {itemTags.map(t => <TagBadge key={t.id} tag={t} />)}
        </div>
      )}
    </div>
  );
}

export default function InventoryTab({ inventory, items, tags, onEdit, onDelete, onAddToList, onAddTag, onUpdateTag, onDeleteTag }) {
  const [tagPickerItem, setTagPickerItem] = useState(null);
  const [search, setSearch] = useState('');

  const listNames = new Set((items || []).map(i => i.name.toLowerCase()));

  const filtered = search.trim()
    ? inventory.filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : inventory;

  const handleTagPickerConfirm = async (selectedIds) => {
    if (tagPickerItem) await onEdit(tagPickerItem.id, { tagIds: selectedIds });
    setTagPickerItem(null);
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search inventory…"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '11px 14px', borderRadius: 12,
          background: T.card, border: `1px solid ${T.cardBorder}`,
          color: T.text, fontSize: 15, outline: 'none',
        }}
      />

      {filtered.length === 0 ? (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: '32px 16px', textAlign: 'center', color: T.muted, fontSize: 14,
        }}>
          {search.trim() ? 'No items match your search' : 'No items in inventory yet — add items to your list to populate it'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => (
            <InventoryItem
              key={item.id}
              item={item}
              tags={tags}
              inList={listNames.has(item.name.toLowerCase())}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddToList={onAddToList}
              onOpenTagPicker={setTagPickerItem}
            />
          ))}
        </div>
      )}

      {tagPickerItem !== null && (
        <TagPickerSheet
          tags={tags}
          selectedIds={tagPickerItem?.tagIds || []}
          onAddTag={onAddTag}
          onUpdateTag={onUpdateTag}
          onDeleteTag={onDeleteTag}
          onConfirm={handleTagPickerConfirm}
          onClose={() => setTagPickerItem(null)}
        />
      )}
    </div>
  );
}
