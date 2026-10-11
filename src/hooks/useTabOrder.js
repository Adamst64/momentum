import { useState } from 'react';

export const ALL_TABS = ['routines', 'tasks', 'work', 'shopping', 'birthdays', 'notes', 'lists', 'investing', 'budget'];

export function useTabOrder(initial) {
  // Keep only known tabs and append any new ones the saved order predates
  return useState(() => Array.isArray(initial)
    ? [...initial.filter(t => ALL_TABS.includes(t)), ...ALL_TABS.filter(t => !initial.includes(t))]
    : [...ALL_TABS]);
}
