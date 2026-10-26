import { useEffect, useState } from 'react';
import type { Lead, Mode, Role, SortState, View } from '../../types';
import { CYCLE_START, fmtD, shortDate } from '../../lib/dates';
import { bucket, commentCount, compareLeads, dueDate, isClosed, isUpdated, totalsLabel } from '../../lib/leads';
import { money, plural } from '../../lib/format';
import { MAX_REVISIONS } from '../../data/constants';
import { Icon } from '../ui/Icon';
import { OwnerChip } from '../ui/Avatar';
import { CountPill, DueBadge, StatusBadge } from '../ui/Badges';
import { Reveal } from '../ui/Reveal';

interface Props {
  leads: Lead[];
  mode: Mode;
  view: View;
  onView: (v: View) => void;
  sort: SortState;
  onSort: (key: string) => void;
  role: Role;
  onOpen: (id: number) => void;
  /** Changes whenever the row entrance animation should replay. */
  animKey: string;
  revealDelay: number;
}

const COLUMNS: { id: string; label: string; key: string }[] = [
  { id: 'lead', label: 'Lead / Account', key: 'company' },
  { id: 'owner', label: 'Owner', key: 'owner' },
  { id: 'val', label: 'Est. Revenue', key: 'value' },
  { id: 'status', label: 'Status', key: 'status' },
  { id: 'due', label: 'Due', key: 'due' },
  { id: 'stage', label: 'Proposal Status', key: 'stage' },
  { id: 'rev', label: 'Revised Date (PO)', key: 'revised' },
  { id: 'fol', label: 'Next Follow-up', key: 'follow' },
  { id: 'lu', label: 'Last Updated', key: 'reviewed' },
  { id: 'act', label: '', key: '' },
];

export function LeadsCard({ leads, mode, view, onView, sort, onSort, role, onOpen, animKey, revealDelay }: Props) {
  const upd = leads.filter(isUpdated);
  const upc = leads.filter((l) => !isUpdated(l));
  const list = view === 'upc' ? upc : view === 'upd' ? upd : leads;
  const since = shortDate(CYCLE_START);
  const modeNote = mode === 'fol' ? ' · Sorted by next follow-up.' : mode === 'rev' ? ' · Sorted by revised date.' : '';
  const note =
    (view === 'upc'
      ? `Not yet reviewed since ${since}. Click a lead to update it — it then moves to “Updated this cycle”.`
      : view === 'upd'
        ? `Reviewed by management since ${since}.`
        : 'All leads for the selected filters.') + modeNote;

  // replay row fade-in when the view / report type / currency changes
  const [anim, setAnim] = useState(false);
  const [prevKey, setPrevKey] = useState(animKey);
  if (animKey !== prevKey) {
    setPrevKey(animKey);
    setAnim(true);
  }
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(false), 700);
    return () => window.clearTimeout(t);
  }, [anim, animKey]);

  const tabs: { id: View; pill: string; label: string; count: number; tone: 'amber' | '' | 'grey' }[] = [
    { id: 'upc', pill: 'nUpc', label: 'To update', count: upc.length, tone: 'amber' },
    { id: 'upd', pill: 'nUpd', label: 'Updated this cycle', count: upd.length, tone: '' },
    { id: 'all', pill: 'nAll', label: 'All', count: leads.length, tone: 'grey' },
  ];

  return (
    <Reveal as="section" className="card leads" delay={revealDelay} id="leadsCard">
      <div className="lhead">
        <div className="ltabs" role="tablist" aria-label="Lead list">
          {tabs.map((t) => (
            <button key={t.id} role="tab" data-view={t.id} aria-selected={view === t.id} onClick={() => onView(t.id)}>
              {t.label} <CountPill id={t.pill} value={t.count} tone={t.tone} />
            </button>
          ))}
        </div>
        <span className="spacer" />
        <span className="ltot num" id="ltot">{list.length ? totalsLabel(list) : ''}</span>
      </div>
      <div className="lnote" id="lnote">{note}</div>
      <div id="mainSecs" className={anim ? 'anim' : undefined}>
        {list.length ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.id}
                      className={`${c.id === 'lead' ? 'lead' : ''} ${c.id === 'act' ? 'ns' : ''}`.trim() || undefined}
                      data-sort={c.key}
                      aria-sort={sort.key === c.key && c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
                      onClick={() => c.key && onSort(c.key)}
                    >
                      {c.label}
                      {sort.key === c.key && c.key && <span className="ar">{sort.dir > 0 ? '▲' : '▼'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...list].sort(compareLeads(sort, mode)).map((l) => (
                  <LeadRow key={l.id} lead={l} mode={mode} canEdit={role === 'mg' && !isClosed(l)} onOpen={onOpen} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState hasLeads={leads.length > 0} view={view} />
        )}
      </div>
    </Reveal>
  );
}

function LeadRow({ lead: l, mode, canEdit, onOpen }: { lead: Lead; mode: Mode; canEdit: boolean; onOpen: (id: number) => void }) {
  const nc = commentCount(l);
  const maxed = l.counter >= MAX_REVISIONS;
  return (
    <tr
      data-open={l.id}
      tabIndex={0}
      aria-label={`Open ${l.company}`}
      onClick={() => onOpen(l.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpen(l.id);
        }
      }}
    >
      <td className="lead" data-l="">
        <b>{l.company}</b>
        <span className="scope">{l.scope}</span>
        <small>EID {l.eid} · {l.state}</small>
      </td>
      <td data-l="Owner"><OwnerChip name={l.owner} /></td>
      <td className="val num" data-l="Est. Revenue">{money(l.value, l.cur)}</td>
      <td data-l="Status"><StatusBadge status={l.status} /></td>
      <td data-l="Due"><DueBadge bucket={bucket(dueDate(l, mode), l)} /></td>
      <td data-l="Proposal Status">{l.stage || <span className="ro empty">—</span>}</td>
      <td data-l="Revised Date" className="num">
        {l.revised ? fmtD(l.revised) : <span className="ro empty">Not set</span>}
        <span className={`cnt${maxed ? ' max' : ''}`} title={`Revised ${l.counter} of ${MAX_REVISIONS} allowed times`}>{l.counter}/{MAX_REVISIONS}</span>
      </td>
      <td data-l="Next Follow-up" className="num">{l.follow ? fmtD(l.follow) : <span className="ro empty">—</span>}</td>
      <td className="lu" data-l="Last Updated">
        {l.reviewed ? (
          <>
            {fmtD(l.reviewed)}
            <small>{l.reviewedBy}{nc ? ` · ${plural(nc, 'comment')}` : ''}</small>
          </>
        ) : (
          <span className="ro empty">Never</span>
        )}
      </td>
      <td className="go" data-l="">
        <span className="openbtn">{canEdit ? 'Update' : 'View'} <Icon name="arrow" size={13} /></span>
      </td>
    </tr>
  );
}

function EmptyState({ hasLeads, view }: { hasLeads: boolean; view: View }) {
  const title = hasLeads ? (view === 'upc' ? 'Everything is up to date' : 'Nothing updated yet this cycle') : 'No leads match these filters';
  const body = hasLeads
    ? view === 'upc' ? 'All leads have been reviewed this cycle.' : 'Leads appear here once you save an update.'
    : 'Try clearing a filter or changing the date range.';
  return (
    <div className="empty-state">
      <div className="ei"><Icon name="check" size={26} /></div>
      <b>{title}</b>
      {body}
    </div>
  );
}
