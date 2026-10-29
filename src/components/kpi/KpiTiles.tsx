import { useEffect, useState } from 'react';
import type { Lead, Status } from '../../types';
import { bucket, isUpdated, sum, totalsLabel } from '../../lib/leads';
import { moneyShort } from '../../lib/format';
import { Icon, type IconName } from '../ui/Icon';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Reveal } from '../ui/Reveal';

interface Props {
  /** Leads with all filters except Status (tiles always show Develop/Propose). */
  statusFree: Lead[];
  /** Leads with all filters (used for revised-date tiles). */
  filtered: Lead[];
  onOpenRevised: (bucket: 'over' | 'next7' | 'today') => void;
}

export function KpiTiles({ statusFree, filtered, onOpenRevised }: Props) {
  // progress bars grow in after first paint
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGrown(true), 350);
    return () => window.clearTimeout(t);
  }, []);
  const playKey = 'tiles'; // numbers count up on first load

  const overL = filtered.filter((l) => bucket(l.revised, l).k === 'over');
  const today = filtered.filter((l) => bucket(l.revised, l).k === 'today').length;
  const next = filtered.filter((l) => bucket(l.revised, l).k === 'next7').length;

  const go = (k: 'over' | 'next7') => onOpenRevised(k === 'next7' && today && !next ? 'today' : k);
  const keyGo = (k: 'over' | 'next7') => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go(k);
    }
  };

  return (
    <div className="kpis" id="kpis">
      <StageTile index={0} label="Developed leads" status="Develop" icon="layers" tone="a" ribbon="linear-gradient(90deg,#c27a07,#f0b44c)" rows={statusFree} grown={grown} playKey={playKey} />
      <StageTile index={1} label="Proposed leads" status="Propose" icon="trend" tone="b" ribbon="linear-gradient(90deg,#3d7cf0,#7aa6f6)" rows={statusFree} grown={grown} playKey={playKey} />

      <Reveal className="card kpi red click" delay={340} data-go="over" tabIndex={0} role="button" onClick={() => go('over')} onKeyDown={keyGo('over')}>
        <div className="ribbon" style={{ background: 'linear-gradient(90deg,#e03e2f,#f07a6e)' }} />
        <span className="ki r"><Icon name="alert" /></span>
        <div className="kb">
          <div className="l">Revised date overdue</div>
          <div className="vrow">
            <AnimatedNumber className="v num" value={overL.length} playKey={playKey} duration={900} />
            <span className="m" title={overL.length ? totalsLabel(overL) : undefined}>{overL.length ? <><b className="num">{totalsLabel(overL)}</b> · PO date passed</> : 'Nothing overdue'}</span>
          </div>
          <div className="go">View overdue list <Icon name="arrow" size={13} /></div>
        </div>
      </Reveal>

      <Reveal className="card kpi click" delay={410} data-go="next7" tabIndex={0} role="button" onClick={() => go('next7')} onKeyDown={keyGo('next7')}>
        <div className="ribbon" style={{ background: 'linear-gradient(90deg,#0a9a52,#38b46a)' }} />
        <span className="ki g"><Icon name="clock" /></span>
        <div className="kb">
          <div className="l">Revised date — upcoming</div>
          <div className="vrow">
            <AnimatedNumber className="v num" value={today + next} playKey={playKey} duration={900} />
            <span className="m"><b>{today}</b> today · <b>{next}</b> next 7 days</span>
          </div>
          <div className="go">View upcoming list <Icon name="arrow" size={13} /></div>
        </div>
      </Reveal>
    </div>
  );
}

interface StageTileProps {
  index: number;
  label: string;
  status: Status;
  icon: IconName;
  tone: 'a' | 'b';
  ribbon: string;
  rows: Lead[];
  grown: boolean;
  playKey: string;
}

function StageTile({ index, label, status, icon, tone, ribbon, rows, grown, playKey }: StageTileProps) {
  const r = rows.filter((l) => l.status === status);
  const u = r.filter(isUpdated);
  const n = r.length - u.length;
  // amounts are never added across currencies: one total per currency; average only when there is a single currency
  const totals = totalsLabel(r);
  const curs = [...new Set(r.map((l) => l.cur))];
  const avg = curs.length === 1 ? moneyShort(sum(r) / r.length, curs[0]) : '';
  const pct = r.length ? Math.round((u.length / r.length) * 100) : 0;
  return (
    <Reveal className="card kpi" delay={200 + index * 70}>
      <div className="ribbon" style={{ background: ribbon }} />
      <span className={`ki ${tone}`}><Icon name={icon} /></span>
      <div className="kb">
        <div className="l">{label}</div>
        <div className="vrow">
          <AnimatedNumber className="v num" value={r.length} playKey={playKey} />
          <span className="m" title={totals || undefined}>
            {r.length ? <><b className="num">{totals}</b>{avg && <> · avg <b className="num">{avg}</b></>}</> : 'No leads'}
          </span>
        </div>
        <div className="bar" title={`${pct}% updated`}>
          <i style={{ width: grown ? `${pct}%` : 0 }} />
        </div>
        <div className="legend">
          <span>
            <span className="d" style={{ background: 'var(--g)' }} />Updated <b className="num">{u.length}</b>
          </span>
          <span>
            <span className="d" style={{ background: '#cfd6e0' }} />Pending <b className="num">{n}</b>
          </span>
        </div>
      </div>
    </Reveal>
  );
}
