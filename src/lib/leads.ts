import type { Bucket, BucketKey, Currency, Filters, Lead, Mode, SortState } from '../types';
import { CLOSED, DEFAULT_STATUS } from '../data/constants';
import { DAY, TODAY } from './dates';
import { moneyShort } from './format';

export const isClosed = (l: Lead) => CLOSED.includes(l.status);
/** Updated = management has saved an update for this lead through the report (back-end "updated" flag / LastReviewedOn). No weekly reset. */
export const isUpdated = (l: Lead) => !!l.reviewed;
export const commentCount = (l: Lead) => l.log.filter((e) => e.remark).length;

/** The date that drives the "Due" column for the current report type. */
export const dueDate = (l: Lead, mode: Mode) => (mode === 'fol' ? l.follow : l.revised);

export function bucket(dateStr: string, l?: Lead): Bucket {
  if (l && isClosed(l)) return { k: 'closed', t: 'Closed', c: 'b-closed' };
  if (!dateStr) return { k: 'none', t: 'Not set', c: 'b-none' };
  const d = Math.round((new Date(`${dateStr}T00:00:00`).getTime() - TODAY.getTime()) / DAY);
  if (d < 0) return { k: 'over', t: `Overdue ${-d}d`, c: 'b-over' };
  if (d === 0) return { k: 'today', t: 'Due today', c: 'b-today' };
  if (d <= 7) return { k: 'next7', t: `In ${d}d`, c: 'b-up' };
  return { k: 'sched', t: 'Scheduled', c: 'b-sch' };
}

export interface FilterOptions {
  filters: Filters;
  /** Optional currency restriction (not used on the page any more — amounts are never summed across currencies). */
  cur?: Currency;
  mode: Mode;
  chip: BucketKey | '';
  ignoreChip?: boolean;
  ignoreStatus?: boolean;
}

export function filterLeads(leads: Lead[], o: FilterOptions): Lead[] {
  const f = o.filters;
  const q = f.search.trim().toLowerCase();
  return leads.filter((l) => {
    if (o.cur && l.cur !== o.cur) return false;
    if (!o.ignoreStatus && f.status.length && !f.status.includes(l.status)) return false;
    if (f.owners.length && !f.owners.includes(l.owner)) return false;
    if (f.stage.length && !f.stage.includes(l.stage)) return false;
    if (f.site.length && !f.site.includes(l.site)) return false;
    if (f.region && l.region !== f.region) return false;
    if (f.state && l.state !== f.state) return false;
    if (q && ![l.company, l.eid, l.scope, l.owner, l.project, l.remark, l.state].join(' ').toLowerCase().includes(q)) return false;
    const dv = f.basis === 'revised' ? l.revised : l.created;
    if (f.from && (!dv || dv < f.from)) return false;
    if (f.to && (!dv || dv > f.to)) return false;
    if (f.month && (!dv || dv.slice(5, 7) !== f.month)) return false;
    if (f.year && (!dv || dv.slice(0, 4) !== f.year)) return false;
    if (!o.ignoreChip && o.mode !== 'all' && o.chip && bucket(dueDate(l, o.mode), l).k !== o.chip) return false;
    return true;
  });
}

export function compareLeads(sort: SortState, mode: Mode) {
  return (a: Lead, b: Lead) => {
    let x: string | number;
    let y: string | number;
    if (sort.key === 'due') {
      x = isClosed(a) ? '9999z' : dueDate(a, mode) || '9999';
      y = isClosed(b) ? '9999z' : dueDate(b, mode) || '9999';
    } else {
      const ka = (a as unknown as Record<string, string | number | null>)[sort.key] ?? '';
      const kb = (b as unknown as Record<string, string | number | null>)[sort.key] ?? '';
      x = typeof ka === 'string' ? ka.toLowerCase() : ka;
      y = typeof ka === 'string' ? String(kb).toLowerCase() : kb;
    }
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
  };
}

/** "AED 6.22 M · USD 88 K" */
export function totalsLabel(rows: Lead[]): string {
  const t: Partial<Record<Currency, number>> = {};
  rows.forEach((l) => (t[l.cur] = (t[l.cur] ?? 0) + l.value));
  return (Object.entries(t) as [Currency, number][]).map(([c, v]) => moneyShort(v, c)).join(' · ');
}

export const sum = (rows: Lead[]) => rows.reduce((a, l) => a + l.value, 0);

/** Number of non-default filters (shown on the mobile "Filters" button). */
export function activeFilterCount(f: Filters): number {
  const statusChanged = f.status.length !== DEFAULT_STATUS.length || !DEFAULT_STATUS.every((x) => f.status.includes(x));
  return (statusChanged ? 1 : 0) + [f.owners.length, f.stage.length, f.site.length, f.region, f.state, f.from || f.to, f.month, f.year, f.search].filter(Boolean).length;
}

/** Filters living behind "More filters". */
export function moreFilterCount(f: Filters): number {
  return [f.stage.length, f.site.length, f.from || f.to, f.month, f.year, f.basis !== 'revised'].filter(Boolean).length;
}
