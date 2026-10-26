export const DAY = 86_400_000;

export const startOfDay = (d: Date | number | string): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const TODAY = startOfDay(new Date());

/** Local yyyy-mm-dd */
export const iso = (d: Date | number | string): string => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const addDays = (d: Date, n: number): Date => startOfDay(new Date(d.getTime() + n * DAY));

export const fmtD = (s?: string | null): string =>
  s
    ? new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export const fmtDateTime = (s: string): string =>
  new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

/** Weekly update cycle starts on Saturday (management reviews leads every Saturday). */
export const CYCLE_START: Date = (() => {
  const d = startOfDay(TODAY);
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
  return d;
})();

export const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

export const CYCLE_LABEL = `${shortDate(CYCLE_START)} – ${addDays(CYCLE_START, 6).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
})} · resets Saturday`;
