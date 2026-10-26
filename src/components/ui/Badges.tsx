import { useEffect, useRef, useState } from 'react';
import type { Lead } from '../../types';
import { STATUS_CLS, STATUS_LABEL } from '../../data/constants';
import type { Bucket } from '../../types';

export function StatusBadge({ status }: { status: Lead['status'] }) {
  return <span className={`badge ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function DueBadge({ bucket, title }: { bucket: Bucket; title?: string }) {
  return (
    <span className={`badge ${bucket.c}`} title={title}>
      {bucket.t}
    </span>
  );
}

/** Count pill that gives a short "bump" whenever its value changes. */
export function CountPill({ value, tone = '', title, id }: { value: number | string; tone?: '' | 'red' | 'amber' | 'grey'; title?: string; id?: string }) {
  const [bump, setBump] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setBump(true);
    const t = setTimeout(() => setBump(false), 520);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span id={id} className={`pill ${tone} ${bump ? 'bump' : ''}`.replace(/\s+/g, ' ').trim()} title={title}>
      {value}
    </span>
  );
}
