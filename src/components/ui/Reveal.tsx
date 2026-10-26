import { useState, type ElementType, type ReactNode, type HTMLAttributes, type CSSProperties } from 'react';

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** Entrance delay in ms. */
  delay?: number;
  children?: ReactNode;
};

/**
 * Fade-up entrance. The `reveal` class is removed when the animation ends so the
 * element does not keep a stacking context (which would put dropdowns behind tables).
 */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, onAnimationEnd, ...rest }: Props) {
  const [done, setDone] = useState(false);
  const s = done ? style : ({ ...style, '--d': `${delay}ms` } as CSSProperties);
  return (
    <Tag
      {...rest}
      className={`${className}${done ? '' : ' reveal'}`.trim()}
      style={s}
      onAnimationEnd={(e: React.AnimationEvent<HTMLElement>) => {
        if (e.target === e.currentTarget && e.animationName === 'fadeUp') setDone(true);
        onAnimationEnd?.(e);
      }}
    >
      {children}
    </Tag>
  );
}
