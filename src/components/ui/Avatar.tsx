import { avatarGradient, initials } from '../../lib/format';

/** Colour-coded owner initials. */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="mini" style={{ background: avatarGradient(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function OwnerChip({ name, bold }: { name: string; bold?: boolean }) {
  return (
    <span className="own">
      <Avatar name={name} />
      {bold ? <b>{name}</b> : name}
    </span>
  );
}
