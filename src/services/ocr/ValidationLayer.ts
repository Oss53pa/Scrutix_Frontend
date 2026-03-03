// ============================================================================
// SCRUTIX - OCR Validation Layer (Layer 3)
// Validation des donnees extraites: soldes, dates, montants, doublons
// ============================================================================

import type {
  OcrExtractedRow,
  OcrStatementMetadata,
  OcrValidationResult,
  OcrValidationWarning,
  OcrCorrection,
} from './OcrPipelineTypes';

/**
 * Layer 3: Validation des donnees extraites
 * Verifie la coherence des soldes, l'ordre des dates, les formats de montants
 */
export class ValidationLayer {
  /**
   * Valide les donnees extraites
   */
  validate(
    rows: OcrExtractedRow[],
    metadata: OcrStatementMetadata
  ): OcrValidationResult {
    const warnings: OcrValidationWarning[] = [];
    const corrections: OcrCorrection[] = [];

    // 1. Verification progressive des soldes
    this.checkBalanceProgression(rows, metadata, warnings);

    // 2. Verification de l'ordre des dates
    this.checkDateOrdering(rows, warnings);

    // 3. Validation des formats de montants
    this.checkAmountFormats(rows, warnings, corrections);

    // 4. Detection de devise
    this.checkCurrency(rows, metadata, warnings);

    // 5. Detection de doublons
    this.checkDuplicates(rows, warnings);

    const isValid = warnings.filter(w => w.severity === 'high').length === 0;
    const confidence = this.calculateConfidence(warnings, rows);

    return {
      isValid,
      confidence,
      warnings,
      corrections,
    };
  }

  /**
   * Verification progressive des soldes
   */
  private checkBalanceProgression(
    rows: OcrExtractedRow[],
    metadata: OcrStatementMetadata,
    warnings: OcrValidationWarning[]
  ): void {
    let currentBalance = metadata.openingBalance;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (currentBalance !== undefined && row.balance !== undefined) {
        const expectedBalance = currentBalance - (row.debit || 0) + (row.credit || 0);
        const diff = Math.abs(expectedBalance - row.balance);

        if (diff > 1) { // Tolerance de 1 (arrondi)
          warnings.push({
            type: 'balance',
            message: `Ecart de solde ligne ${i + 1}: attendu ${expectedBalance.toFixed(2)}, trouve ${row.balance.toFixed(2)} (ecart: ${diff.toFixed(2)})`,
            severity: diff > 100 ? 'high' : 'medium',
            rowIndex: i,
          });
        }
      }

      if (row.balance !== undefined) {
        currentBalance = row.balance;
      } else if (currentBalance !== undefined) {
        currentBalance = currentBalance - (row.debit || 0) + (row.credit || 0);
      }
    }

    // Verifier le solde final
    if (currentBalance !== undefined && metadata.closingBalance !== undefined) {
      const diff = Math.abs(currentBalance - metadata.closingBalance);
      if (diff > 1) {
        warnings.push({
          type: 'balance',
          message: `Solde final calcule (${currentBalance.toFixed(2)}) differe du solde annonce (${metadata.closingBalance.toFixed(2)})`,
          severity: 'high',
        });
      }
    }
  }

  /**
   * Verification de l'ordre des dates
   */
  private checkDateOrdering(rows: OcrExtractedRow[], warnings: OcrValidationWarning[]): void {
    for (let i = 1; i < rows.length; i++) {
      const prevDate = this.parseDate(rows[i - 1].date);
      const currDate = this.parseDate(rows[i].date);

      if (prevDate && currDate && currDate < prevDate) {
        warnings.push({
          type: 'date_order',
          message: `Date non chronologique ligne ${i + 1}: ${rows[i].date} < ${rows[i - 1].date}`,
          severity: 'medium',
          rowIndex: i,
        });
      }
    }
  }

  /**
   * Validation des formats de montants
   */
  private checkAmountFormats(
    rows: OcrExtractedRow[],
    warnings: OcrValidationWarning[],
    corrections: OcrCorrection[]
  ): void {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Verifier qu'au moins un montant est present
      if (!row.debit && !row.credit) {
        warnings.push({
          type: 'amount_format',
          message: `Ligne ${i + 1}: aucun montant (debit/credit) detecte`,
          severity: 'high',
          rowIndex: i,
        });
      }

      // Verifier les montants negatifs (ne devraient pas l'etre dans les colonnes separees)
      if (row.debit && row.debit < 0) {
        corrections.push({
          field: 'debit',
          rowIndex: i,
          originalValue: String(row.debit),
          correctedValue: String(Math.abs(row.debit)),
          reason: 'Montant debit negatif normalise en valeur absolue',
        });
        row.debit = Math.abs(row.debit);
      }

      if (row.credit && row.credit < 0) {
        corrections.push({
          field: 'credit',
          rowIndex: i,
          originalValue: String(row.credit),
          correctedValue: String(Math.abs(row.credit)),
          reason: 'Montant credit negatif normalise en valeur absolue',
        });
        row.credit = Math.abs(row.credit);
      }
    }
  }

  /**
   * Detection de devise
   */
  private checkCurrency(
    rows: OcrExtractedRow[],
    metadata: OcrStatementMetadata,
    warnings: OcrValidationWarning[]
  ): void {
    if (!metadata.currency) {
      warnings.push({
        type: 'currency',
        message: 'Devise non detectee, XAF (FCFA) utilise par defaut',
        severity: 'low',
      });
    }

    // Verifier si les montants sont coherents avec la devise
    // Les montants en FCFA sont generalement > 100 et sans centimes
    const hasSmallAmounts = rows.some(r =>
      (r.debit && r.debit < 10) || (r.credit && r.credit < 10)
    );

    if (hasSmallAmounts && (metadata.currency === 'XAF' || metadata.currency === 'XOF')) {
      warnings.push({
        type: 'currency',
        message: 'Montants tres faibles detectes pour une devise FCFA - verifier la devise',
        severity: 'medium',
      });
    }
  }

  /**
   * Detection de doublons dans les donnees extraites
   */
  private checkDuplicates(rows: OcrExtractedRow[], warnings: OcrValidationWarning[]): void {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (
          rows[i].date === rows[j].date &&
          rows[i].debit === rows[j].debit &&
          rows[i].credit === rows[j].credit &&
          rows[i].description === rows[j].description
        ) {
          warnings.push({
            type: 'duplicate',
            message: `Doublon possible: lignes ${i + 1} et ${j + 1} (${rows[i].description})`,
            severity: 'medium',
            rowIndex: j,
          });
        }
      }
    }
  }

  /**
   * Parse une date au format dd/MM/yyyy
   */
  private parseDate(dateStr: string): Date | null {
    const match = dateStr.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
    if (!match) return null;

    const [, day, month, year] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    if (isNaN(date.getTime())) return null;
    return date;
  }

  /**
   * Calcule la confiance de la validation
   */
  private calculateConfidence(warnings: OcrValidationWarning[], rows: OcrExtractedRow[]): number {
    if (rows.length === 0) return 0;

    let penalty = 0;
    for (const warning of warnings) {
      switch (warning.severity) {
        case 'high': penalty += 0.2; break;
        case 'medium': penalty += 0.05; break;
        case 'low': penalty += 0.02; break;
      }
    }

    return Math.max(0, 1 - penalty);
  }
}
