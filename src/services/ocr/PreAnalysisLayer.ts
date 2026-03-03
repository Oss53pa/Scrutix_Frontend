// ============================================================================
// SCRUTIX - OCR Pre-Analysis Layer (Layer 1)
// Detection du type de document, banque, rotation, mode recommande
// ============================================================================

import type {
  OcrDocumentAnalysis,
  OcrDocumentType,
  OcrExtractionMode,
} from './OcrPipelineTypes';

/**
 * Patterns de detection des banques par texte d'en-tete
 */
const BANK_PATTERNS: Array<{
  pattern: RegExp;
  bankCode: string;
  bankName: string;
}> = [
  // Cote d'Ivoire
  { pattern: /SGBCI|SOCIETE\s+GENERALE.*?COTE\s+D.?IVOIRE/i, bankCode: 'SGBCI', bankName: 'Societe Generale CI' },
  { pattern: /BOA[\s-]*CI|BANK\s+OF\s+AFRICA.*?COTE\s+D.?IVOIRE/i, bankCode: 'BOA_CI', bankName: 'Bank of Africa CI' },
  { pattern: /ECOBANK.*?CI|ECOBANK.*?IVOIRE/i, bankCode: 'ECOBANK_CI', bankName: 'Ecobank CI' },
  { pattern: /NSIA\s+BANQUE/i, bankCode: 'NSIA', bankName: 'NSIA Banque' },
  { pattern: /BANQUE\s+ATLANTIQUE|ATLANTIQUE\s+CI/i, bankCode: 'ATLANTIQUE', bankName: 'Banque Atlantique' },
  // Cameroun
  { pattern: /AFRILAND\s+FIRST\s+BANK/i, bankCode: 'AFB', bankName: 'Afriland First Bank' },
  { pattern: /SGBC|SOCIETE\s+GENERALE.*?CAMEROUN/i, bankCode: 'SGBC', bankName: 'Societe Generale Cameroun' },
  { pattern: /BICEC|BANQUE\s+INT.*?CAMEROUN/i, bankCode: 'BICEC', bankName: 'BICEC' },
  { pattern: /SCB[\s-]*CAMEROUN|STANDARD\s+CHARTERED/i, bankCode: 'SCB', bankName: 'SCB Cameroun' },
  { pattern: /UBA\s+CAMEROUN|UNITED\s+BANK.*?AFRICA/i, bankCode: 'UBA', bankName: 'UBA Cameroun' },
  // Generic
  { pattern: /ECOBANK/i, bankCode: 'ECOBANK', bankName: 'Ecobank' },
  { pattern: /BOA|BANK\s+OF\s+AFRICA/i, bankCode: 'BOA', bankName: 'Bank of Africa' },
  { pattern: /BGFI\s*BANK/i, bankCode: 'BGFI', bankName: 'BGFI Bank' },
  { pattern: /CORIS\s+BANK/i, bankCode: 'CORIS', bankName: 'Coris Bank' },
];

/**
 * Patterns de detection du type de document
 */
const DOC_TYPE_PATTERNS: Array<{
  pattern: RegExp;
  type: OcrDocumentType;
  weight: number;
}> = [
  { pattern: /RELEVE\s+(DE\s+)?COMPTE|EXTRAIT\s+DE\s+COMPTE|STATEMENT/i, type: 'bank_statement', weight: 10 },
  { pattern: /SOLDE\s+(ANCIEN|NOUVEAU|INITIAL|FINAL)|ANCIEN\s+SOLDE/i, type: 'bank_statement', weight: 8 },
  { pattern: /DEBIT|CREDIT|SOLDE|BALANCE/i, type: 'bank_statement', weight: 3 },
  { pattern: /CHEQUE|CHEQUIER/i, type: 'check', weight: 8 },
  { pattern: /FACTURE|INVOICE/i, type: 'invoice', weight: 8 },
  { pattern: /RECU|RECEIPT|QUITTANCE/i, type: 'receipt', weight: 8 },
];

/**
 * Layer 1: Pre-analyse du document
 * Detecte le type, la banque, la rotation, et recommande un mode d'extraction
 */
