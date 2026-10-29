import { useEffect, useState } from 'react';
import type { Lead, Mode, Role, SortState, View } from '../../types';
import { REPORT_CURRENCY } from '../../data/constants';
import { fmtD } from '../../lib/dates';
import { bucket, commentCount, compareLeads, dueDate, isClosed, isUpdated } from '../../lib/leads';
import { money, moneyShort, plural } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { OwnerChip } from '../ui/Avatar';
import { DueBadge, StatusBadge } from '../ui/Badges';
import { Reveal } from '../ui/Reveal';

interface Props {
  leads: Lead[];
  /** Selected tab (chosen in the header). */
  view: View;
  sort: SortState;
  onSort: (key: string) => void;
  role: Role;
  onOpen: (id: number) => void;
  /** Changes whenever the row entrance animation should replay. */
  animKey: string;
  revealDelay: number;
}

/** Due status is based on the Revised Date (expected PO). */
const MODE: Mode = 'rev';
const TITLE: Record<View, string> = { upc: 'To be Updated', upd: 'Updated', all: 'All leads' };

const COLUMNS: { id: string; label: string; key: string }[] = [
  { id: 'lead', label: 'Lead / Account', key: 'company' },
  { id: 'owner', label: 'Owner', key: 'owner' },
  { id: 'val', label: 'Est. Revenue', key: 'value' },
  { id: 'status', label: 'Status', key: 'status' },
  { id: 'due', label: 'Due', key: 'due' },
  { id: 'stage', label: 'Proposal Status', key: 'stage' },
  { id: 'rev', label: 'Revised Date (PO)', key: 'revised' },
  { id: 'fol', label: 'Next Follow-up', key: 'follow' },
  { id: 'visit', label: 'Date of Visit', key: 'visit' },
  { id: 'lu', label: 'Last Updated', key: 'reviewed' },
  { id: 'act', label: '', key: '' },
];

export function LeadsCard({ leads, view, sort, onSort, role, onOpen, animKey, revealDelay }: Props) {
  const upd = leads.filter(isUpdated);
  const upc = leads.filter((l) => !isUpdated(l));
  const list = view === 'upc' ? upc : view === 'upd' ? upd : leads;
  // "Last Updated" is always "Not yet" on the To be Updated tab, so the column is dropped there
  const showLu = view !== 'upc';
  const listTotal = list.reduce((a, l) => a + l.value, 0);
  const cols = showLu ? COLUMNS : COLUMNS.filter((c) => c.id !== 'lu');
  const note =
    view === 'upc'
      ? 'Leads not yet updated by management. Click a lead to update it — it then moves to “Updated”.'
      : view === 'upd'
        ? 'Leads already updated by management.'
        : 'All leads for the selected filters.';

  // replay row fade-in when the tab or due-date chip changes
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

  return (
    <Reveal as="section" className="card leads" delay={revealDelay} id="leadsCard">
      <div className="lhead">
        <h2 className="ltitle" role="tabpanel" aria-labelledby={`v${view[0].toUpperCase()}${view.slice(1)}`}>
          {TITLE[view]} <span className="lcount">{list.length} {list.length === 1 ? 'lead' : 'leads'}</span>
        </h2>
        <span className="spacer" />
        {list.length > 0 && (
          <span className="ltot num" id="ltot" title={`Total Est. Revenue of these ${plural(list.length, 'lead')}: ${money(listTotal, REPORT_CURRENCY)}`}>
            <span className="ltl">Total</span> <span id="ltotVal">{moneyShort(listTotal, REPORT_CURRENCY)}</span>
          </span>
        )}
      </div>
      <div className="lnote" id="lnote">{note}</div>
      <div id="mainSecs" className={anim ? 'anim' : undefined}>
        {list.length ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  {cols.map((c) => (
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
                {[...list].sort(compareLeads(sort, MODE)).map((l) => (
                  <LeadRow key={l.id} lead={l} mode={MODE} canEdit={role === 'mg' && !isClosed(l)} onOpen={onOpen} showLu={showLu} />
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

function LeadRow({ lead: l, mode, canEdit, onOpen, showLu }: { lead: Lead; mode: Mode; canEdit: boolean; onOpen: (id: number) => void; showLu: boolean }) {
  const nc = commentCount(l);
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
        {l.counter > 0 && <span className="cnt" title={`Revised date changed ${plural(l.counter, 'time')} — see the update history`}>×{l.counter}</span>}
      </td>
      <td data-l="Next Follow-up" className="num">{l.follow ? fmtD(l.follow) : <span className="ro empty">—</span>}</td>
      <td data-l="Date of Visit" className="num visit">{l.visit ? fmtD(l.visit) : <span className="ro empty">—</span>}</td>
      {showLu && (
        <td className="lu" data-l="Last Updated">
          {l.reviewed ? (
            <>
              {fmtD(l.reviewed)}
              <small>{l.reviewedBy}{nc ? ` · ${plural(nc, 'comment')}` : ''}</small>
            </>
          ) : (
            <span className="ro empty">Not yet</span>
          )}
        </td>
      )}
      <td className="go" data-l="">
        <span className="openbtn">{canEdit ? 'Update' : 'View'} <Icon name="arrow" size={13} /></span>
      </td>
    </tr>
  );
}

function EmptyState({ hasLeads, view }: { hasLeads: boolean; view: View }) {
  const title = hasLeads ? (view === 'upc' ? 'Everything is up to date' : 'Nothing updated yet') : 'No leads match these filters';
  const body = hasLeads
    ? view === 'upc' ? 'Every lead has been updated.' : 'Leads appear here once you save an update.'
    : 'Try clearing a filter or changing the date range.';
  return (
    <div className="empty-state">
      <div className="ei"><Icon name="check" size={26} /></div>
      <b>{title}</b>
      {body}
    </div>
  );
}
