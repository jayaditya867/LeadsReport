import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

interface Props {
  value: number;
  /** Change this to replay the count-up (e.g. on first load or currency change). */
  playKey: string | number;
  duration?: number;
  className?: string;
}

/** Number that counts up from 0 (ease-out) when `playKey` changes; otherwise updates instantly. */
export function AnimatedNumber({ value, playKey, duration = 900, className }: Props) {
  // count up on first mount too (as in the approved mockup)
  const [animating, setAnimating] = useState(() => value > 0 && !prefersReducedMotion());
  const [shown, setShown] = useState(() => (animating ? 0 : value));
  const [lastKey, setLastKey] = useState(playKey);
  const [lastValue, setLastValue] = useState(value);

  // Derive state during render (no effect needed for plain value changes).
  if (playKey !== lastKey) {
    setLastKey(playKey);
    setLastValue(value);
    if (!prefersReducedMotion() && value > 0) setAnimating(true);
    else setShown(value);
  } else if (value !== lastValue) {
    setLastValue(value);
    if (!animating) setShown(value);
  }

  useEffect(() => {
    if (!animating) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(lastValue * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else setAnimating(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animating, lastValue, duration]);

  return <span className={className}>{shown}</span>;
}
