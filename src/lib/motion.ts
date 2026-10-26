/** True when the OS asks for reduced motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lock page scroll while a modal panel is open, without the page jumping sideways:
 * the scrollbar is hidden and its width is added as padding (0 for overlay scrollbars).
 */
export function lockPageScroll(lock: boolean) {
  const html = document.documentElement;
  if (lock) {
    if (html.classList.contains('lock')) return;
    const sw = window.innerWidth - html.clientWidth;
    html.classList.add('lock');
    document.body.style.paddingRight = sw > 0 ? `${sw}px` : '';
  } else {
    html.classList.remove('lock');
    document.body.style.paddingRight = '';
  }
}
