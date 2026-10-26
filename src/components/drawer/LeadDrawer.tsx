import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Draft, EditableField, Lead, Role } from '../../types';
import { MAX_REVISIONS, NEW_STAGES, PROPOSAL, SITE } from '../../data/constants';
import { TODAY, fmtD, iso } from '../../lib/dates';
import { bucket, commentCount, isClosed } from '../../lib/leads';
import { money, plural } from '../../lib/format';
import { lockPageScroll, prefersReducedMotion } from '../../lib/motion';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { DueBadge, StatusBadge } from '../ui/Badges';
import { HistoryTimeline } from './HistoryTimeline';

interface Props {
  /** Lead to show; null closes the panel. */
  lead: Lead | null;
  role: Role;
  draft: Draft | undefined;
  onField: (id: number, field: EditableField, value: string) => void;
  onSave: (id: number) => void;
  /** Close and discard unsaved changes. */
  onCancel: (id: number) => void;
  /** Close and keep unsaved changes (backdrop, ×, Esc). */
  onClose: () => void;
}

const CLOSE_MS = 340;

/** Right-side "Update lead" panel — all editing happens here. */
export function LeadDrawer({ lead, role, draft, onField, onSave, onCancel, onClose }: Props) {
  // keep the last lead mounted while the panel slides out
  const [shown, setShown] = useState<Lead | null>(lead);
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  if (lead && lead !== shown) setShown(lead);

  useEffect(() => {
    if (lead) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      lockPageScroll(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setOpen(true))));
      const focus = window.setTimeout(() => bodyRef.current?.querySelector<HTMLElement>('.ed:not(:disabled)')?.focus({ preventScroll: true }), 380);
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
        window.clearTimeout(focus);
      };
    }
    lockPageScroll(false);
    setOpen(false);
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
    const t = window.setTimeout(() => setShown(null), prefersReducedMotion() ? 0 : CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lead) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [lead, onClose]);

  useEffect(() => () => lockPageScroll(false), []);

  if (!shown) return null;
  const l = lead ?? shown;
  const edit = role === 'mg' && !isClosed(l);
  const maxed = l.counter >= MAX_REVISIONS;
  const val = (f: EditableField): string => (draft && f in draft ? (draft[f] as string) : l[f]);
  const dirty = (f: EditableField) => !!draft && f in draft;
  const hasChanges = !!draft && Object.keys(draft).some((k) => !k.startsWith('__'));
  const err = draft?.__err;
  const errField = draft?.__errField;
  const bad = (f: EditableField) => (errField === f ? ' bad' : '');
  const errIn = (fields: EditableField[]) =>
    err && (errField ? fields.includes(errField) : fields.includes('revised')) ? (
      <div className="errmsg" role="alert">{err}</div>
    ) : null;

  const input = (f: EditableField, type: 'date' | 'text', extra: Record<string, string | boolean | undefined> = {}) => (
    <input className={`ed${dirty(f) ? ' dirty' : ''}${bad(f)}`} type={type} aria-invalid={errField === f || undefined} data-f={f} value={val(f)} onChange={(e) => onField(l.id, f, e.target.value)} {...extra} />
  );
  const select = (f: EditableField, opts: string[], tags: string[] = []) => (
    <select className={`ed${dirty(f) ? ' dirty' : ''}${bad(f)}`} data-f={f} value={val(f)} onChange={(e) => onField(l.id, f, e.target.value)}>
      <option value="">— select —</option>
      {opts.map((o) => <option key={o} value={o}>{o}{tags.includes(o) ? ' (new)' : ''}</option>)}
    </select>
  );
  const area = (f: EditableField, ph: string) => (
    <textarea className={`ed rem${dirty(f) ? ' dirty' : ''}${bad(f)}`} aria-invalid={errField === f || undefined} rows={2} data-f={f} placeholder={ph} value={val(f)} onChange={(e) => onField(l.id, f, e.target.value)} />
  );
  const ro = (v: string, fmt?: (s: string) => string) => <span className={`ro${v ? '' : ' empty'}`}>{v ? (fmt ? fmt(v) : v) : '—'}</span>;

  return (
    <div className={`drawerbg${open && lead ? ' open' : ''}`} id="drawer" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
        <header className="dhead" id="dHead">
          <div>
            <div className="dk">EID {l.eid} · {l.region}</div>
            <h3 id="dTitle">{l.company}</h3>
            <p>{l.scope}</p>
            <div className="dmeta">
              <Avatar name={l.owner} />
              <span>{l.owner}</span>
              <StatusBadge status={l.status} />
              <DueBadge bucket={bucket(l.revised, l)} title="Revised date" />
            </div>
          </div>
          <button className="x" id="dClose" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <div className="dbody" id="dBody" ref={bodyRef}>
          <div className="dstats">
            <div><small>Est. revenue</small><b className="num">{money(l.value, l.cur)}</b></div>
            <div><small>Emirate / State</small><b>{l.state}</b></div>
            <div><small>Created</small><b>{fmtD(l.created)}</b></div>
          </div>
          {!edit && (
            <div className="dnote">
              <Icon name="lock" size={14} />
              {isClosed(l) ? 'Closed lead — view only.' : 'View only — updates are made by the management team.'}
            </div>
          )}

          <h4>Expected PO</h4>
          <div className="dgrid">
            <Field label="Revised Date (PO)">
              {edit ? input('revised', 'date', { min: iso(TODAY), disabled: maxed, title: maxed ? `Already changed ${MAX_REVISIONS} times` : undefined }) : ro(l.revised, fmtD)}
            </Field>
            <Field label="Changes used">
              <div className="meter">
                <span>{Array.from({ length: MAX_REVISIONS }, (_, i) => <i key={i} className={i < l.counter ? 'on' : undefined} />)}</span>
                {l.counter} of {MAX_REVISIONS}{maxed ? ' · limit reached' : ''}
              </div>
            </Field>
            <Field label={<>Remarks{edit && <em>required when the date changes</em>}</>} full>
              {edit ? area('remark', 'Why is the date changing? Latest from the salesperson…') : ro(l.remark)}
            </Field>
          </div>
          {errIn(['revised', 'remark'])}

          <h4>Status &amp; follow-up</h4>
          <div className="dgrid">
            <Field label="Proposal Status">{edit ? select('stage', PROPOSAL, NEW_STAGES) : ro(l.stage)}</Field>
            <Field label="Next Follow-up">{edit ? input('follow', 'date', { min: iso(TODAY) }) : ro(l.follow, fmtD)}</Field>
            <Field label="Project Status" full>{edit ? area('project', 'Project update') : ro(l.project)}</Field>
          </div>
          {errIn(['stage', 'follow', 'project'])}

          <h4>Site</h4>
          <div className="dgrid">
            <Field label="Site Status">{edit ? select('site', SITE) : ro(l.site)}</Field>
            <Field label="Floor Level">{edit ? input('floor', 'text', { placeholder: 'e.g. 5th floor' }) : ro(l.floor)}</Field>
            <Field label="Date of Visit">{edit ? input('visit', 'date', { max: iso(TODAY) }) : ro(l.visit, fmtD)}</Field>
          </div>
          {errIn(['site', 'floor', 'visit'])}

          <h4>History · {plural(commentCount(l), 'comment')}</h4>
          <HistoryTimeline lead={l} />
        </div>

        <footer className="dfoot" id="dFoot">
          {edit ? (
            <>
              <span className="hint" id="dState">{hasChanges ? 'Unsaved changes' : 'No changes yet'}</span>
              <span className="spacer" />
              <button className="btn ghost" id="dCancel" onClick={() => onCancel(l.id)}>Cancel</button>
              <button className="btn" id="dSave" disabled={!hasChanges} onClick={() => onSave(l.id)}>Save update</button>
            </>
          ) : (
            <>
              <span className="spacer" />
              <button className="btn ghost" id="dCancel" onClick={onClose}>Close</button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Field({ label, full, children }: { label: ReactNode; full?: boolean; children: ReactNode }) {
  return (
    <div className={`df${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
