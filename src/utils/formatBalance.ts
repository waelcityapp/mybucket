import { Language } from '../types';

export function formatAccountBalance(value: number, lang: Language): string {
  const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `${lang === 'ar' ? 'سالب' : 'Negative'} ${formatted}` : formatted;
}

export function isNonNegativeBalance(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