export class PreAnalysisLayer {
  /**
   * Analyse un document a partir du texte OCR brut
   */
  analyze(rawText: string, wordBboxes?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>): OcrDocumentAnalysis {
    const docType = this.detectDocType(rawText);
    const bank = this.detectBank(rawText);
    const rotation = this.estimateRotation(wordBboxes);
    const contrast = this.estimateContrast(rawText);

    // Determine recommended extraction mode
    let recommendedMode: OcrExtractionMode = 'tesseract_ai';
    let templateCode: string | null = null;

    if (bank.code) {
      // Try template matching
      templateCode = this.getTemplateCode(bank.code);
      if (templateCode) {
        recommendedMode = 'template';
      }
    }

    // If no template, prefer vision AI when available
    if (recommendedMode === 'tesseract_ai' && docType === 'bank_statement') {
      recommendedMode = 'vision_ai';
    }

    const confidence = this.calculateConfidence(docType, bank.code, rawText);

    return {
      docType,
      rotation,
      contrast,
      bankCode: bank.code,
      bankName: bank.name,
      recommendedMode,
      confidence,
      templateCode,
    };
  }

  /**
   * Detecte le type de document
   */
  private detectDocType(text: string): OcrDocumentType {
    const scores = new Map<OcrDocumentType, number>();

    for (const { pattern, type, weight } of DOC_TYPE_PATTERNS) {
      if (pattern.test(text)) {
        scores.set(type, (scores.get(type) || 0) + weight);
      }
    }

    if (scores.size === 0) return 'unknown';

    let bestType: OcrDocumentType = 'unknown';
    let bestScore = 0;

    for (const [type, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }

  /**
   * Detecte la banque
   */
  private detectBank(text: string): { code: string | null; name: string | null } {
    for (const { pattern, bankCode, bankName } of BANK_PATTERNS) {
      if (pattern.test(text)) {
        return { code: bankCode, name: bankName };
      }
    }
    return { code: null, name: null };
  }

  /**
   * Estime la rotation via les bounding boxes des mots
   */
  private estimateRotation(
    wordBboxes?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>
  ): number {
    if (!wordBboxes || wordBboxes.length < 5) return 0;

    // Simple heuristique: si la plupart des mots sont plus hauts que larges, c'est tourne
    let horizontalCount = 0;
    let verticalCount = 0;

    for (const { bbox } of wordBboxes.slice(0, 20)) {
      const width = bbox.x1 - bbox.x0;
      const height = bbox.y1 - bbox.y0;
      if (width > height * 1.5) {
        horizontalCount++;
      } else if (height > width * 1.5) {
        verticalCount++;
      }
    }

    if (verticalCount > horizontalCount * 2) {
      return 90;
    }

    return 0;
  }

  /**
   * Estime la qualite du contraste
   */
  private estimateContrast(text: string): number {
    if (!text || text.length === 0) return 0;

    // Heuristique: ratio de caracteres reconnus vs caracteres speciaux/garbage
    const alphanumeric = (text.match(/[a-zA-Z0-9]/g) || []).length;
    const total = text.length;

    return Math.min(1, alphanumeric / (total * 0.5));
  }

  /**
   * Calcule la confiance globale de la pre-analyse
   */
  private calculateConfidence(docType: OcrDocumentType, bankCode: string | null, text: string): number {
    let confidence = 0.3; // Base

    if (docType !== 'unknown') confidence += 0.3;
    if (bankCode) confidence += 0.2;
    if (text.length > 200) confidence += 0.1;
    if (text.length > 1000) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * Retourne le code du template pour une banque
   */
  private getTemplateCode(bankCode: string): string | null {
    // Will be enhanced by Sprint 5 template registry
    const templateMap: Record<string, string> = {
      'SGBCI': 'sgbci',
      'BOA_CI': 'boa-ci',
      'ECOBANK_CI': 'ecobank-ci',
      'NSIA': 'nsia',
      'ATLANTIQUE': 'atlantique',
    };
    return templateMap[bankCode] || null;
  }
}
