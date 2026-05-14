import { useEffect, useRef } from 'react';

export function useSwipe(onLeft, onRight) {
  const ref = useRef(null);
  const onLeftRef  = useRef(onLeft);
  const onRightRef = useRef(onRight);
  onLeftRef.current  = onLeft;
  onRightRef.current = onRight;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = null, startY = null;

    const onStart = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null; startY = null;
      // Only fire if the gesture is more horizontal than vertical
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) onLeftRef.current?.();
        else onRightRef.current?.();
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend',   onEnd);
    };
  }, []);

  return ref;
}
