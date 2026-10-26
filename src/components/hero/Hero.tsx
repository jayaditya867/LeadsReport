import { useRef } from 'react';
import type { Currency, Mode, Page, Role } from '../../types';
import { CURRENCIES } from '../../data/constants';
import { CYCLE_LABEL } from '../../lib/dates';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator';
import { Icon, type IconName } from '../ui/Icon';
import { CountPill } from '../ui/Badges';
import { Reveal } from '../ui/Reveal';
import { WaterRipple } from './WaterRipple';
import logo from '../../assets/manav-crm-logo.png';

const PAGE_COPY: Record<Page, { title: string; sub: string }> = {
  review: { title: 'Pipeline Review', sub: 'Weekly lead review — click a lead to update it.' },
  team: { title: 'Team Summary', sub: 'Per-salesperson totals, follow-ups and update discipline.' },
};

interface HeroProps {
  page: Page;
  onPage: (p: Page) => void;
  role: Role;
  onRole: (r: Role) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  counts: { all: number; fol: number; rev: number };
  cur: Currency;
  onCur: (c: Currency) => void;
}

export function Hero({ page, onPage, role, onRole, mode, onMode, counts, cur, onCur }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  return (
    <div className="hero" id="hero" ref={heroRef}>
      <WaterRipple hostRef={heroRef} />
      <TopBar page={page} onPage={onPage} role={role} onRole={onRole} />

      <Reveal className="herobody" delay={60}>
        <div>
          <h1 id="pageTitle">{PAGE_COPY[page].title}</h1>
          <p className="sub" id="pageSub">{PAGE_COPY[page].sub}</p>
        </div>
        <div className="cycle">
          <div className="cyi"><Icon name="cal" /></div>
          <div>
            <small>Update cycle</small>
            <b id="cycleTxt">{CYCLE_LABEL}</b>
          </div>
        </div>
      </Reveal>

      <Reveal className={`herofoot${page !== 'review' ? ' hide-tabs' : ''}`} delay={140}>
        <ReportTabs mode={mode} onMode={onMode} counts={counts} />
        <CurrencySwitch cur={cur} onCur={onCur} />
      </Reveal>
    </div>
  );
}

function TopBar({ page, onPage, role, onRole }: Pick<HeroProps, 'page' | 'onPage' | 'role' | 'onRole'>) {
  const mg = role === 'mg';
  const pages: { id: Page; label: string; icon: IconName }[] = [
    { id: 'review', label: 'Pipeline Review', icon: 'layers' },
    { id: 'team', label: 'Team Summary', icon: 'users' },
  ];
  return (
    <header className="top">
      <div className="top-in">
        <img className="logo" alt="Manav CRM" src={logo} />
        <nav className="pnav" aria-label="Pages">
          {pages.map((p) => (
            <button key={p.id} data-page={p.id} aria-current={page === p.id ? 'page' : undefined} onClick={() => onPage(p.id)}>
              <Icon name={p.icon} />
              {p.label}
            </button>
          ))}
        </nav>
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

function ReportTabs({ mode, onMode, counts }: Pick<HeroProps, 'mode' | 'onMode' | 'counts'>) {
  const { ref, style, ready } = useSlidingIndicator<HTMLDivElement>('[aria-selected=true]', mode);
  const tabs: { id: Mode; el: string; label: string; icon: IconName; count: number; red?: boolean; title?: string }[] = [
    { id: 'all', el: 'tAll', label: 'All leads', icon: 'layers', count: counts.all },
    { id: 'fol', el: 'tFol', label: 'Next Follow-up', icon: 'clock', count: counts.fol, red: true, title: 'Overdue follow-ups' },
    { id: 'rev', el: 'tRev', label: 'Revised Date', icon: 'cal', count: counts.rev, red: true, title: 'Overdue revised dates' },
  ];
  return (
    <div className={`switch${ready ? ' ready' : ''}`} role="tablist" aria-label="Report type" ref={ref}>
      <span className="ind" aria-hidden="true" style={style} />
      {tabs.map((t) => (
        <button key={t.id} role="tab" id={t.el} aria-selected={mode === t.id} onClick={() => onMode(t.id)}>
          <Icon name={t.icon} />
          {t.label} <CountPill id={`c${t.el.slice(1)}`} value={t.count} tone={t.red ? 'red' : ''} title={t.title} />
        </button>
      ))}
    </div>
  );
}

function CurrencySwitch({ cur, onCur }: Pick<HeroProps, 'cur' | 'onCur'>) {
  const { ref, style, ready } = useSlidingIndicator<HTMLDivElement>('[aria-pressed=true]', cur);
  return (
    <div className={`cur${ready ? ' ready' : ''}`} role="group" aria-label="Currency" ref={ref}>
      <span className="ind" aria-hidden="true" style={style} />
      <span className="clabel">Currency</span>
      {CURRENCIES.map((c) => (
        <button key={c} data-c={c} aria-pressed={cur === c} onClick={() => onCur(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
