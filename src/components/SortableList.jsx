import React, { useRef, useState } from 'react';

// Vertical list reordered by dragging a handle. renderItem(item, handleProps, dragging)
// spreads handleProps onto the handle; onReorder(ids) gets the new order on release.
// The handle uses touch-action: none so dragging it never scrolls the page.
export default function SortableList({ items, keyOf = x => x.id, onReorder, renderItem, gap = 6 }) {
  const [order, setOrder]   = useState(null); // ids while dragging
  const [dragId, setDragId] = useState(null);
  const [offset, setOffset] = useState(0);
  const refs  = useRef({});
  const drag  = useRef(null); // { id, startY, order }

  const byId = Object.fromEntries(items.map(i => [keyOf(i), i]));
  const list = order ? order.map(id => byId[id]).filter(Boolean) : items;

  const begin = (e, id) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const ids = items.map(keyOf);
    drag.current = { id, startY: e.clientY, order: ids, original: ids.join() };
    setOrder(ids);
    setDragId(id);
    setOffset(0);
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    let dy = e.clientY - d.startY;
    const ord = [...d.order];
    let idx = ord.indexOf(d.id);
    const h = id => (refs.current[id]?.offsetHeight || 0) + gap;
    // Swap with a neighbour once the dragged row passes its middle
    while (idx < ord.length - 1 && dy > h(ord[idx + 1]) / 2) {
      const step = h(ord[idx + 1]);
      [ord[idx], ord[idx + 1]] = [ord[idx + 1], ord[idx]];
      idx++; d.startY += step; dy -= step;
    }
    while (idx > 0 && dy < -h(ord[idx - 1]) / 2) {
      const step = h(ord[idx - 1]);
      [ord[idx], ord[idx - 1]] = [ord[idx - 1], ord[idx]];
      idx--; d.startY -= step; dy += step;
    }
    d.order = ord;
    setOrder(ord);
    setOffset(dy);
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    setDragId(null);
    setOffset(0);
    setOrder(null);
    if (d && d.order.join() !== d.original) onReorder(d.order);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {list.map(item => {
        const id = keyOf(item);
        const dragging = id === dragId;
        const handleProps = {
          onPointerDown: e => begin(e, id),
          onPointerMove: move,
          onPointerUp: end,
          onPointerCancel: end,
          'aria-label': 'Drag to reorder',
          style: { touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' },
        };
        return (
          <div
            key={id}
            ref={el => { refs.current[id] = el; }}
            style={{
              position: 'relative', zIndex: dragging ? 2 : 1,
              transform: dragging ? `translateY(${offset}px) scale(1.02)` : 'none',
              boxShadow: dragging ? '0 8px 20px rgba(0,0,0,0.5)' : 'none',
              borderRadius: 10,
              transition: dragging ? 'box-shadow 0.15s' : 'transform 0.15s',
            }}
          >
            {renderItem(item, handleProps, dragging)}
          </div>
        );
      })}
    </div>
  );
}

export function DragHandle({ color, ...props }) {
  return (
    <button type="button" {...props} style={{ ...props.style, width: 32, height: 36, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
