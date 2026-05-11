import { describe, it, expect } from 'vitest';
import {
  parseAnyDate,
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  formatDateShortFr,
  toIsoDate,
} from '../../lib/dateFormat';

describe('parseAnyDate', () => {
  it('parses ISO date-only as UTC midnight (no timezone shift)', () => {
    const d = parseAnyDate('2026-02-10');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(1);
    expect(d!.getUTCDate()).toBe(10);
    expect(d!.getUTCHours()).toBe(0);
  });

  it('parses ISO datetime with Z', () => {
    const d = parseAnyDate('2026-02-10T08:15:00Z');
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(8);
    expect(d!.getUTCMinutes()).toBe(15);
  });

  it('parses Postgres timestamp without TZ', () => {
    const d = parseAnyDate('2026-02-10 08:15:00');
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(10);
    expect(d!.getUTCHours()).toBe(8);
  });

  it('parses Postgres timestamp with +00', () => {
    const d = parseAnyDate('2026-02-10 08:15:00+00');
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(8);
  });

  it('parses dd/MM/yyyy', () => {
    const d = parseAnyDate('10/02/2026');
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(1);
    expect(d!.getUTCDate()).toBe(10);
  });

  it('parses dd-MM-yyyy', () => {
    const d = parseAnyDate('10-02-2026');
    expect(d!.getUTCMonth()).toBe(1);
    expect(d!.getUTCDate()).toBe(10);
  });

  it('parses dd.MM.yyyy', () => {
    const d = parseAnyDate('10.02.2026');
    expect(d!.getUTCDate()).toBe(10);
  });

  it('parses dd/MM/yy with pivot (26 -> 2026)', () => {
    const d = parseAnyDate('10/02/26');
    expect(d!.getUTCFullYear()).toBe(2026);
  });

  it('parses dd/MM/yy with pivot (99 -> 1999)', () => {
    const d = parseAnyDate('10/02/99');
    expect(d!.getUTCFullYear()).toBe(1999);
  });

  it('parses yyyy/MM/dd', () => {
    const d = parseAnyDate('2026/02/10');
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(1);
  });

  it('parses French long "10 février 2026"', () => {
    const d = parseAnyDate('10 février 2026');
    expect(d!.getUTCMonth()).toBe(1);
    expect(d!.getUTCDate()).toBe(10);
  });

  it('parses French short "10 fev 2026"', () => {
    const d = parseAnyDate('10 fev 2026');
    expect(d!.getUTCMonth()).toBe(1);
  });

  it('parses French abbreviated with dot "10 févr. 2026"', () => {
    const d = parseAnyDate('10 févr. 2026');
    expect(d!.getUTCMonth()).toBe(1);
  });

  it('parses Date objects (pass-through)', () => {
    const src = new Date(Date.UTC(2026, 1, 10));
    const d = parseAnyDate(src);
    expect(d).toBe(src);
  });

  it('parses millisecond timestamps', () => {
    const ms = Date.UTC(2026, 1, 10, 12, 0, 0);
    const d = parseAnyDate(ms);
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCHours()).toBe(12);
  });

  it('parses second timestamps (heuristic < 1e11)', () => {
    const sec = Math.floor(Date.UTC(2026, 1, 10, 12, 0, 0) / 1000);
    const d = parseAnyDate(sec);
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCDate()).toBe(10);
  });

  it('returns null for invalid string', () => {
    expect(parseAnyDate('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAnyDate('')).toBeNull();
  });

  it('returns null for null / undefined', () => {
    expect(parseAnyDate(null)).toBeNull();
    expect(parseAnyDate(undefined)).toBeNull();
  });

  it('rejects overflow date (31 février)', () => {
    expect(parseAnyDate('31/02/2026')).toBeNull();
  });
});

describe('formatDateDDMMYYYY', () => {
  it('formats ISO date-only without timezone shift', () => {
    // Le bug original : new Date("2026-02-10") en UTC- décale au 9.
    expect(formatDateDDMMYYYY('2026-02-10')).toBe('10/02/2026');
  });

  it('formats ISO datetime', () => {
    expect(formatDateDDMMYYYY('2026-02-10T23:59:00Z')).toBe('10/02/2026');
  });

  it('formats dd/MM/yyyy roundtrip', () => {
    expect(formatDateDDMMYYYY('10/02/2026')).toBe('10/02/2026');
  });

  it('returns — for invalid input', () => {
    expect(formatDateDDMMYYYY('garbage')).toBe('—');
    expect(formatDateDDMMYYYY(null)).toBe('—');
  });

  it('pads single digits', () => {
    expect(formatDateDDMMYYYY('2026-01-05')).toBe('05/01/2026');
  });
});

describe('formatDateTimeDDMMYYYY', () => {
  it('formats with HH:mm', () => {
    expect(formatDateTimeDDMMYYYY('2026-02-10T08:15:00Z')).toBe('10/02/2026 08:15');
  });

  it('returns — for invalid', () => {
    expect(formatDateTimeDDMMYYYY('xxx')).toBe('—');
  });
});

describe('formatDateShortFr', () => {
  it('formats short French date', () => {
    expect(formatDateShortFr('2026-02-10')).toBe('10 févr. 2026');
  });

  it('handles all months', () => {
    expect(formatDateShortFr('2026-01-01')).toMatch(/janv\./);
    expect(formatDateShortFr('2026-12-31')).toMatch(/déc\./);
  });
});

describe('toIsoDate', () => {
  it('converts ISO datetime to date-only', () => {
    expect(toIsoDate('2026-02-10T23:00:00Z')).toBe('2026-02-10');
  });

  it('converts dd/MM/yyyy to ISO', () => {
    expect(toIsoDate('10/02/2026')).toBe('2026-02-10');
  });

  it('returns null for invalid', () => {
    expect(toIsoDate('garbage')).toBeNull();
  });
});
