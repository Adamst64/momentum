import React from 'react';

export default function TagBadge({ tag }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: tag.color + '22', border: `1px solid ${tag.color}55`,
      fontSize: 11, color: tag.color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {tag.name}
    </span>
  );
}
