import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Role, View } from '../../types';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator';
import { Icon, type IconName } from '../ui/Icon';
import { CountPill } from '../ui/Badges';
import { Reveal } from '../ui/Reveal';
import { WaterRipple } from './WaterRipple';
import logo from '../../assets/manav-crm-logo.png';

interface HeroProps {
  role: Role;
  onRole: (r: Role) => void;
  view: View;
  onView: (v: View) => void;
  counts: Record<View, number>;
  /** Summary tiles, banner and filters — rendered on the dark background. */
  children?: ReactNode;
}

export function Hero({ role, onRole, view, onView, counts, children }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // The dark background ends halfway down the (first row of) tiles: publish the overlap as --kcut
  // (used by .herocontent / .wrap) and keep it in sync as the tiles resize or wrap.
  useLayoutEffect(() => {
    const host = contentRef.current;
    if (!host) return;
    const root = document.documentElement;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const row = host.firstElementChild;
      const total = row?.getBoundingClientRect().height ?? 0;
      const first = row?.firstElementChild?.getBoundingClientRect().height ?? total;
      root.style.setProperty('--kcut', `${Math.round(total - first / 2)}px`);
    };
    const sync = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    // watch the tile row (not the wrapper, whose height depends on --kcut)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    const watch = () => {
      ro?.disconnect();
      const row = host.firstElementChild;
      if (row) ro?.observe(row);
      if (row?.firstElementChild) ro?.observe(row.firstElementChild);
      sync();
    };
    measure();
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(host, { childList: true });
    return () => {
      ro?.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero" id="hero" ref={heroRef}>
      <WaterRipple hostRef={heroRef} />
      <TopBar role={role} onRole={onRole} />

      <Reveal className="herobody" delay={60}>
        <div>
          <h1 id="pageTitle">Pipeline Review</h1>
          <p className="sub" id="pageSub">Lead review — click a lead to update it.</p>
        </div>
        <ViewTabs view={view} onView={onView} counts={counts} />
      </Reveal>

      <div className="herocontent" ref={contentRef}>{children}</div>
    </div>
  );
}

function TopBar({ role, onRole }: Pick<HeroProps, 'role' | 'onRole'>) {
  const mg = role === 'mg';
  return (
    <header className="top">
      <div className="top-in">
        <img className="logo" alt="Manav CRM" src={logo} />
        <div className="spacer" />
        <span className="demo-tag">DEMO DATA</span>
        <div className="role" role="group" aria-label="Demo role">
          <button id="roleMg" aria-pressed={mg} onClick={() => onRole('mg')}>Management</button>
          <button id="roleSales" aria-pressed={!mg} onClick={() => onRole('sales')}>
            <Icon name="lock" size={14} />
            Sales (view-only)
          </button>
        </div>
        <div className="user">
          <div className="avatar" id="uav">{mg ? 'HS' : 'AR'}</div>
          <div>
            <div id="uname">{mg ? 'Head of Sales' : 'Aisha Rahman'}</div>
            <small id="urole">{mg ? 'ManagementGroup' : 'Sales — view only'}</small>
          </div>
        </div>
      </div>
    </header>
  );
}

const TABS: { id: View; el: string; pill: string; label: string; icon: IconName; tone: '' | 'amber' | 'grey' }[] = [
  { id: 'upc', el: 'vUpc', pill: 'nUpc', label: 'To be Updated', icon: 'inbox', tone: 'amber' },
  { id: 'upd', el: 'vUpd', pill: 'nUpd', label: 'Updated', icon: 'check', tone: '' },
  { id: 'all', el: 'vAll', pill: 'nAll', label: 'All', icon: 'layers', tone: 'grey' },
];

/** Lead list tabs: To be Updated · Updated · All. */
function ViewTabs({ view, onView, counts }: Pick<HeroProps, 'view' | 'onView' | 'counts'>) {
  const { ref, style, ready } = useSlidingIndicator<HTMLDivElement>('[aria-selected=true]', view);
  return (
    <div className={`switch${ready ? ' ready' : ''}`} role="tablist" aria-label="Lead list" ref={ref}>
      <span className="ind" aria-hidden="true" style={style} />
      {TABS.map((t) => (
        <button key={t.id} role="tab" id={t.el} data-view={t.id} aria-selected={view === t.id} aria-controls="leadsCard" onClick={() => onView(t.id)}>
          <Icon name={t.icon} />
          {t.label} <CountPill id={t.pill} value={counts[t.id]} tone={t.tone} />
        </button>
      ))}
    </div>
  );
}
