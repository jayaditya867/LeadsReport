import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BucketKey, Currency, Draft, EditableField, Filters, Lead, Mode, Page, Role, SortState, View } from './types';
import { DEFAULT_STATUS, FIELD_LABEL, MAX_REVISIONS, MGMT } from './data/constants';
import { buildDemoLeads } from './data/demoLeads';
import { TODAY, iso } from './lib/dates';
import { bucket, dueDate, filterLeads, moreFilterCount } from './lib/leads';
import { store } from './lib/storage';
import { EMPTY_FILTERS, loadCurrency, loadFilters, saveFilters } from './lib/persistence';
import { usePressRipple } from './hooks/usePressRipple';
import { IconSprite, Icon } from './components/ui/Icon';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Hero } from './components/hero/Hero';
import { KpiTiles } from './components/kpi/KpiTiles';
import { FilterPanel } from './components/filters/FilterPanel';
import { LeadsCard } from './components/leads/LeadsCard';
import { TeamSummary } from './components/team/TeamSummary';
import { LeadDrawer } from './components/drawer/LeadDrawer';
import { Skeleton } from './components/ui/Skeleton';
import logo from './assets/manav-crm-logo.png';

export default function App() {
  return (
    <ToastProvider>
      <IconSprite />
      <PipelineReview />
    </ToastProvider>
  );
}

