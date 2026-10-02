import React from 'react';
import { T } from '../theme';

// 15 tint colors for notes and lists, saved on the item so it never changes on its own
export const TINTS = [
  '#E0625A', '#E8875A', '#E5A44B', '#D4C38A', '#C9C25A',
  '#A9BB6C', '#4FCB66', '#3DB89B', '#5EC4D4', '#7FA9FF',
  '#6F7FE8', '#B79CF0', '#D57FE0', '#E88AA6', '#A39A8E',
];

// Items saved before tints existed get a fixed color from their id (not their position)
export function fallbackTint(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function TintPicker({ value, onChange, allowNone = true }) {
  const swatch = (color, label) => {
    const on = value === color;
    return (
      <button
        key={label}
        type="button"
        onClick={() => onChange(color)}
        aria-label={label}
        aria-pressed={on}
        style={{
          width: 36, height: 36, borderRadius: 18, flexShrink: 0,
          background: color || 'transparent',
          border: color ? `3px solid ${on ? '#fff' : 'transparent'}` : `2px dashed ${on ? '#fff' : T.subtle}`,
          boxShadow: on ? `0 0 0 2px ${color || T.subtle}` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.muted, fontSize: 16,
        }}
      >
        {!color && '×'}
      </button>
    );
  };
  return (
    <div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Color</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 8, justifyItems: 'center' }}>
        {allowNone && swatch(null, 'No color')}
        {TINTS.map((c, i) => swatch(c, `Color ${i + 1}`))}
      </div>
    </div>
  );
}
