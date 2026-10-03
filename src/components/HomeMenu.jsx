import React from 'react';
import { T } from '../theme';
import { TAB_DEFS } from './BottomNav';

// Start screen: every section as a large tile. Tiles follow the tab order from Settings.
const SECTIONS = {
  routines: {
    color: '#A9BB6C',
    blurb: 'Daily habits & streaks',
    icon: c => (
      <>
        <circle cx="12" cy="12" r="9" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.6" />
        <path d="M8 12.2l2.8 2.8L16.2 9.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  tasks: {
    color: '#8FA89B',
    blurb: 'To-dos & reminders',
    icon: c => (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2.5" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.6" />
        <rect x="9" y="2.5" width="6" height="3.5" rx="1.2" fill={c} />
        <path d="M8.5 11l1.3 1.3 2.4-2.4M8.5 16l1.3 1.3 2.4-2.4M14 11.3h2M14 16.3h2" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  work: {
    color: '#E5A44B',
    blurb: 'Work days & pay',
    icon: c => (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2.5" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.6" />
        <path d="M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7" stroke={c} strokeWidth="1.6" />
        <path d="M3 12.5h18" stroke={c} strokeWidth="1.6" />
        <rect x="10.5" y="11" width="3" height="3" rx="0.8" fill={c} />
      </>
    ),
  },
  shopping: {
    color: '#5EC4A8',
    blurb: 'Shopping lists',
    icon: c => (
      <>
        <path d="M5 8h14l-1.2 11.2A2 2 0 0115.8 21H8.2a2 2 0 01-2-1.8z" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 10V7a3 3 0 016 0v3" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  birthdays: {
    color: '#D9805F',
    blurb: 'Birthdays & gifts',
    icon: c => (
      <>
        <rect x="3.5" y="12" width="17" height="9" rx="2" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.6" />
        <path d="M3.5 15.5c1.4 1 2.9 1 4.3 0s2.9-1 4.2 0 2.9 1 4.3 0 2.8-1 4.2 0" stroke={c} strokeWidth="1.4" />
        <path d="M8 12V9.5M12 12V9.5M16 12V9.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 4.5c.8.9.8 2 0 2.7-.8-.7-.8-1.8 0-2.7zM12 4.5c.8.9.8 2 0 2.7-.8-.7-.8-1.8 0-2.7zM16 4.5c.8.9.8 2 0 2.7-.8-.7-.8-1.8 0-2.7z" fill={c} />
      </>
    ),
  },
  notes: {
    color: '#D4C38A',
    blurb: 'Notes & journal',
    icon: c => (
      <>
        <path d="M5 4.5A1.5 1.5 0 016.5 3H14l5 5v11.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19.5z" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 3v5h5" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.5 12.5h7M8.5 16h5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  lists: {
    color: '#B79CF0',
    blurb: 'Personal lists',
    icon: c => (
      <>
        <rect x="3" y="3.5" width="18" height="17" rx="3" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.6" />
        <circle cx="7.5" cy="8.5" r="1.3" fill={c} />
        <circle cx="7.5" cy="12" r="1.3" fill={c} />
        <circle cx="7.5" cy="15.5" r="1.3" fill={c} />
        <path d="M10.5 8.5h6.5M10.5 12h6.5M10.5 15.5h4.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  investing: {
    color: '#4FCB66',
    blurb: 'Portfolio & prices',
    icon: c => (
      <>
        <path d="M3 20.5h18" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4 17l5-5 3.5 3.5L19 9v8.5a1 1 0 01-1 1H5a1 1 0 01-1-1z" fill={c} fillOpacity="0.22" />
        <path d="M4 17l5-5 3.5 3.5L20 8" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 8H20v4.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
};

export default function HomeMenu({ tabs, onOpen }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 4px 14px' }}>
        {today}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {tabs.map(id => {
          const s = SECTIONS[id];
          const def = TAB_DEFS[id];
          if (!s || !def) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
                minHeight: 128, padding: 16, borderRadius: 18, textAlign: 'left',
                background: T.card, border: `1px solid ${T.cardBorder}`,
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 15, background: s.color + '1F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">{s.icon(s.color)}</svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{def.label}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{s.blurb}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
