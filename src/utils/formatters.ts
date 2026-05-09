import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Replace narrow no-break space (U+202F) and NBSP (U+00A0) with regular
 * spaces. Some webfonts render U+202F as zero-width, which collapses
 * Intl.NumberFormat('fr-FR') output like "397 914 601" into "397914601".
 */
function normalizeSpaces(s: string): string {
  return s.replace(/[  ]/g, ' ');
}

// Currency formatting
export function formatCurrency(
  amount: number,
  currency: string = 'XAF',
  locale: string = 'fr-FR'
): string {
  const isFranc = currency === 'XAF' || currency === 'XOF';

  // For FCFA, format the number ourselves and append "FCFA" so we get
  // consistent rendering everywhere (Intl outputs "F CFA" with a narrow
  // no-break space which some fonts collapse).
  if (isFranc) {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return `${normalizeSpaces(formatted)} FCFA`;
  }

  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  try {
    return normalizeSpaces(new Intl.NumberFormat(locale, options).format(amount));
  } catch {
    return `${normalizeSpaces(amount.toLocaleString(locale))} ${currency}`;
  }
}

// Short currency format (e.g., 1.5M FCFA)
export function formatCurrencyShort(amount: number, currency: string = 'XAF'): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    return `${sign}${(absAmount / 1_000_000_000).toFixed(1)}Md ${currency}`;
  }
  if (absAmount >= 1_000_000) {
    return `${sign}${(absAmount / 1_000_000).toFixed(1)}M ${currency}`;
  }
  if (absAmount >= 1_000) {
    return `${sign}${(absAmount / 1_000).toFixed(0)}K ${currency}`;
  }
  return formatCurrency(amount, currency);
}

// Number formatting
export function formatNumber(value: number, decimals: number = 0, locale: string = 'fr-FR'): string {
  return normalizeSpaces(
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value),
  );
}

// Percentage formatting
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Date formatting
export function formatDate(
  date: Date | string,
  formatStr: string = 'dd/MM/yyyy'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(dateObj)) {
    return 'Date invalide';
  }

  return format(dateObj, formatStr, { locale: fr });
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function formatDateRelative(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(dateObj)) {
    return 'Date invalide';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Aujourd'hui";
  }
  if (diffDays === 1) {
    return 'Hier';
  }
  if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `Il y a ${months} mois`;
  }

  return formatDate(date);
}

/**
 * Compute a robust period (start, end) from a set of dates.
 *
 * Naive `Math.min` / `Math.max` of transaction dates drift wildly when the
 * extractor picks up a "Solde reporté" entry from the previous period or
 * a misparsed date, producing a 4-month range for a 1-month statement.
 *
 * This helper:
 *   1. Drops invalid / NaN dates
 *   2. Trims to the 5th–95th percentile (5% on each side) to absorb stragglers
 *   3. Falls back to min/max when fewer than 4 dates remain
 *
 * Returns null when no valid date is provided.
 */
export function computeStatementPeriod(
  dates: Array<Date | string | number>,
): { start: Date; end: Date } | null {
  const ms: number[] = [];
  for (const d of dates) {
    const dt = d instanceof Date ? d : new Date(d);
    const t = dt.getTime();
    if (Number.isFinite(t)) ms.push(t);
  }
  if (ms.length === 0) return null;

  ms.sort((a, b) => a - b);

  if (ms.length < 4) {
    return { start: new Date(ms[0]), end: new Date(ms[ms.length - 1]) };
  }

  const lo = Math.floor(ms.length * 0.05);
  const hi = Math.ceil(ms.length * 0.95) - 1;
  return {
    start: new Date(ms[Math.max(0, lo)]),
    end: new Date(ms[Math.min(ms.length - 1, hi)]),
  };
}

// Account number formatting (mask middle digits)
export function formatAccountNumber(accountNumber: string, showFull: boolean = false): string {
  if (showFull || accountNumber.length < 8) {
    return accountNumber;
  }

  const start = accountNumber.slice(0, 4);
  const end = accountNumber.slice(-4);
  const middle = '•'.repeat(Math.max(accountNumber.length - 8, 4));

  return `${start}${middle}${end}`;
}

// File size formatting
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Duration formatting
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Confidence score formatting
export function formatConfidence(confidence: number): string {
  const percentage = Math.round(confidence * 100);
  return `${percentage}%`;
}

// Transaction description truncation
export function truncateDescription(description: string, maxLength: number = 50): string {
  if (description.length <= maxLength) {
    return description;
  }
  return `${description.slice(0, maxLength - 3)}...`;
}
