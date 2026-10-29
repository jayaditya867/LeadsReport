import { useState } from 'react';
import type { BucketKey, Filters, Mode } from '../../types';
import { NEW_STAGES, OWNERS, PROPOSAL, REGIONS, SITE, STATUSES, STATUS_LABEL } from '../../data/constants';
import { TODAY, WEEK_START, addDays, iso } from '../../lib/dates';
import { activeFilterCount, moreFilterCount } from '../../lib/leads';
import { Icon } from '../ui/Icon';
import { CountPill } from '../ui/Badges';
import { Reveal } from '../ui/Reveal';
import { MultiSelect } from './MultiSelect';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: new Date(2026, i, 1).toLocaleString('en', { month: 'short' }),
}));
const YEARS = [TODAY.getFullYear() - 1, TODAY.getFullYear(), TODAY.getFullYear() + 1].map(String);
const ALL_STATES = [...new Set(Object.values(REGIONS).flat())];

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  moreOpen: boolean;
  onMoreOpen: (open: boolean) => void;
  matchCount: number;
  onSaveStatus: () => void;
  onReset: () => void;
  /** Due-bucket chips (only in Next Follow-up / Revised Date report types). */
  chips: { mode: Mode; counts: Record<BucketKey, number>; active: BucketKey | ''; onPick: (k: BucketKey | '') => void } | null;
}

export function FilterPanel({ filters: f, onChange, moreOpen, onMoreOpen, matchCount, onSaveStatus, onReset, chips }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const states = f.region ? REGIONS[f.region] : ALL_STATES;
  const more = moreFilterCount(f);
  const active = activeFilterCount(f);

  const preset = (p: 'week' | 'month' | 'next30') => {
    let from: Date;
    let to: Date;
    if (p === 'week') {
      from = WEEK_START;
      to = addDays(WEEK_START, 6);
    } else if (p === 'month') {
      from = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
      to = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0);
    } else {
      from = TODAY;
      to = addDays(TODAY, 30);
    }
    onChange({ from: iso(from), to: iso(to) });
  };

  return (
    <Reveal as="section" className={`card filters${mobileOpen ? ' open' : ''}`} delay={320} aria-label="Filters" id="filters">
      <button className="ftoggle" id="ftoggle" aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="filter" style={{ color: 'var(--g)' }} />
          Filters <span className="pill" id="fcount">{active || 'default'}</span>
        </span>
        <Icon name="chev" />
      </button>

      <div className="fbody">
        <div className="frow main">
          <div className="field search">
            <label htmlFor="fSearch">Search</label>
            <input type="search" id="fSearch" placeholder="Account, EID, project, remarks…" value={f.search} onChange={(e) => onChange({ search: e.target.value })} />
            <Icon name="search" />
          </div>
          <div className="field">
            <label>Status</label>
            <MultiSelect id="fStatus" options={STATUSES} labels={STATUS_LABEL} selected={f.status} onChange={(status) => onChange({ status })} />
          </div>
          <div className="field">
            <label>Lead Owner</label>
            <MultiSelect id="fOwner" options={OWNERS} selected={f.owners} onChange={(owners) => onChange({ owners })} />
          </div>
          <div className="field">
            <label htmlFor="fRegion">Region</label>
            <select id="fRegion" value={f.region} onChange={(e) => onChange({ region: e.target.value, state: '' })}>
              <option value="">All regions</option>
              {Object.keys(REGIONS).map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fState">Emirate / State</label>
            <select id="fState" value={states.includes(f.state) ? f.state : ''} onChange={(e) => onChange({ state: e.target.value })}>
              <option value="">All</option>
              {states.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field fbtns">
            <button className="morebtn" id="moreBtn" aria-expanded={moreOpen} onClick={() => onMoreOpen(!moreOpen)}>
              <Icon name="filter" />More filters {more > 0 && <span className="pill" id="moreCount">{more}</span>}
              <Icon name="chev" className="chev" />
            </button>
          </div>
        </div>

        {moreOpen && (
          <div className="frow more" id="moreRow">
            <div className="field">
              <label>Proposal Status</label>
              <MultiSelect id="fStage" options={PROPOSAL} newTags={NEW_STAGES} selected={f.stage} onChange={(stage) => onChange({ stage })} />
            </div>
            <div className="field">
              <label>Site Status</label>
              <MultiSelect id="fSite" options={SITE} selected={f.site} onChange={(site) => onChange({ site })} />
            </div>
            <div className="field">
              <label>Date filter on</label>
              <div className="seg" role="group" aria-label="Date basis">
                <button id="dbRev" aria-pressed={f.basis === 'revised'} onClick={() => onChange({ basis: 'revised' })}>Revised Date</button>
                <button id="dbCre" aria-pressed={f.basis === 'created'} onClick={() => onChange({ basis: 'created' })}>Opp. Created</button>
              </div>
            </div>
            <div className="field wide">
              <label>
                From – To{' '}
                <span className="presets">
                  <button className="chip" data-p="week" onClick={() => preset('week')}>This week</button>
                  <button className="chip" data-p="month" onClick={() => preset('month')}>This month</button>
                  <button className="chip" data-p="next30" onClick={() => preset('next30')}>Next 30 days</button>
                </span>
              </label>
              <div className="range">
                <input type="date" id="fFrom" aria-label="From date" value={f.from} onChange={(e) => onChange({ from: e.target.value })} />
                <input type="date" id="fTo" aria-label="To date" value={f.to} onChange={(e) => onChange({ to: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Month / Year</label>
              <div className="pair">
                <select id="fMonth" aria-label="Month" value={f.month} onChange={(e) => onChange({ month: e.target.value })}>
                  <option value="">Month</option>
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select id="fYear" aria-label="Year" value={f.year} onChange={(e) => onChange({ year: e.target.value })}>
                  <option value="">Year</option>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fmeta">
        <div id="chips" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {chips && <DueChips {...chips} />}
        </div>
        <span className="spacer" />
        <span className="hint" id="kpiScope">{matchCount} leads match</span>
        <button className="link" id="saveStatus" title="Filters are remembered on this device, except Lead Owner and Search." onClick={onSaveStatus}>
          <Icon name="save" size={14} />Save status as default
        </button>
        <button className="link muted" id="reset" onClick={onReset}>
          <Icon name="reset" size={14} />Reset
        </button>
      </div>
    </Reveal>
  );
}

const CHIP_DEFS: { k: BucketKey; label: string; red?: boolean }[] = [
  { k: 'over', label: 'Overdue', red: true },
  { k: 'today', label: 'Due today' },
  { k: 'next7', label: 'Next 7 days' },
  { k: 'sched', label: 'Scheduled' },
  { k: 'none', label: 'Not set' },
];

function DueChips({ mode, counts, active, onPick }: NonNullable<Props['chips']>) {
  return (
    <>
      <span className="hint" style={{ alignSelf: 'center' }}>{mode === 'fol' ? 'Next Follow-up:' : 'Revised Date (PO):'}</span>
      {CHIP_DEFS.map((c) => (
        <button key={c.k} className={`chip${c.red ? ' red' : ''}`} data-k={c.k} aria-pressed={active === c.k} onClick={() => onPick(active === c.k ? '' : c.k)}>
          {c.label} <CountPill value={counts[c.k]} tone={c.k === 'over' ? 'red' : ''} />
        </button>
      ))}
    </>
  );
}
