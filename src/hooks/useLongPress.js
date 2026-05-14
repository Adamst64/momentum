import { useEffect, useRef } from 'react';

export function useLongPress(onLongPress, delay = 500) {
  const ref   = useRef(null);
  const cbRef = useRef(onLongPress);
  cbRef.current = onLongPress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.userSelect          = 'none';
    el.style.webkitUserSelect    = 'none';
    el.style.webkitTouchCallout  = 'none';

    let timer  = null;
    let fired  = false;
    let startX = 0, startY = 0;

    const start = (e) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      fired  = false;
      timer  = setTimeout(() => {
        fired = true;
        navigator.vibrate?.(10);
        cbRef.current();
      }, delay);
    };

    const move = (e) => {
      if (!timer) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) {
        clearTimeout(timer); timer = null;
      }
    };

    const end = (e) => {
      clearTimeout(timer); timer = null;
      if (fired) e.preventDefault(); // block the follow-up click
      fired = false;
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove',  move,  { passive: true });
    el.addEventListener('touchend',   end,   { passive: false });

    return () => {
      clearTimeout(timer);
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove',  move);
      el.removeEventListener('touchend',   end);
    };
  }, [delay]);

  return ref;
}
