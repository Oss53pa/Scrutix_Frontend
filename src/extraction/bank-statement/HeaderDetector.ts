// ============================================================================
// ATLASBANX — Table header detector
// ============================================================================
// Finds the row that announces the data table by searching for a small set
// of keywords that appear together horizontally. Maps each column to a
// logical role using a synonym dictionary. Supports French + English
// terminology and tolerates spelling variations seen across UEMOA/CEMAC.
//
// The detector returns a TableStructure with X boundaries per column;
// downstream code uses those boundaries to snap content rows to columns.
// ============================================================================

import type {
  ColumnRole,
  DetectedColumn,
  PositionedItem,
  ReconstructedRow,
  TableStructure,
} from './types';

interface HeaderKeyword {
  role: ColumnRole;
  /** Lowercased, accents-stripped patterns. ANY match → this role */
  patterns: RegExp[];
  /** Bonus weight when this column is found (higher = more important to find) */
  weight: number;
}

const HEADER_KEYWORDS: HeaderKeyword[] = [
  // Most discriminative columns first (their presence proves it's a tx table)
  {
    role: 'debit',
    weight: 3,
    patterns: [/^debit/, /^debits$/, /^deb\.?$/, /^debit\s*\(.*\)$/, /^debit\s*xof$/, /^debit\s*xaf$/, /^debit\s*eur$/, /^retraits?$/, /^withdrawals?$/, /^sortie/],
  },
  {
    role: 'credit',
    weight: 3,
    patterns: [/^credit/, /^credits$/, /^cred\.?$/, /^credit\s*\(.*\)$/, /^credit\s*xof$/, /^credit\s*xaf$/, /^credit\s*eur$/, /^versements?$/, /^deposits?$/, /^entrees?$/],
  },
  {
    role: 'balance',
    weight: 3,
    patterns: [/^solde/, /^balance/, /^solde\s*\(.*\)$/, /^solde\s*xof$/, /^solde\s*xaf$/, /^solde\s*eur$/, /^running\s*bal/],
  },
  {
    role: 'amount',
    weight: 2,
    patterns: [/^montant/, /^amount/, /^somme/, /^valeur\s*op/, /^montant\s*\(.*\)$/, /^op\.?\s*amount/],
  },
  {
    role: 'description',
    weight: 2,
    patterns: [/^libelle/, /^libelle\s*de/, /^description/, /^objet/, /^operation/, /^operations?$/, /^narration/, /^details?/, /^wording/, /^designation/],
  },
  {
    role: 'reference',
    weight: 1,
    patterns: [/^reference/, /^ref\.?$/, /^n[°o]\s*piece/, /^numero/, /^transaction/, /^txn/, /^cheque/, /^ref\s*ext/],
  },
  {
    role: 'value_date',
    weight: 1,
    patterns: [/^valeur/, /^value\s*date/, /^date\s*valeur/, /^d\.\s*v\.$/, /^d\.v\.?$/, /^dv$/],
  },
  {
    role: 'date',
    weight: 3,
    patterns: [/^date$/, /^date\s*op/, /^date\s*operation/, /^operation\s*date/, /^posting\s*date/, /^date\s*compt/, /^d\.o\.?$/],
  },
  {
    role: 'type',
    weight: 1,
    patterns: [/^sens$/, /^type$/, /^d\/c$/, /^debit\/credit$/, /^cr\/db$/],
  },
  {
    role: 'currency',
    weight: 0.5,
    patterns: [/^devise$/, /^currency$/, /^cur\.?$/, /^ccy$/],
  },
];

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to identify which keyword role this header label matches.
 * Returns the role + the keyword's weight, or null on no match.
 */
function classifyHeaderLabel(label: string): { role: ColumnRole; weight: number } | null {
  const norm = normalize(label);
  if (!norm) return null;

  // Try concatenated patterns first (longer matches), then single words
  for (const kw of HEADER_KEYWORDS) {
    for (const re of kw.patterns) {
      if (re.test(norm)) return { role: kw.role, weight: kw.weight };
    }
  }
  return null;
}

