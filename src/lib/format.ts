import type { Currency } from '../types';
import { AVATAR_GRADIENTS, OWNERS } from '../data/constants';

const LOCALE: Record<Currency, string> = { AED: 'en-US', INR: 'en-IN', USD: 'en-US' };

export const money = (n: number, c: Currency): string => {
  const f = new Intl.NumberFormat(LOCALE[c], { maximumFractionDigits: 0 }).format(n);
  return c === 'INR' ? `₹ ${f}` : `${c} ${f}`;
};

/** Compact amount: ₹ 4.46 Cr / ₹ 24.3 L / AED 6.20 M / AED 464 K */
export const moneyShort = (n: number, c: Currency): string => {
  if (c === 'INR') return n >= 1e7 ? `₹ ${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹ ${(n / 1e5).toFixed(1)} L` : money(n, c);
  return n >= 1e6 ? `${c} ${(n / 1e6).toFixed(2)} M` : n >= 1e3 ? `${c} ${Math.round(n / 1e3)} K` : money(n, c);
};

/** Compact amount without the currency prefix (used where the currency is already shown). */
export const moneyBare = (n: number, c: Currency) => moneyShort(n, c).replace(/^(AED|USD|₹) /, '');

export const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);

export const avatarGradient = (owner: string) => AVATAR_GRADIENTS[Math.max(0, OWNERS.indexOf(owner)) % AVATAR_GRADIENTS.length];

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
