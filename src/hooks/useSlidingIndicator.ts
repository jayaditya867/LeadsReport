import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * Positions a sliding highlight (`.ind`) under the active button of a segmented control.
 * `activeSelector` is evaluated inside the container; re-measures on `activeKey`, resize and font load.
 */
export function useSlidingIndicator<T extends HTMLElement>(activeSelector: string, activeKey: unknown) {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const box = ref.current;
    const b = box?.querySelector<HTMLElement>(activeSelector);
    if (!box || !b || !b.offsetWidth) return;
    setStyle({ width: b.offsetWidth, transform: `translateX(${b.offsetLeft}px)`, top: b.offsetTop, height: b.offsetHeight });
    setReady(true);
  }, [activeSelector]);

  useLayoutEffect(() => {
    measure();
  }, [measure, activeKey]);

  useLayoutEffect(() => {
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => undefined);
    const ro = typeof ResizeObserver !== 'undefined' && ref.current ? new ResizeObserver(measure) : null;
    if (ro && ref.current) ro.observe(ref.current);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [measure]);

  return { ref, style, ready };
}
