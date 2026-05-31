import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import TagBadge from './TagBadge';
import ShoppingItem from './ShoppingItem';
import TagPickerSheet from './TagPickerSheet';
import ShareSheet from './ShareSheet';
import InventoryTab from './InventoryTab';

export default function ShoppingTab({ hook, userId }) {
  const {
    lists, activeList, activeListId, setActiveListId,
    items, tags, inventory,
    addItem, toggleItem, updateItemTags, renameItem, deleteItem, clearFinished, clearAll,
    addTag, updateTag, deleteTag,
    updateInventoryItem, deleteInventoryItem, addItemFromInventory,
    createList, renameList, leaveOrDeleteList, regenerateCode, joinList,
  } = hook;

  const [view, setView]                 = useState('list');
  const [input, setInput]               = useState('');
  const [pendingTagIds, setPendingTagIds] = useState([]);
  const [filterTagId, setFilterTagId]   = useState(null);
  const [tagPickerItem, setTagPickerItem] = useState(null);
  const [showShare, setShowShare]       = useState(false);
  const [showNewList, setShowNewList]   = useState(false);
  const [newListName, setNewListName]   = useState('');
  const [newListInventory, setNewListInventory] = useState(false);
  const inputRef = useRef(null);

  const closeNewList = () => { setShowNewList(false); setNewListName(''); setNewListInventory(false); };

  useEffect(() => { setFilterTagId(null); setView('list'); }, [activeListId]);

  const handleAdd = () => {
    if (!input.trim()) return;
    addItem(input, pendingTagIds);
    setInput('');
    setPendingTagIds([]);
    inputRef.current?.focus();
  };

  const handleTagPickerConfirm = async (selectedIds) => {
    if (tagPickerItem === 'new') {
      setPendingTagIds(selectedIds);
    } else if (tagPickerItem) {
      await updateItemTags(tagPickerItem.id, selectedIds);
    }
    setTagPickerItem(null);
  };

  const filteredItems = filterTagId ? items.filter(i => i.tagIds?.includes(filterTagId)) : items;
  const unchecked     = filteredItems.filter(i => !i.checked);
  const checked       = filteredItems.filter(i => i.checked);
  const pendingTags   = pendingTagIds.map(id => tags.find(t => t.id === id)).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* List tabs */}
      {lists.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 12px', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto', paddingBottom: 2 }}>
            {lists.map(list => (
              <button key={list.id} onClick={() => setActiveListId(list.id)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                whiteSpace: 'nowrap', flexShrink: 0,
                background: list.id === activeListId ? T.olive : T.card,
                color: list.id === activeListId ? T.text : T.muted,
                border: `1px solid ${list.id === activeListId ? T.olive : T.cardBorder}`,
              }}>
                {list.name}
              </button>
            ))}
            <button onClick={() => setShowNewList(true)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 16, fontWeight: 700,
              flexShrink: 0, background: 'transparent', color: T.muted,
              border: `1px dashed ${T.cardBorder}`,
            }}>+</button>
          </div>
          <button onClick={() => setShowShare(true)} style={{ flexShrink: 0, padding: 6, background: 'none', border: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke={T.olive} strokeWidth="1.8" />
              <circle cx="6" cy="12" r="3" stroke={T.olive} strokeWidth="1.8" />
              <circle cx="18" cy="19" r="3" stroke={T.olive} strokeWidth="1.8" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke={T.olive} strokeWidth="1.8" strokeLinecap="round" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke={T.olive} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* List / Inventory toggle — shown when inventory is enabled or list already has inventory items */}
      {(activeList?.hasInventory || inventory.length > 0) && (
        <div style={{ display: 'flex', background: T.subtle, borderRadius: 10, padding: 3, gap: 2, margin: '0 16px 12px' }}>
          {['list', 'inventory'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '7px 0', borderRadius: 8,
              background: view === v ? T.card : 'transparent',
              color: view === v ? T.text : T.muted,
              fontSize: 13, fontWeight: 600, transition: 'background 0.15s, color 0.15s',
              textTransform: 'capitalize',
            }}>
              {v === 'inventory' ? `Inventory${inventory.length > 0 ? ` (${inventory.length})` : ''}` : 'List'}
            </button>
          ))}
        </div>
      )}

      {view === 'inventory' && (activeList?.hasInventory || inventory.length > 0) ? (
        <InventoryTab
          inventory={inventory}
          items={items}
          tags={tags}
          onEdit={updateInventoryItem}
          onDelete={deleteInventoryItem}
          onAddToList={(invItem) => { addItemFromInventory(invItem); }}
          onAddTag={addTag}
          onUpdateTag={updateTag}
          onDeleteTag={deleteTag}
        />
      ) : (
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Tag filter chips */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => setFilterTagId(null)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', flexShrink: 0,
              background: !filterTagId ? T.olive : T.card,
              color: !filterTagId ? T.text : T.muted,
              border: `1px solid ${!filterTagId ? T.olive : T.cardBorder}`,
            }}>All</button>
            {tags.map(tag => (
              <button key={tag.id} onClick={() => setFilterTagId(prev => prev === tag.id ? null : tag.id)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                background: filterTagId === tag.id ? tag.color + '22' : T.card,
                color: filterTagId === tag.id ? tag.color : T.muted,
                border: `1px solid ${filterTagId === tag.id ? tag.color + '88' : T.cardBorder}`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color, display: 'inline-block', flexShrink: 0 }} />
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Add item row */}
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTagPickerItem('new')} style={{
              padding: '12px 10px', borderRadius: 12, flexShrink: 0,
              background: pendingTagIds.length > 0 ? T.olive + '33' : T.card,
              border: `1px solid ${pendingTagIds.length > 0 ? T.olive + '88' : T.cardBorder}`,
              color: pendingTagIds.length > 0 ? T.oliveLight : T.muted,
              fontSize: 12, fontWeight: 600, minWidth: 44,
            }}>
              {pendingTagIds.length > 0 ? `${pendingTagIds.length}` : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
                    stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="7" y1="7" x2="7.01" y2="7" stroke={T.muted} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
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
            <button onClick={handleAdd} disabled={!input.trim()} style={{
              padding: '12px 18px', borderRadius: 12,
              background: input.trim() ? T.olive : T.subtle,
              color: T.text, fontSize: 15, fontWeight: 600, transition: 'background 0.15s',
            }}>Add</button>
          </div>
          {pendingTags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, paddingLeft: 2 }}>
              {pendingTags.map(t => <TagBadge key={t.id} tag={t} />)}
            </div>
          )}
        </div>

        {/* Empty state */}
        {filteredItems.length === 0 && (
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '32px 16px', textAlign: 'center', color: T.muted, fontSize: 14,
          }}>
            {filterTagId ? 'No items with this tag' : 'Your shopping list is empty'}
          </div>
        )}

        {/* Unchecked items */}
        {unchecked.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unchecked.map(item => (
              <ShoppingItem key={item.id} item={item} tags={tags}
                onToggle={toggleItem} onDelete={deleteItem}
                onEditTags={setTagPickerItem} onRename={renameItem} />
            ))}
          </div>
        )}

        {/* Checked items */}
        {checked.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              In cart ({checked.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checked.map(item => (
                <ShoppingItem key={item.id} item={item} tags={tags}
                  onToggle={toggleItem} onDelete={deleteItem}
                  onEditTags={setTagPickerItem} onRename={renameItem} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {checked.length > 0 && (
              <button onClick={clearFinished} style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                border: `1px solid ${T.cardBorder}`,
                color: T.muted, fontSize: 13, fontWeight: 500, background: 'transparent',
              }}>
                Clear done ({checked.length})
              </button>
            )}
            <button onClick={clearAll} style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              border: `1px solid ${T.red}33`,
              color: T.red, fontSize: 13, fontWeight: 500, background: 'transparent',
            }}>
              Clear all
            </button>
          </div>
        )}
      </div>
      )}

      {view === 'list' && tagPickerItem !== null && (
        <TagPickerSheet
          tags={tags}
          selectedIds={tagPickerItem === 'new' ? pendingTagIds : (tagPickerItem?.tagIds || [])}
          onAddTag={addTag}
          onUpdateTag={updateTag}
          onDeleteTag={deleteTag}
          onConfirm={handleTagPickerConfirm}
          onClose={() => setTagPickerItem(null)}
        />
      )}

      {showShare && activeList && (
        <ShareSheet
          list={activeList}
          userId={userId}
          onClose={() => setShowShare(false)}
          onJoin={joinList}
          onLeaveOrDelete={() => { leaveOrDeleteList(); setShowShare(false); }}
          onRegenerate={regenerateCode}
          onRename={renameList}
        />
      )}

      {showNewList && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={closeNewList}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: T.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>New List</div>
            <input
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newListName.trim()) {
                  createList(newListName, newListInventory); closeNewList();
                }
              }}
              placeholder="List name"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, marginBottom: 12,
                background: T.bg, border: `1px solid ${T.cardBorder}`, color: T.text,
                fontSize: 15, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => setNewListInventory(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 12,
                background: T.bg, border: `1px solid ${newListInventory ? T.olive + '66' : T.cardBorder}`,
                color: newListInventory ? T.text : T.muted, fontSize: 14, boxSizing: 'border-box',
              }}
            >
              <span>Enable inventory</span>
              <div style={{
                width: 36, height: 20, borderRadius: 10, position: 'relative',
                background: newListInventory ? T.olive : T.subtle,
                transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: newListInventory ? 19 : 3,
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </div>
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={closeNewList} style={{
                flex: 1, padding: '12px', borderRadius: 10, background: 'transparent',
                border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 15,
              }}>Cancel</button>
              <button
                onClick={() => { createList(newListName, newListInventory); closeNewList(); }}
                disabled={!newListName.trim()}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: newListName.trim() ? T.olive : T.subtle,
                  color: T.text, fontSize: 15, fontWeight: 600,
                }}
              >Create</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
