import React from 'react';
import { T } from '../theme';

const tabs = [
  {
    id: 'routines',
    label: 'Routines',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
        <path d="M8 12l3 3 5-5" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'weekly',
    label: 'Weekly',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
        <path d="M3 10h18" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" />
        <path d="M8 3v4M16 3v4" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" strokeLinecap="round" />
        <rect x="6.5"  y="13" width="2" height="4" rx="1" fill={on ? T.khaki : T.muted} opacity="0.7" />
        <rect x="11"   y="13" width="2" height="4" rx="1" fill={on ? T.khaki : T.muted} opacity="0.7" />
        <rect x="15.5" y="13" width="2" height="4" rx="1" fill={on ? T.khaki : T.muted} opacity="0.7" />
      </svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="5"  width="16" height="2" rx="1" fill={on ? T.khaki : T.muted} />
        <rect x="4" y="11" width="12" height="2" rx="1" fill={on ? T.khaki : T.muted} />
        <rect x="4" y="17" width="8"  height="2" rx="1" fill={on ? T.khaki : T.muted} />
      </svg>
    ),
  },
  {
    id: 'shopping',
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
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#161618',
      borderTop: `1px solid ${T.cardBorder}`,
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
      height: `calc(${T.navH}px + env(safe-area-inset-bottom))`,
    }}>
      {tabs.map(tab => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, paddingTop: 8,
              color: on ? T.khaki : T.muted,
              fontSize: 10, fontWeight: on ? 600 : 400,
              transition: 'color 0.2s',
            }}
          >
            {tab.icon(on)}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
