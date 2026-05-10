import React from 'react';
import { T } from '../theme';

const TAB_DEFS = {
  routines: {
    label: 'Routines',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
        <path d="M8 12l3 3 5-5" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  tasks: {
    label: 'Tasks',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="5"  width="16" height="2" rx="1" fill={on ? T.khaki : T.muted} />
        <rect x="4" y="11" width="12" height="2" rx="1" fill={on ? T.khaki : T.muted} />
        <rect x="4" y="17" width="8"  height="2" rx="1" fill={on ? T.khaki : T.muted} />
      </svg>
    ),
  },
  shopping: {
    label: 'Shopping',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2H3" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3 2l2.5 10.5A2 2 0 007.46 14H17.5a2 2 0 001.96-1.6L21 6H6" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="19" r="1.5" fill={on ? T.khaki : T.muted} />
        <circle cx="17" cy="19" r="1.5" fill={on ? T.khaki : T.muted} />
      </svg>
    ),
  },
  birthdays: {
    label: 'Birthdays',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="13" width="20" height="8" rx="2" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
        <path d="M6 13v-3M12 13v-3M18 13v-3" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="6"  cy="8" r="1.8" fill={on ? T.khaki : T.muted} />
        <circle cx="12" cy="8" r="1.8" fill={on ? T.khaki : T.muted} />
        <circle cx="18" cy="8" r="1.8" fill={on ? T.khaki : T.muted} />
      </svg>
    ),
  },
  work: {
    label: 'Work',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2.5" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
        <line x1="3" y1="12" x2="21" y2="12" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
        <line x1="12" y1="3" x2="12" y2="21" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
      </svg>
    ),
  },
};

export { TAB_DEFS };

export default function BottomNav({ active, onChange, tabOrder }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#161618',
      borderTop: `1px solid ${T.cardBorder}`,
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
      height: `calc(${T.navH}px + env(safe-area-inset-bottom))`,
    }}>
      {tabOrder.map(id => {
        const def = TAB_DEFS[id];
        if (!def) return null;
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, paddingTop: 8,
              color: on ? T.khaki : T.muted,
              fontSize: 10, fontWeight: on ? 600 : 400,
              transition: 'color 0.2s',
            }}
          >
            {def.icon(on)}
            {def.label}
          </button>
        );
      })}
    </nav>
  );
}
