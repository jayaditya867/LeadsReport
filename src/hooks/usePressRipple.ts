import { useEffect } from 'react';
import { prefersReducedMotion } from '../lib/motion';

const TARGETS = '.btn,.chip,.morebtn,.switch button,.seg button,.role button,.link';

/** Soft "press" ripple on buttons, chips and segmented controls (document-level, one listener). */
export function usePressRipple() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const onDown = (e: PointerEvent) => {
      const b = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(TARGETS);
      if (!b || b.disabled) return;
      b.classList.add('rp');
      const r = b.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement('span');
      s.className = 'rip';
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(s);
      window.setTimeout(() => s.remove(), 650);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
}