/**
 * Cluster items into rows by Y. Items within `tolerance` PDF units of each
 * other are considered on the same line. Returns rows sorted top-to-bottom.
 */
export function clusterRows(
  items: PositionedItem[],
  page: number,
  tolerance = 3,
): ReconstructedRow[] {
  const pageItems = items.filter((it) => it.page === page);
  // Sort by Y descending (PDF coords have Y growing upward)
  const sorted = [...pageItems].sort((a, b) => b.y - a.y);
  const rows: ReconstructedRow[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= tolerance) {
      last.items.push(it);
    } else {
      rows.push({ page, y: it.y, items: [it] });
    }
  }
  // Sort items within each row by X (left to right)
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * Build candidate header labels by joining adjacent items in the same row
 * that look like one header (e.g., "Débit" + "(XOF)" → "Débit (XOF)").
 *
 * Adjacency rule: items separated by less than `gapThreshold` PDF units are
 * grouped into the same label.
 */
function buildLabelsFromRow(
  row: ReconstructedRow,
  gapThreshold = 8,
): Array<{ label: string; xLeft: number; xRight: number }> {
  if (row.items.length === 0) return [];
  const groups: PositionedItem[][] = [[row.items[0]]];
  for (let i = 1; i < row.items.length; i++) {
    const prev = row.items[i - 1];
    const cur = row.items[i];
    const prevRight = prev.x + (prev.width ?? 0);
    if (cur.x - prevRight < gapThreshold) {
      groups[groups.length - 1].push(cur);
    } else {
      groups.push([cur]);
    }
  }
  return groups.map((g) => {
    const xLeft = g[0].x;
    const last = g[g.length - 1];
    const xRight = last.x + (last.width ?? 30);
    return { label: g.map((it) => it.text).join(' ').trim(), xLeft, xRight };
  });
}

/**
 * Detect the table structure from a list of rows on a single page.
 * Returns null if no plausible header was found.
 */
export function detectTableStructure(
  rows: ReconstructedRow[],
): TableStructure | null {
  let best: { score: number; structure: TableStructure } | null = null;

  for (const row of rows) {
    const labels = buildLabelsFromRow(row);
    if (labels.length < 3) continue;

    const detectedColumns: DetectedColumn[] = [];
    let totalWeight = 0;
    let foundDate = false;
    let foundAnyAmount = false;

    for (const lbl of labels) {
      const cls = classifyHeaderLabel(lbl.label);
      if (cls) {
        detectedColumns.push({
          role: cls.role,
          label: lbl.label,
          xLeft: lbl.xLeft,
          xRight: lbl.xRight,
          page: row.page,
        });
        totalWeight += cls.weight;
        if (cls.role === 'date') foundDate = true;
        if (
          cls.role === 'debit' ||
          cls.role === 'credit' ||
          cls.role === 'amount' ||
          cls.role === 'balance'
        ) {
          foundAnyAmount = true;
        }
      }
    }

    if (!foundDate || !foundAnyAmount || detectedColumns.length < 3) continue;

    // Score = weighted matches normalized by total possible weight
    const score = totalWeight / 12; // 12 ≈ sum of all max weights for a typical row

    // Compute right boundaries: each column's xRight = next column's xLeft - 1
    detectedColumns.sort((a, b) => a.xLeft - b.xLeft);
    for (let i = 0; i < detectedColumns.length - 1; i++) {
      detectedColumns[i].xRight = detectedColumns[i + 1].xLeft - 1;
    }

    const structure: TableStructure = {
      columns: detectedColumns,
      headerY: row.y,
      headerPage: row.page,
      confidence: Math.min(1, score),
    };

    if (!best || score > best.score) {
      best = { score, structure };
    }
  }

  return best?.structure ?? null;
}
