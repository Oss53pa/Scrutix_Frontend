// ============================================================================
// Excel adapter — extracts text + tables from .xlsx / .xls / .csv
// ============================================================================

import ExcelJS from 'exceljs';
import type { DocumentAdapter, ExtractionOptions } from '../types';

export class ExcelAdapter implements DocumentAdapter {
  async extract(input: File | Blob | ArrayBuffer, options?: ExtractionOptions) {
    options?.onProgress?.({ stage: 'excel', pct: 0, message: 'Lecture du fichier Excel...' });

    const buffer = await this.toArrayBuffer(input);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const tables: string[][][] = [];
    const lines: string[] = [];

    for (const sheet of wb.worksheets) {
      const sheetTable: string[][] = [];
      lines.push(`\n=== ${sheet.name} ===\n`);

      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          let v: string;
          if (cell.value === null || cell.value === undefined) {
            v = '';
          } else if (typeof cell.value === 'object' && 'text' in (cell.value as object)) {
            v = String((cell.value as { text: string }).text);
          } else if (typeof cell.value === 'object' && 'result' in (cell.value as object)) {
            v = String((cell.value as { result: unknown }).result ?? '');
          } else {
            v = String(cell.value);
          }
          cells.push(v.trim());
        });
        sheetTable.push(cells);
        // Tab-separated for downstream tabular detection
        lines.push(cells.join('\t'));
      });

      tables.push(sheetTable);
    }

    options?.onProgress?.({ stage: 'excel', pct: 1, message: 'Excel lu' });

    return {
      text: lines.join('\n'),
      pages: wb.worksheets.length,
      tables,
    };
  }

  private async toArrayBuffer(input: File | Blob | ArrayBuffer): Promise<ArrayBuffer> {
    if (input instanceof ArrayBuffer) return input;
    return await (input as Blob).arrayBuffer();
  }
}
