import React from 'react';
import { completionColor } from '../utils/colors';

const R = 40;
const STROKE = 10;
const C = 60;
const CIRC = 2 * Math.PI * R;

export default function DonutChart({ done, total, size = 120 }) {
  const ratio = total === 0 ? 0 : done / total;
  const color = completionColor(ratio);
  const dash = ratio * CIRC;
  const gap  = CIRC - dash;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
      {/* track */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="#2C2C2E" strokeWidth={STROKE} />
      {/* progress */}
      <circle
        cx={C} cy={C} r={R}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeDasharray={`${dash} ${gap}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.5s ease' }}
      />
      {/* counter-rotate text to undo parent -90deg rotation */}
      <text
        x={C} y={C}
        textAnchor="middle" dominantBaseline="central"
        transform={`rotate(90,${C},${C})`}
        fill="#F5F0E8"
        fontSize="15"
        fontWeight="600"
      >
        {done}/{total}
      </text>
    </svg>
  );
}
