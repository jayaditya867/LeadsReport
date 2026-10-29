export type Status = 'Open' | 'Qualified' | 'Develop' | 'Propose' | 'Hold' | 'OrderAcceptance' | 'Won' | 'Lost';
export type Currency = 'AED' | 'INR' | 'USD';
export type Role = 'mg' | 'sales';
export type Page = 'review' | 'team';
/** Report type shown in the hero tabs. */
export type Mode = 'all' | 'fol' | 'rev';
/** Lead list tab. */
export type View = 'upc' | 'upd' | 'all';
export type DateBasis = 'revised' | 'created';
export type BucketKey = 'over' | 'today' | 'next7' | 'sched' | 'none' | 'closed';

export interface Change {
  f: string;
  from: string;
  to: string;
}

export interface LogEntry {
  /** ISO timestamp */
  on: string;
  by: string;
  changes: Change[];
  remark: string;
}

export interface Lead {
  id: number;
  eid: number;
  company: string;
  scope: string;
  owner: string;
  region: string;
  state: string;
  cur: Currency;
  status: Status;
  /** Proposal status (CRM opportunity stage). */
  stage: string;
  value: number;
  /** Revised (expected PO) date, yyyy-mm-dd or '' */
  revised: string;
  follow: string;
  /** Number of times the revised date was changed (no limit; each change is in `log`). */
  counter: number;
  created: string;
  reviewed: string | null;
  reviewedBy: string;
  site: string;
  floor: string;
  remark: string;
  project: string;
  visit: string;
  log: LogEntry[];
}

export type EditableField = 'stage' | 'revised' | 'follow' | 'project' | 'site' | 'floor' | 'remark' | 'visit';
export type Draft = Partial<Record<EditableField, string>> & { __err?: string; __errField?: EditableField };

export interface Filters {
  status: string[];
  owners: string[];
  stage: string[];
  site: string[];
  region: string;
  state: string;
  basis: DateBasis;
  from: string;
  to: string;
  month: string;
  year: string;
  search: string;
}

export interface SortState {
  key: string;
  dir: 1 | -1;
}

export interface Bucket {
  k: BucketKey;
  t: string;
  c: string;
}
