// ============================================================================
// SCRUTIX - OCR Extraction Layer (Layer 2)
// Extraction multi-mode: Template -> Vision AI -> Tesseract+AI
// ============================================================================

import type {
  OcrDocumentAnalysis,
  OcrExtractionMode,
  OcrExtractedRow,
  OcrStatementMetadata,
} from './OcrPipelineTypes';
import { TemplateExtractor } from './TemplateExtractor';
import type { BankTemplateConfig } from './TemplateExtractor';

/**
 * Resultat d'extraction
 */
export interface ExtractionResult {
  rows: OcrExtractedRow[];
  metadata: OcrStatementMetadata;
  mode: OcrExtractionMode;
  confidence: number;
}

/** Minimum confidence for template extraction before fallback */
const TEMPLATE_CONFIDENCE_THRESHOLD = 0.5;

/** Minimum confidence for vision AI before fallback */
const VISION_CONFIDENCE_THRESHOLD = 0.4;

/**
 * Layer 2: Extraction multi-mode avec fallback
 * Mode A (template) -> Mode B (vision AI) -> Mode C (Tesseract + AI correction)
 */
export class ExtractionLayer {
  private templateExtractor: TemplateExtractor;

  constructor() {
    this.templateExtractor = new TemplateExtractor();
  }

  /**
   * Extrait les donnees selon le mode recommande, avec fallback
   */
  async extract(
    rawText: string,
    analysis: OcrDocumentAnalysis,
    template?: BankTemplateConfig,
    forceMode?: OcrExtractionMode
  ): Promise<ExtractionResult> {
    const mode = forceMode || analysis.recommendedMode;

    // Mode A: Template
    if ((mode === 'template' || !forceMode) && template) {
      try {
        const result = await this.templateExtractor.extract(rawText, template);
        if (result.confidence >= TEMPLATE_CONFIDENCE_THRESHOLD && result.rows.length > 0) {
          return {
            rows: result.rows,
            metadata: result.metadata,
            mode: 'template',
            confidence: result.confidence,
          };
        }
      } catch {
        // Fallback to next mode
      }
    }

    // Mode B: Vision AI (placeholder - needs PROPH3T vision model)
    if (mode === 'vision_ai' || !forceMode) {
      try {
        const result = await this.extractWithVisionAI(rawText, analysis);
        if (result.confidence >= VISION_CONFIDENCE_THRESHOLD && result.rows.length > 0) {
          return result;
        }
      } catch {
        // Fallback to next mode
      }
    }

    // Mode C: Tesseract + AI text correction (always available)
    return this.extractWithTesseractAI(rawText, analysis);
  }

  /**
   * Mode B: Extraction via modele de vision IA
   * Utilise PROPH3T avec le role 'vision' pour analyser l'image
   */
  private async extractWithVisionAI(
    rawText: string,
    analysis: OcrDocumentAnalysis
  ): Promise<ExtractionResult> {
    // For now, fall through to Tesseract AI mode
    // Full vision AI integration requires the Proph3t vision model
    return this.extractWithTesseractAI(rawText, analysis);
  }

  /**
   * Mode C: Extraction Tesseract + correction IA
   * Parse le texte OCR brut et structure les transactions
   */
  private async extractWithTesseractAI(
    rawText: string,
    analysis: OcrDocumentAnalysis
  ): Promise<ExtractionResult> {
    const lines = rawText.split('\n').filter(l => l.trim().length > 0);
    const rows: OcrExtractedRow[] = [];
    const dateRegex = /\d{2}[/.-]\d{2}[/.-]\d{4}/;

    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      if (!dateMatch) continue;

      const row = this.parseGenericLine(line, dateMatch);
      if (row) {
        rows.push(row);
      }
    }

    const metadata = this.extractGenericMetadata(lines, analysis);

    return {
      rows,
      metadata,
      mode: 'tesseract_ai',
      confidence: rows.length > 0 ? 0.5 : 0.2,
    };
  }

  /**
   * Parse une ligne generique de releve
   */
  private parseGenericLine(line: string, dateMatch: RegExpMatchArray): OcrExtractedRow | null {
    const date = dateMatch[0];
    const rest = line.slice(dateMatch.index! + date.length).trim();

    // Chercher une seconde date (date de valeur)
    const dateRegex = /\d{2}[/.-]\d{2}[/.-]\d{4}/;
    const vdMatch = rest.match(dateRegex);
    let valueDate: string | undefined;
    let afterDates: string;

    if (vdMatch && vdMatch.index! < 15) {
      valueDate = vdMatch[0];
      afterDates = rest.slice(vdMatch.index! + valueDate.length).trim();
    } else {
      afterDates = rest;
    }

    // Extraire montants (chercher les nombres a la fin)
    const amounts = this.extractAmounts(afterDates);
    if (!amounts.length) return null;

    // Le libelle est tout sauf les montants
    const lastAmountPos = afterDates.lastIndexOf(amounts[amounts.length - 1].raw);
    const firstAmountPos = afterDates.indexOf(amounts[0].raw);
    const description = afterDates.slice(0, firstAmountPos).trim();

    if (!description || description.length < 2) return null;

    // Interpreter les montants
    let debit: number | undefined;
    let credit: number | undefined;
    let balance: number | undefined;

    if (amounts.length === 1) {
      debit = amounts[0].value;
    } else if (amounts.length === 2) {
      debit = amounts[0].value || undefined;
      credit = amounts[1].value || undefined;
    } else if (amounts.length >= 3) {
      debit = amounts[0].value || undefined;
      credit = amounts[1].value || undefined;
      balance = amounts[2].value;
    }

    return {
      date,
      valueDate,
      description,
      debit,
      credit,
      balance,
      confidence: 0.5,
    };
  }

  /**
   * Extrait les nombres d'une ligne
   */
  private extractAmounts(text: string): Array<{ value: number; raw: string }> {
    const amountRegex = /(\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{1,2})?)/g;
    const results: Array<{ value: number; raw: string }> = [];

    let match;
    while ((match = amountRegex.exec(text)) !== null) {
      let numStr = match[1].replace(/\s/g, '');
      // Detect comma as decimal (French format)
      if (numStr.includes(',')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
      } else if (numStr.includes('.') && numStr.split('.').pop()!.length <= 2) {
        // Already in dot decimal format
      } else {
        numStr = numStr.replace(/\./g, '');
      }

      const value = parseFloat(numStr);
      if (!isNaN(value) && value > 0) {
        results.push({ value, raw: match[1] });
      }
    }

    return results;
  }

  /**
   * Extrait les metadonnees generiques
   */
  private extractGenericMetadata(lines: string[], analysis: OcrDocumentAnalysis): OcrStatementMetadata {
    const metadata: OcrStatementMetadata = {
      bankCode: analysis.bankCode || undefined,
      bankName: analysis.bankName || undefined,
      currency: 'XAF', // Default FCFA
    };

    for (const line of lines.slice(0, 20)) {
      // Detect currency
      if (/XOF|FCFA.*UEMOA|CFA.*OUEST/i.test(line)) {
        metadata.currency = 'XOF';
      } else if (/EUR/i.test(line)) {
        metadata.currency = 'EUR';
      }

      // Account number
      const accMatch = line.match(/(?:COMPTE|N°|ACCOUNT)\s*:?\s*(\d{5,}[\s-]?\d*)/i);
      if (accMatch) {
        metadata.accountNumber = accMatch[1].replace(/\s/g, '');
      }
    }

    return metadata;
  }
}
