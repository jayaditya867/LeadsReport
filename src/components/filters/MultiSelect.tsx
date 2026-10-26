import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  id: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  labels?: Record<string, string>;
  /** Options to tag as NEW. */
  newTags?: string[];
}

/** Checkbox dropdown used for Status, Lead Owner, Proposal Status and Site Status. */
export function MultiSelect({ id, options, selected, onChange, labels, newTags }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const label = (o: string) => labels?.[o] ?? o;
  const summary = selected.length === 0 ? 'All' : selected.length === 1 ? label(selected[0]) : `${selected.length} selected`;
  const toggle = (o: string, on: boolean) => onChange(on ? [...selected, o] : selected.filter((x) => x !== o));

  return (
    <div className="msel" id={id} ref={ref}>
      <button type="button" aria-haspopup="true" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)}>
        {summary}
      </button>
      {open && (
        <div className="menu" id={menuId}>
          {options.map((o) => (
            <label key={o}>
              <input type="checkbox" value={o} checked={selected.includes(o)} onChange={(e) => toggle(o, e.target.checked)} /> {label(o)}
              {newTags?.includes(o) && <span className="newtag">NEW</span>}
            </label>
          ))}
          <button type="button" className="link" data-clear onClick={() => onChange([])}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
