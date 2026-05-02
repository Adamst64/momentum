import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toDateStr } from '../utils/dateUtils';

export function useEndDay(userId) {
  const [endedDays, setEndedDays] = useState({});
  const endedDaysRef = useRef({});

  useEffect(() => {
    if (!userId) { setEndedDays({}); endedDaysRef.current = {}; return; }
    const ref = doc(db, 'users', userId, 'meta', 'endedDays');
    return onSnapshot(ref, snap => {
      const data = snap.exists() ? snap.data() : {};
      endedDaysRef.current = data;
      setEndedDays(data);
    });
  }, [userId]);

  const persist = useCallback(async (next) => {
    if (!userId) return;
    endedDaysRef.current = next;
    setEndedDays(next);
    await setDoc(doc(db, 'users', userId, 'meta', 'endedDays'), next);
  }, [userId]);

  const endDay = useCallback((dateStr) => {
    persist({ ...endedDaysRef.current, [dateStr]: true });
  }, [persist]);

  const isDayEnded = useCallback((dateStr) => {
    return !!endedDays[dateStr];
  }, [endedDays]);

  // Auto-end at 4am
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
