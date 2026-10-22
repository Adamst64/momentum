import { useEffect, useRef, useState } from 'react';

// Screens that can "go back" (sheets, modals, a list opened from an overview…) register
// here; the swipe-from-left-edge gesture runs the most recently opened one.
const stack = [];
const listeners = new Set();
const changed = () => listeners.forEach(fn => fn(stack.length));

export function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const entry = { run: () => ref.current() };
    stack.push(entry);
    changed();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      changed();
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

// How many screens are open on top of the page (for the floating back button)
export function useBackDepth() {
  const [n, setN] = useState(stack.length);
  useEffect(() => {
    listeners.add(setN);
    setN(stack.length);
    return () => listeners.delete(setN);
  }, []);
  return n;
}
