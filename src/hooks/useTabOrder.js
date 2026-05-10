import { useState } from 'react';

const ALL_TABS     = ['routines', 'tasks', 'work', 'shopping', 'birthdays'];
const STORAGE_KEY  = 'momentumTabOrder';

function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored) && stored.length > 0) {
      // Keep stored order, append any new tabs that weren't stored yet
      const known = stored.filter(t => ALL_TABS.includes(t));
      const added = ALL_TABS.filter(t => !known.includes(t));
      return [...known, ...added];
    }
  } catch {}
  return ALL_TABS;
}

export function useTabOrder() {
  const [order, setOrderState] = useState(load);

  const setOrder = (newOrder) => {
    setOrderState(newOrder);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder)); } catch {}
  };

  return [order, setOrder];
}
