import type { Currency, Lead } from '../../types';
import { QUOTE_STAGES } from '../../data/constants';
import { TODAY, fmtD, iso } from '../../lib/dates';
import { bucket, commentCount, isUpdated, sum } from '../../lib/leads';
import { money } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { OwnerChip } from '../ui/Avatar';
import { Reveal } from '../ui/Reveal';

const HEAD = ['Lead owner', 'Leads', 'Quotations', 'Total value', 'Updated', 'To be updated', 'Overdue (PO)', 'Next follow-up', 'Comments', 'Date changes'];

/** Per-salesperson summary (M1 pivot, M2 per-user totals & comment counts). */
export function TeamSummary({ leads, cur }: { leads: Lead[]; cur: Currency }) {
  const byOwner = new Map<string, Lead[]>();
  leads.forEach((l) => byOwner.set(l.owner, [...(byOwner.get(l.owner) ?? []), l]));
  const names = [...byOwner.keys()].sort();
  const today = iso(TODAY);

  return (
    <Reveal as="section" className="card team" id="teamCard">
      <div className="lhead">
        <span className="tdot"><Icon name="users" /></span>
        <div>
          <h2>Lead owner summary</h2>
          <span className="hint" id="oCount">{names.length} owners · {cur} leads for the selected filters</span>
        </div>
      </div>
      <div className="tw">
        <table className="otable">
          <thead>
            <tr>{HEAD.map((h) => <th key={h} className="ns">{h}</th>)}</tr>
          </thead>
          <tbody id="obody">
            {names.length ? (
              names.map((n) => {
                const r = byOwner.get(n)!;
                const nextFollow = r.map((l) => l.follow).filter((f) => f && f >= today).sort()[0];
                const overdue = r.filter((l) => bucket(l.revised, l).k === 'over').length;
                return (
                  <tr key={n}>
                    <td data-l="Lead owner"><OwnerChip name={n} bold /></td>
                    <td className="num" data-l="Leads">{r.length}</td>
                    <td className="num" data-l="Quotations">{r.filter((l) => QUOTE_STAGES.includes(l.stage)).length}</td>
                    <td className="num" data-l="Total value"><b>{money(sum(r), cur)}</b></td>
                    <td className="num" data-l="Updated">{r.filter(isUpdated).length}</td>
                    <td className="num" data-l="To be updated">{r.filter((l) => !isUpdated(l)).length}</td>
                    <td className="num" data-l="Overdue">{overdue ? <span className="badge b-over">{overdue}</span> : '0'}</td>
                    <td data-l="Next follow-up">{fmtD(nextFollow)}</td>
                    <td className="num" data-l="Comments">{r.reduce((a, l) => a + commentCount(l), 0)}</td>
                    <td className="num" data-l="Date changes">{r.reduce((a, l) => a + l.counter, 0)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <b>No {cur} leads for these filters</b>Switch currency or adjust filters.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}
