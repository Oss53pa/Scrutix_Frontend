// ============================================================================
// SCRUTIX - OCR Structuration Layer (Layer 4)
// Mapping vers le schema Transaction, normalisation, corrections
// ============================================================================

import type {
  OcrExtractedRow,
  OcrStatementMetadata,
  OcrStructuredOutput,
  OcrValidationResult,
  OcrExtractionMode,
} from './OcrPipelineTypes';

/**
 * Layer 4: Structuration des donnees extraites
 * Normalise les montants, dates, devises et prepare pour import
 */
export class StructurationLayer {
  /**
   * Structure les donnees extraites en sortie finale
   */
  structure(
    rows: OcrExtractedRow[],
    metadata: OcrStatementMetadata,
    validation: OcrValidationResult,
    extractionMode: OcrExtractionMode,
    layerTiming: {
      preAnalysis: number;
      extraction: number;
      validation: number;
    }
  ): OcrStructuredOutput {
    const startTime = performance.now();

    // Normaliser les lignes
    const normalizedRows = rows.map(row => this.normalizeRow(row, metadata));

    // Recalculer les soldes si manquants
    this.fillMissingBalances(normalizedRows, metadata);

    const structurationTime = performance.now() - startTime;

    return {
      rows: normalizedRows,
      metadata,
      validation,
      extractionMode,
      layerTiming: {
        ...layerTiming,
        structuration: Math.round(structurationTime),
        total: Math.round(
          layerTiming.preAnalysis +
          layerTiming.extraction +
          layerTiming.validation +
          structurationTime
        ),
      },
    };
  }

  /**
   * Normalise une ligne extraite
   */
  private normalizeRow(row: OcrExtractedRow, metadata: OcrStatementMetadata): OcrExtractedRow {
    return {
      ...row,
      // Normaliser la date au format ISO-like
      date: this.normalizeDate(row.date),
      valueDate: row.valueDate ? this.normalizeDate(row.valueDate) : undefined,
      // Normaliser les montants
      debit: row.debit ? this.normalizeAmount(row.debit, metadata.currency) : undefined,
      credit: row.credit ? this.normalizeAmount(row.credit, metadata.currency) : undefined,
      balance: row.balance !== undefined ? this.normalizeAmount(row.balance, metadata.currency) : undefined,
      // Nettoyer le libelle
      description: this.normalizeDescription(row.description),
    };
  }

  /**
   * Normalise une date vers le format yyyy-MM-dd
   */
  private normalizeDate(dateStr: string): string {
    const match = dateStr.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return dateStr;
  }

  /**
   * Normalise un montant (arrondi, valeur absolue)
   */
  private normalizeAmount(amount: number, currency: string): number {
    // Les FCFA n'ont pas de centimes
    if (currency === 'XAF' || currency === 'XOF') {
      return Math.round(Math.abs(amount));
    }
    return Math.round(Math.abs(amount) * 100) / 100;
  }

  /**
   * Nettoie un libelle
   */
  private normalizeDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .toUpperCase();
  }

  /**
   * Remplit les soldes manquants par calcul progressif
   */
  private fillMissingBalances(rows: OcrExtractedRow[], metadata: OcrStatementMetadata): void {
    let currentBalance = metadata.openingBalance;
    if (currentBalance === undefined) return;

    for (const row of rows) {
      currentBalance = currentBalance - (row.debit || 0) + (row.credit || 0);

      if (row.balance === undefined) {
        row.balance = currentBalance;
      } else {
        currentBalance = row.balance;
      }
    }
  }
}
