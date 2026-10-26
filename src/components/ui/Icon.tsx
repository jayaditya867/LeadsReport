import type { CSSProperties } from 'react';

export type IconName =
  | 'cal' | 'filter' | 'search' | 'check' | 'clock' | 'alert' | 'trend' | 'layers'
  | 'users' | 'lock' | 'chev' | 'arrow' | 'msg' | 'reset' | 'save' | 'inbox';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Line icon from the inline sprite (see <IconSprite/>). */
export function Icon({ name, size, className = '', style }: IconProps) {
  const s = size ? { width: size, height: size, ...style } : style;
  return (
    <svg className={`ic ${className}`.trim()} style={s} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}

/** Render once at the app root. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></symbol>
      <symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8.5V20l-4-2v-4.5z" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.01" /></symbol>
      <symbol id="i-trend" viewBox="0 0 24 24"><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></symbol>
      <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.4.2 4.1 1.9 4.5 4.5" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></symbol>
      <symbol id="i-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      <symbol id="i-msg" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" /></symbol>
      <symbol id="i-reset" viewBox="0 0 24 24"><path d="M4 4v6h6" /><path d="M5 15a8 8 0 1 0 2-8.5L4 10" /></symbol>
      <symbol id="i-save" viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v6h8M8 21v-7h8v7" /></symbol>
      <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5 5h14l2 8v6H3v-6z" /></symbol>
    </svg>
  );
}
