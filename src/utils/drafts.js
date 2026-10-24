import { useEffect, useRef, useState } from 'react';

// Unfinished "Add" forms. A field kept with useDraft(key, initial) works like
// useState, but the bottom bar can tell it was typed in (hasUnsaved) and, when
// you switch away, either keep it for when you come back (keepDrafts) or
// throw it away (closing the form does that). Kept in memory, not saved.
// key null = a normal field (e.g. editing an existing entry: no draft).
const drafts = new Map();  // key → value of a kept or in-progress field
const active = new Map();  // key → is it different from its starting value
const kept = new Set();    // fields to keep when their form closes

export function useDraft(key, initial) {
  const [value, setValue] = useState(() => (key && drafts.has(key) ? drafts.get(key) : typeof initial === 'function' ? initial() : initial));
  const start = useRef(null);
  if (start.current === null) start.current = JSON.stringify(typeof initial === 'function' ? initial() : initial) ?? 'null';
  useEffect(() => {
    if (!key) return;
    const dirty = (JSON.stringify(value) ?? 'null') !== start.current;
    if (dirty) drafts.set(key, value); else drafts.delete(key);
    active.set(key, dirty);
  }, [key, value]);
  useEffect(() => () => {
    if (!key) return;
    active.delete(key);
    if (kept.has(key)) kept.delete(key); else drafts.delete(key);
  }, [key]);
  return [value, setValue];
}

// Something typed into an open Add form and not saved yet
export const hasUnsaved = () => [...active.values()].some(Boolean);

// "Keep draft": the open forms' fields survive their forms closing
export function keepDrafts() {
  for (const [k, dirty] of active) if (dirty) kept.add(k);
}
