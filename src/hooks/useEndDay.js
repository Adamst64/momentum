import { useState, useCallback, useEffect, useRef } from 'react';
import { toDateStr } from '../utils/dateUtils';

const KEY = 'momentum_days_ended';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
};

export function useEndDay() {
  const [endedDays, setEndedDays] = useState(load);
  const endedDaysRef = useRef(endedDays);

  const persist = useCallback((next) => {
    endedDaysRef.current = next;
    localStorage.setItem(KEY, JSON.stringify(next));
    setEndedDays(next);
  }, []);

  const endDay = useCallback((dateStr) => {
    persist({ ...endedDaysRef.current, [dateStr]: true });
  }, [persist]);

  const isDayEnded = useCallback((dateStr) => {
    return !!endedDays[dateStr];
  }, [endedDays]);

  // Auto-end at 4am if not already ended manually
  useEffect(() => {
    let timer;
    const schedule = () => {
      const now = new Date();
      const next4am = new Date(now);
      if (now.getHours() >= 4) next4am.setDate(next4am.getDate() + 1);
      next4am.setHours(4, 0, 0, 0);

      timer = setTimeout(() => {
        const prevDay = new Date(next4am);
        prevDay.setDate(prevDay.getDate() - 1);
        const dateStr = toDateStr(prevDay);
        if (!endedDaysRef.current[dateStr]) {
          persist({ ...endedDaysRef.current, [dateStr]: true });
        }
        schedule();
      }, next4am - now);
    };

    schedule();
    return () => clearTimeout(timer);
  }, [persist]);

  return { endDay, isDayEnded };
}
