import { useEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  life: number;
  big: boolean;
}

/**
 * Subtle water-ripple rings + glow that follow the cursor inside the header.
 * Renders a canvas and a spotlight layer; listens to pointer events on `hostRef`.
 */
export function WaterRipple({ hostRef }: { hostRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const cv = canvasRef.current;
    if (!host || !cv || prefersReducedMotion()) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let rings: Ring[] = [];
    let raf = 0;
    let last = { x: -99, y: -99, t: 0 };

    const size = () => {
      const r = host.getBoundingClientRect();
      W = r.width;
      H = r.height;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      rings = rings.filter((o) => o.life > 0);
      for (const o of rings) {
        const k = 1 - o.life;
        o.r = o.max * (1 - Math.pow(1 - k, 2.2)) + 2;
        o.life -= o.big ? 0.012 : 0.018;
        const a = Math.max(0, o.life) * (o.big ? 0.34 : 0.24);
        for (let j = 0; j < (o.big ? 3 : 2); j++) {
          const rr = o.r * (1 - j * 0.28);
          if (rr <= 1) continue;
          ctx.beginPath();
          ctx.arc(o.x, o.y, rr, 0, Math.PI * 2);
          ctx.lineWidth = j ? 0.8 : 1.3;
          ctx.strokeStyle = `rgba(${j ? '120,220,170' : '125,180,255'},${a * (1 - j * 0.35)})`;
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `rgba(90,150,255,${a * 0.1})`);
        g.addColorStop(1, 'rgba(90,150,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = rings.length ? requestAnimationFrame(draw) : 0;
    };

    const add = (x: number, y: number, big: boolean) => {
      rings.push({ x, y, r: big ? 6 : 2, max: big ? 190 : 95, life: 1, big });
      if (rings.length > 40) rings.shift();
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      host.style.setProperty('--mx', `${x}px`);
      host.style.setProperty('--my', `${y}px`);
      const now = performance.now();
      if (Math.hypot(x - last.x, y - last.y) > 26 && now - last.t > 70) {
        add(x, y, false);
        last = { x, y, t: now };
      }
    };
    const onDown = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      add(e.clientX - r.left, e.clientY - r.top, true);
    };

    size();
    window.addEventListener('resize', size);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerdown', onDown);
    const ambient = window.setTimeout(() => add(W * 0.82, H * 0.32, true), 900); // one gentle drop on load

    return () => {
      window.removeEventListener('resize', size);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      window.clearTimeout(ambient);
      cancelAnimationFrame(raf);
    };
  }, [hostRef]);

  return (
    <>
      <canvas id="fx" ref={canvasRef} aria-hidden="true" />
      <div className="spot" aria-hidden="true" />
    </>
  );
}