function PipelineReview() {
  usePressRipple();
  const toast = useToast();

  const [leads, setLeads] = useState<Lead[]>(buildDemoLeads);
  const [role, setRole] = useState<Role>('mg');
  const [page, setPage] = useState<Page>(() => (window.location.hash === '#team' ? 'team' : 'review'));
  const [mode, setMode] = useState<Mode>('all');
  const [chip, setChip] = useState<BucketKey | ''>('');
  const [view, setView] = useState<View>('upc');
  const [cur, setCur] = useState<Currency>(loadCurrency);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [moreOpen, setMoreOpen] = useState<boolean>(() => store.get('moreOpen', false) || moreFilterCount(loadFilters()) > 0);
  const [sort, setSort] = useState<SortState>({ key: 'due', dir: 1 });
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [navigated, setNavigated] = useState(false);

  // brief skeleton = loading state (as the live app will fetch from SharePoint)
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 350);
    return () => window.clearTimeout(t);
  }, []);

  /* ---------- persistence ---------- */
  useEffect(() => saveFilters(filters), [filters]);
  useEffect(() => store.set('cur', cur), [cur]);
  useEffect(() => {
    try {
      history.replaceState(null, '', `#${page}`);
    } catch {
      /* ignore */
    }
  }, [page]);

  /* ---------- derived lists ---------- */
  const base = { filters, cur, mode, chip };
  const filtered = useMemo(() => filterLeads(leads, base), [leads, filters, cur, mode, chip]); // eslint-disable-line react-hooks/exhaustive-deps
  const noChip = useMemo(() => filterLeads(leads, { ...base, ignoreChip: true }), [leads, filters, cur, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const statusFree = useMemo(() => filterLeads(leads, { ...base, ignoreChip: true, ignoreStatus: true }), [leads, filters, cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabCounts = {
    all: noChip.length,
    fol: noChip.filter((l) => bucket(l.follow, l).k === 'over').length,
    rev: noChip.filter((l) => bucket(l.revised, l).k === 'over').length,
  };
  const chipCounts = useMemo(() => {
    const c: Record<BucketKey, number> = { over: 0, today: 0, next7: 0, sched: 0, none: 0, closed: 0 };
    noChip.forEach((l) => c[bucket(dueDate(l, mode), l).k]++);
    return c;
  }, [noChip, mode]);

  /* ---------- actions ---------- */
  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (patch.status) store.set('status', patch.status);
      return next;
    });
  }, []);

  const changeMode = (m: Mode, nextChip: BucketKey | '' = '') => {
    setMode(m);
    setChip(nextChip);
  };

  const openRevised = (k: 'over' | 'next7' | 'today') => {
    setView('all');
    setPage('review');
    changeMode('rev', k);
    window.setTimeout(() => document.getElementById('leadsCard')?.scrollIntoView({ behavior: 'smooth' }), 30);
  };

  const changeRole = (r: Role) => {
    setRole(r);
    setDrafts({});
    setOpenId(null);
  };

  const resetFilters = () => {
    store.set('status', DEFAULT_STATUS);
    setFilters({ ...EMPTY_FILTERS, status: [...DEFAULT_STATUS] });
    setChip('');
    toast('Filters reset.');
  };

  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const onField = useCallback(
    (id: number, field: EditableField, value: string) => {
      setDrafts((all) => {
        const lead = leads.find((l) => l.id === id);
        if (!lead) return all;
        const d: Draft = { ...(all[id] ?? {}) };
        delete d.__err;
        delete d.__errField;
        if (value === String(lead[field] ?? '')) delete d[field];
        else d[field] = value;
        const next = { ...all };
        if (Object.keys(d).length) next[id] = d;
        else delete next[id];
        return next;
      });
    },
    [leads],
  );

  const discard = (id: number) => {
    setDrafts((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
    setOpenId(null);
  };

  const save = (id: number) => {
    const l = leads.find((x) => x.id === id);
    const d = drafts[id];
    if (!l || !d) return;
    const revChanged = 'revised' in d && d.revised !== l.revised;
    const newRemark = 'remark' in d ? String(d.remark).trim() : '';
    const today = iso(TODAY);
    let err = '';
    let errField: EditableField | undefined;
    if (revChanged) {
      errField = 'revised';
      if (l.counter >= MAX_REVISIONS) err = `Revised date can be changed at most ${MAX_REVISIONS} times.`;
      else if (!d.revised) err = 'Revised date cannot be cleared.';
      else if (d.revised < today) err = 'Revised date cannot be in the past.';
      else if (!newRemark) [err, errField] = ['Enter a remark explaining the new revised date.', 'remark'];
    }
    if (!err && 'follow' in d && d.follow && d.follow < today) [err, errField] = ['Next follow-up date cannot be in the past.', 'follow'];
    if (!err && 'visit' in d && d.visit && d.visit > today) [err, errField] = ['Date of visit cannot be in the future.', 'visit'];
    if (err) {
      setDrafts((all) => ({ ...all, [id]: { ...d, __err: err, __errField: errField } }));
      toast(err, true);
      window.setTimeout(() => document.querySelector<HTMLElement>(`#dBody [data-f="${errField}"]`)?.focus(), 0);
      return;
    }
    const fields = Object.keys(FIELD_LABEL) as EditableField[];
    const by = MGMT[0];
    const now = new Date().toISOString();
    const changes = fields.filter((f) => f in d && f !== 'remark').map((f) => ({ f: FIELD_LABEL[f], from: l[f], to: d[f] as string }));
    const updated: Lead = {
      ...l,
      ...Object.fromEntries(fields.filter((f) => f in d).map((f) => [f, d[f] as string])),
      counter: revChanged ? l.counter + 1 : l.counter,
      reviewed: now,
      reviewedBy: by,
      log: [...l.log, { on: now, by, changes, remark: newRemark }],
    };
    setLeads((all) => all.map((x) => (x.id === id ? updated : x)));
    discard(id);
    toast(`${l.company} updated and moved to “Updated this cycle”. (Demo — the live app writes this back to the CRM lead.)`);
  };

  const openLead = openId != null ? leads.find((l) => l.id === openId) ?? null : null;
  const closeDrawer = useCallback(() => setOpenId(null), []);
  const animKey = `${view}|${mode}|${cur}`;

  return (
    <>
      <Hero
        page={page}
        onPage={(p) => {
          setNavigated(true);
          setPage(p);
        }}
        role={role}
        onRole={changeRole}
        mode={mode}
        onMode={(m) => changeMode(m)}
        counts={tabCounts}
        cur={cur}
        onCur={setCur}
      />

      <main className="wrap">
        {loading ? (
          <Skeleton />
        ) : (
          <>
            <KpiTiles statusFree={statusFree} filtered={noChip} cur={cur} onOpenRevised={openRevised} />

            {role === 'sales' && (
              <div className="banner" id="roBanner">
                <Icon name="lock" />
                <span><b>Read-only view.</b> Updates are made by the management team (Director / Head of Sales). You can see every value but cannot edit.</span>
              </div>
            )}

            <FilterPanel
              filters={filters}
              onChange={patchFilters}
              moreOpen={moreOpen}
              onMoreOpen={(o) => {
                setMoreOpen(o);
                store.set('moreOpen', o);
              }}
              matchCount={page === 'team' ? noChip.length : filtered.length}
              onSaveStatus={() => {
                store.set('status', filters.status);
                toast('Status filter saved as your default.');
              }}
              onReset={resetFilters}
              chips={page === 'review' && mode !== 'all' ? { mode, counts: chipCounts, active: chip, onPick: setChip } : null}
            />

            {page === 'review' ? (
              <LeadsCard
                key="review"
                leads={filtered}
                mode={mode}
                view={view}
                onView={setView}
                sort={sort}
                onSort={onSort}
                role={role}
                onOpen={setOpenId}
                animKey={animKey}
                revealDelay={navigated ? 0 : 380}
              />
            ) : (
              <TeamSummary key="team" leads={noChip} cur={cur} />
            )}
          </>
        )}

        <p className="foot">
          <img alt="" src={logo} /> Illustrative mockup · sample data only · nothing is saved to SharePoint · reminder e-mails planned for a later phase
        </p>
      </main>

      <LeadDrawer
        lead={openLead}
        role={role}
        draft={openId != null ? drafts[openId] : undefined}
        onField={onField}
        onSave={save}
        onCancel={discard}
        onClose={closeDrawer}
      />
    </>
  );
}
