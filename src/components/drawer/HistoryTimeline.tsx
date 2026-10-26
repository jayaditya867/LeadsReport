import type { Lead } from '../../types';
import { fmtD, fmtDateTime, isIsoDate } from '../../lib/dates';

const show = (v: string) => (isIsoDate(v) ? fmtD(v) : v || '—');

/** Update log for a lead, newest first; revised-date changes are highlighted. */
export function HistoryTimeline({ lead }: { lead: Lead }) {
  if (!lead.log.length) return <p className="hint">No updates yet — this lead has not been reviewed.</p>;
  return (
    <div className="dhist">
      {[...lead.log].reverse().map((h, i) => {
        const rev = h.changes.some((c) => c.f === 'Revised Date');
        return (
          <div className={`hist${rev ? ' rev' : ''}`} key={`${h.on}-${i}`}>
            <small>{fmtDateTime(h.on)} · {h.by}</small>
            {h.changes.length > 0 && (
              <ul className="chgs">
                {h.changes.map((c, j) => (
                  <li key={j}><b>{c.f}:</b> {show(c.from)} → {show(c.to)}</li>
                ))}
              </ul>
            )}
            {h.remark && <div>{h.remark}</div>}
          </div>
        );
      })}
    </div>
  );
}
