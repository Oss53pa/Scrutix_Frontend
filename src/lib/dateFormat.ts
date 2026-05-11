// ============================================================================
// dateFormat — tolerant date parser/formatter (UTC-safe)
// ============================================================================
// Centralise toute la conversion de dates dans l'app : les relevés bancaires
// CEMAC/UEMOA contiennent des dates dans 10+ formats différents (ISO, dd/MM,
// dd-MM, dd.MM, français long, timestamps ms/sec, etc.). Ce module accepte
// TOUT et produit des dates UTC normalisées pour éviter les décalages de
// fuseau horaire sur les dates « date-only ».
//
// Règles :
//   1. parseAnyDate() retourne un Date en UTC (jamais de timezone shift).
//   2. format* utilisent uniquement getUTC* (pas de toLocaleDateString).
//   3. Tous les exports retournent '—' si l'entrée est invalide (pas d'erreur).
// ============================================================================

/** Pivot pour les années à 2 chiffres : <=50 => 20xx, >50 => 19xx. */
const TWO_DIGIT_YEAR_PIVOT = 50;

/** Mois français (long + abrégés) → index 0-11. */
const FR_MONTHS: Record<string, number> = {
  // longs
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
  // abrégés (3-4 lettres, sans accent, sans point)
  jan: 0, fev: 1, mar: 2, avr: 3, jui: 5, juil: 6,
  sep: 8, oct: 9, nov: 10, dec: 11,
};

function stripAccents(s: string): string {
  // Combining diacritical marks: U+0300..U+036F
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Parse n'importe quel format raisonnable de date et retourne un Date UTC.
 * Retourne null si non parsable.
 *
 * Formats acceptés :
 *   - ISO date-only       : 2026-02-10
 *   - ISO datetime        : 2026-02-10T08:15:00Z, 2026-02-10T08:15:00.123+02:00
 *   - Postgres timestamp  : 2026-02-10 08:15:00, 2026-02-10 08:15:00+00
 *   - dd/MM/yyyy          : 10/02/2026
 *   - dd-MM-yyyy          : 10-02-2026
 *   - dd.MM.yyyy          : 10.02.2026
 *   - dd/MM/yy            : 10/02/26 (pivot 50)
 *   - yyyy/MM/dd          : 2026/02/10
 *   - Français long       : 10 février 2026
 *   - Français abrégé     : 10 fev 2026, 10 févr. 2026
 *   - Date object         : passe-plat
 *   - Timestamp ms        : 1739174400000
 *   - Timestamp sec       : 1739174400 (heuristique : < 10^11)
 */
export function parseAnyDate(input: unknown): Date | null {
  if (input == null) return null;

  // Date object
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // Timestamp numérique
  if (typeof input === 'number') {
    if (!isFinite(input)) return null;
    // Heuristique : < 10^11 = secondes, sinon ms
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  // Numeric string ?
  if (/^-?\d+$/.test(s)) {
    return parseAnyDate(Number(s));
  }

  // 1) ISO date-only : 2026-02-10
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return makeUtcDate(+m[1], +m[2] - 1, +m[3]);

  // 2) ISO datetime (avec ou sans timezone) : laisser le moteur JS gérer
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // 3) Postgres timestamp : "2026-02-10 08:15:00" ou "2026-02-10 08:15:00+00"
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? 'Z'}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // 4) dd/MM/yyyy, dd-MM-yyyy, dd.MM.yyyy
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) return makeUtcDate(+m[3], +m[2] - 1, +m[1]);

  // 5) dd/MM/yy
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2})$/);
  if (m) {
    const yy = +m[3];
    const year = yy <= TWO_DIGIT_YEAR_PIVOT ? 2000 + yy : 1900 + yy;
    return makeUtcDate(year, +m[2] - 1, +m[1]);
  }

  // 6) yyyy/MM/dd
  m = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
  if (m) return makeUtcDate(+m[1], +m[2] - 1, +m[3]);

  // 7) Français : "10 février 2026", "10 fev 2026", "10 févr. 2026"
  m = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\.?\s+(\d{2,4})$/);
  if (m) {
    const day = +m[1];
    const monthKey = stripAccents(m[2].replace(/\.$/, '').toLowerCase()).slice(0, 4);
    // essayer 4 puis 3 lettres
    const monthIdx =
      FR_MONTHS[monthKey] ??
      FR_MONTHS[monthKey.slice(0, 3)] ??
      FR_MONTHS[stripAccents(m[2].replace(/\.$/, '').toLowerCase())];
    if (monthIdx == null) return null;
    let year = +m[3];
    if (year < 100) year = year <= TWO_DIGIT_YEAR_PIVOT ? 2000 + year : 1900 + year;
    return makeUtcDate(year, monthIdx, day);
  }

  // 8) Dernier recours : parser natif
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function makeUtcDate(year: number, monthIdx: number, day: number): Date | null {
  if (
    !Number.isFinite(year) || !Number.isFinite(monthIdx) || !Number.isFinite(day) ||
    monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31
  ) return null;
  const d = new Date(Date.UTC(year, monthIdx, day));
  if (isNaN(d.getTime())) return null;
  // Reject overflow (e.g. 31 février)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIdx || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

// ============================================================================
// Formatters (UTC-safe — pas de timezone shift)
// ============================================================================

/** "10/02/2026" — format français standard, UTC-safe. */
export function formatDateDDMMYYYY(input: unknown): string {
  const d = parseAnyDate(input);
  if (!d) return '—';
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** "10/02/2026 08:15" — datetime français. */
export function formatDateTimeDDMMYYYY(input: unknown): string {
  const d = parseAnyDate(input);
  if (!d) return '—';
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** "10 fév 2026" — version courte pour timelines / cards. */
export function formatDateShortFr(input: unknown): string {
  const d = parseAnyDate(input);
  if (!d) return '—';
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-02-10" — ISO date-only, utile pour DB / filtres. */
export function toIsoDate(input: unknown): string | null {
  const d = parseAnyDate(input);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
