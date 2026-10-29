import type { DateBasis, Filters } from '../types';
import { DEFAULT_STATUS, PROPOSAL, REGIONS, SITE, STATUSES } from '../data/constants';
import { store } from './storage';

/** Filters persisted on this device (Lead Owner and Search are deliberately not saved — client, 22 Oct). */
export type SavedFilters = Omit<Filters, 'status' | 'owners' | 'search'>;

export const EMPTY_FILTERS: Filters = {
  status: [...DEFAULT_STATUS], owners: [], stage: [], site: [], region: '', state: '',
  basis: 'revised', from: '', to: '', month: '', year: '', search: '',
};

const ALL_STATES = Object.values(REGIONS).flat();
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Keep only known string values from an unknown (possibly corrupted) saved array. */
const pick = (v: unknown, allowed: readonly string[]): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))] : [];

const str = (v: unknown, ok: (s: string) => boolean): string => (typeof v === 'string' && ok(v) ? v : '');

/** Saved status filter. An empty array ("All") is a valid saved choice; only a missing/invalid value falls back to the default. */
export function loadStatus(): string[] {
  const raw = store.get<unknown>('status', null);
  if (!Array.isArray(raw)) return [...DEFAULT_STATUS];
  const valid = pick(raw, STATUSES);
  return raw.length > 0 && valid.length === 0 ? [...DEFAULT_STATUS] : valid;
}

export function loadFilters(): Filters {
  const raw = store.get<unknown>('filters', {});
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const region = str(s.region, (x) => x in REGIONS);
  const states = region ? REGIONS[region] : ALL_STATES;
  return {
    ...EMPTY_FILTERS,
    status: loadStatus(),
    stage: pick(s.stage, PROPOSAL),
    site: pick(s.site, SITE),
    region,
    state: str(s.state, (x) => states.includes(x)),
    basis: (s.basis === 'created' ? 'created' : 'revised') as DateBasis,
    from: str(s.from, (x) => isoDate.test(x)),
    to: str(s.to, (x) => isoDate.test(x)),
    month: str(s.month, (x) => /^(0[1-9]|1[0-2])$/.test(x)),
    year: str(s.year, (x) => /^\d{4}$/.test(x)),
  };
}

export function saveFilters(f: Filters) {
  const { stage, site, region, state, basis, from, to, month, year } = f;
  store.set('filters', { stage, site, region, state, basis, from, to, month, year } satisfies SavedFilters);
}
