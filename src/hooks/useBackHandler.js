import { useEffect, useRef } from 'react';

// Screens that can "go back" (sheets, modals, a list opened from an overview…) register
// here; the swipe-from-left-edge gesture runs the most recently opened one.
const stack = [];

export function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const entry = { run: () => ref.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

// Runs the newest back handler; false when nothing is registered
export function runBack() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.run();
  return true;
}
