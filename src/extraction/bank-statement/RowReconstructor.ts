// ============================================================================
// ATLASBANX — Row reconstructor
// ============================================================================
// Once the table structure is known, this module:
//   1. Snaps each item to the column whose [xLeft, xRight] bounds it falls into
//   2. Concatenates same-column items into a single cell text
//   3. Merges multi-line transactions: a row WITHOUT a date in its date column
//      is treated as a continuation of the previous logical transaction.
// ============================================================================

import type {
  ColumnRole,
  MappedRow,
  PositionedItem,
  ReconstructedRow,
  TableStructure,
} from './types';

const DATE_LIKE = /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/;

/**
 * Snap a row's items to the columns of the table structure.
 * Items whose center X lies between [xLeft, xRight) are assigned to that column.
 * If an item falls outside any column, it's appended to the nearest one.
 */
export function snapRowToColumns(
  row: ReconstructedRow,
  structure: TableStructure,
): MappedRow {
  const cells: Partial<Record<ColumnRole, string[]>> = {};
  const cols = structure.columns;

  for (const item of row.items) {
    const centerX = item.x + (item.width ?? 0) / 2;
    let col = cols.find((c) => centerX >= c.xLeft && centerX < c.xRight);
    if (!col) {
      // Snap to nearest column (left or right edge)
      let bestDist = Infinity;
      for (const c of cols) {
        const d = Math.min(Math.abs(centerX - c.xLeft), Math.abs(centerX - c.xRight));
        if (d < bestDist) {
          bestDist = d;
          col = c;
        }
      }
    }
    if (!col) continue;
    if (!cells[col.role]) cells[col.role] = [];
    cells[col.role]!.push(item.text);
  }

  const flat: Partial<Record<ColumnRole, string>> = {};
  for (const [role, parts] of Object.entries(cells) as [ColumnRole, string[]][]) {
    flat[role] = parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  return {
    page: row.page,
    y: row.y,
    cells: flat,
    items: row.items,
  };
}

/**
 * Merge logically-multiline transactions. A row whose `date` cell does NOT
 * contain a date pattern is fused into the most recent row that DID have one.
 * Description, reference, and other text columns are concatenated.
 *
 * This handles bank formats like NSIA where one transaction spans 2-5 visual
 * rows (cheque details, beneficiary, issuer bank, etc.).
 */
export function mergeMultilineTransactions(rows: MappedRow[]): MappedRow[] {
  const merged: MappedRow[] = [];
  for (const row of rows) {
    const dateCell = row.cells.date ?? '';
    const hasDate = DATE_LIKE.test(dateCell);
    const last = merged[merged.length - 1];

    // First row OR row with a fresh date → start a new transaction
    if (!last || hasDate) {
      merged.push({ ...row, cells: { ...row.cells } });
      continue;
    }

    // Continuation — fold this row into the previous one
    for (const role of Object.keys(row.cells) as ColumnRole[]) {
      const value = row.cells[role];
      if (!value) continue;

      // Concatenate descriptive columns; for amount columns keep the first
      // non-empty value (banks rarely split amounts across lines)
      if (
        role === 'description' ||
        role === 'reference' ||
        role === 'type' ||
        role === 'unknown'
      ) {
        last.cells[role] = (last.cells[role] ? last.cells[role] + ' ' : '') + value;
      } else if (!last.cells[role]) {
        last.cells[role] = value;
      }
    }
    last.items.push(...row.items);
  }
  return merged;
}

/**
 * Filter rows that are clearly NOT transactions:
 *   - the page header / sub-header
 *   - "Page X sur Y" markers
 *   - the totals row at the bottom ("Total" + 2 amounts)
 *   - rows above the header on the page
 */
export function filterNoise(
  rows: MappedRow[],
  structure: TableStructure,
): MappedRow[] {
  return rows.filter((row) => {
    if (row.page === structure.headerPage && row.y >= structure.headerY) {
      // On the header page, skip rows above and including the header line
      return false;
    }

    const allText = Object.values(row.cells).join(' ').toLowerCase();
    if (!allText) return false;
    if (/^page\s+\d+\s+(sur|of|de)\s+\d+$/i.test(allText.trim())) return false;
    if (/^total$/i.test(allText.trim())) return false;
    if (/^solde\s+(initial|final|au)/i.test(allText.trim())) return false;
    return true;
  });
}

// Re-export for convenience
export type { PositionedItem, ReconstructedRow, MappedRow, TableStructure };
