import React, { useEffect } from 'react';
import { T } from '../theme';

// Switcher along the bottom of a section (like Robinhood's): its views, and
// sometimes an action (e.g. Crews opens its page). While shown it sets
// --tabbar-h, so the main menu button, add buttons and page padding move up.
// items: [{ value, label, icon (SVG path, 24×24), onPress? }]
export const TABBAR_H = 58;

export default function TabBar({ items, value, onChange }) {
  useEffect(() => {
    const s = document.documentElement.style;
    s.setProperty('--tabbar-h', `${TABBAR_H}px`);
    return () => s.removeProperty('--tabbar-h');
  }, []);
  return (
    <nav style={{
      position: 'fixed', zIndex: 95, left: 0, right: 0, bottom: 0, margin: '0 auto', maxWidth: 430,
      background: T.card, borderTop: `1px solid ${T.cardBorder}`,
      paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex',
    }}>
      {items.map(v => {
        const on = !v.onPress && v.value === value;
        const color = on ? T.khaki : T.muted;
        return (
          <button key={v.value} onClick={() => (v.onPress ? v.onPress() : onChange(v.value))} aria-current={on ? 'page' : undefined}
            style={{ flex: 1, minWidth: 0, height: TABBAR_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d={v.icon} stroke={color} strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color, whiteSpace: 'nowrap' }}>{v.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Each view opens at its top, not where the last one was scrolled to
export function scrollToTop() {
  window.scrollTo(0, 0);
  document.querySelector('main')?.scrollTo?.(0, 0);
}

// Shared icons (24×24 stroke paths)
export const ICONS = {
  chart: 'M3 17l5-6 4 3 6-8 3 3',
  list: 'M4 7h16M4 12h16M4 17h10',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z',
  bulb: 'M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3zM9.5 19h5M10.5 21.5h3',
  today: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  calendar: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7zM4 10h16M8 3v4M16 3v4',
  check: 'M4 12l5 5L20 6',
  stack: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  handshake: 'M8 12l3 3a2 2 0 003-3l-3-3M3 11l4-4 4 2 3-2 4 1 3 4-6 6M3 11l5 5',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6 10v4M18 10v4',
  people: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18 14a5.5 5.5 0 013.5 6',
  cake: 'M4 21h16M5 21v-7h14v7M12 14V9M12 6.5c-.8-1 .2-2.5 0-3.5 1.2 1 1.8 2.5 0 3.5zM5 17c2 1.5 3.5-1 5.5 0s3.5 1.5 5.5 0 2 0 3 0',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10',
  cart: 'M3 4h2l2.5 11h11L21 7H6.5M9 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z',
  pie: 'M12 3v9h9A9 9 0 1112 3zM15 3.5A9 9 0 0120.5 9H15V3.5z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4',
  bars: 'M5 20V12M10 20V6M15 20v-9M20 20V9',
  home: 'M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z',
};
