import { useState } from 'react';

export const ALL_TABS = ['routines', 'tasks', 'work', 'shopping', 'birthdays', 'notes', 'lists'];

export function useTabOrder() {
  return useState([...ALL_TABS]);
}
