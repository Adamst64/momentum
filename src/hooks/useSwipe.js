import { useEffect, useRef } from 'react';

export function animateSlide(el, dir) {
  if (!el) return;
  const startX = dir === 'next' ? 36 : -36;
  el.style.transition = 'none';
  el.style.transform = `translateX(${startX}px)`;
  el.style.opacity = '0.55';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.26s ease, opacity 0.26s ease';
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });
  });
}

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
