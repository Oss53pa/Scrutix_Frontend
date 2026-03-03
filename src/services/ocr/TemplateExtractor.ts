// ============================================================================
// SCRUTIX - Template-Based Extractor
// Extraction basee sur les templates de releves bancaires
// ============================================================================

import type { OcrExtractedRow, OcrStatementMetadata } from './OcrPipelineTypes';

/**
 * Definition d'une zone de template (coordonnees en pourcentage)
 */
export interface ZoneDefinition {
  /** Nom de la zone */
  name: string;
  /** Type de donnee */
  type: 'date' | 'text' | 'amount' | 'balance' | 'reference';
  /** Position X en % (0-100) */
  x: number;
  /** Position Y en % (0-100) */
  y: number;
  /** Largeur en % */
  width: number;
  /** Hauteur en % */
  height: number;
}

/**
 * Template d'un releve bancaire
 */
export interface BankTemplateConfig {
  /** Code unique du template */
  code: string;
  /** Code banque associe */
  bankCode: string;
  /** Nom de la banque */
  bankName: string;
  /** Zones d'extraction des metadonnees */
  headerZones: ZoneDefinition[];
  /** Zones des colonnes du tableau */
  tableZones: {
    date: ZoneDefinition;
    valueDate?: ZoneDefinition;
    description: ZoneDefinition;
    debit: ZoneDefinition;
    credit: ZoneDefinition;
    balance?: ZoneDefinition;
    reference?: ZoneDefinition;
  };
  /** Zone du tableau (pour delimiter les lignes) */
  tableArea: { y: number; height: number };
  /** Format de date (ex: 'dd/MM/yyyy') */
  dateFormat: string;
  /** Separateur decimal */
  decimalSeparator: ',' | '.';
  /** Separateur de milliers */
  thousandsSeparator: '.' | ' ' | '';
  /** Devise */
  currency: string;
  /** Pattern regex pour detecter l'en-tete */
  headerPattern: RegExp;
}

/**
 * Extracteur basé sur les templates de releves bancaires
 * Utilise les zones predefinies pour cibler l'OCR
 */
export class TemplateExtractor {
  /**
   * Extrait les donnees d'un releve en utilisant un template
   */
  async extract(
    ocrText: string,
    template: BankTemplateConfig
  ): Promise<{
    rows: OcrExtractedRow[];
    metadata: OcrStatementMetadata;
    confidence: number;
  }> {
    const lines = ocrText.split('\n').filter(l => l.trim().length > 0);

    const metadata = this.extractMetadata(lines, template);
    const rows = this.extractRows(lines, template);
    const confidence = this.calculateConfidence(rows, metadata);

    return { rows, metadata, confidence };
  }

  /**
   * Extrait les metadonnees du releve
   */
  private extractMetadata(lines: string[], template: BankTemplateConfig): OcrStatementMetadata {
    const metadata: OcrStatementMetadata = {
      bankCode: template.bankCode,
      bankName: template.bankName,
      currency: template.currency,
    };

    // Chercher le numero de compte
    for (const line of lines.slice(0, 15)) {
      const accountMatch = line.match(/(?:COMPTE|ACCOUNT|N°)\s*:?\s*(\d{5,}[\s-]?\d*)/i);
      if (accountMatch) {
        metadata.accountNumber = accountMatch[1].replace(/\s/g, '');
      }

      // Chercher le titulaire
      const holderMatch = line.match(/(?:TITULAIRE|CLIENT|NOM)\s*:?\s*(.+)/i);
      if (holderMatch) {
        metadata.accountHolder = holderMatch[1].trim();
      }

      // Chercher les soldes
      const openingMatch = line.match(/(?:ANCIEN\s+SOLDE|SOLDE\s+INITIAL|OPENING)\s*:?\s*([\d\s.,]+)/i);
      if (openingMatch) {
        metadata.openingBalance = this.parseAmount(openingMatch[1], template);
      }

      const closingMatch = line.match(/(?:NOUVEAU\s+SOLDE|SOLDE\s+FINAL|CLOSING)\s*:?\s*([\d\s.,]+)/i);
      if (closingMatch) {
        metadata.closingBalance = this.parseAmount(closingMatch[1], template);
      }
    }

    return metadata;
  }

  /**
   * Extrait les lignes de transaction
   */
  private extractRows(lines: string[], template: BankTemplateConfig): OcrExtractedRow[] {
    const rows: OcrExtractedRow[] = [];
    const dateRegex = this.getDateRegex(template.dateFormat);

    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      if (!dateMatch) continue;

      const row = this.parseLine(line, dateMatch, template);
      if (row) {
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * Parse une ligne du releve
   */
  private parseLine(
    line: string,
    dateMatch: RegExpMatchArray,
    template: BankTemplateConfig
  ): OcrExtractedRow | null {
    const date = dateMatch[0];
    const afterDate = line.slice(dateMatch.index! + date.length).trim();

    // Chercher une seconde date (date de valeur)
    const dateRegex = this.getDateRegex(template.dateFormat);
    const valueDateMatch = afterDate.match(dateRegex);
    let description: string;
    let amountPart: string;

    if (valueDateMatch && valueDateMatch.index! < 15) {
      const valueDate = valueDateMatch[0];
      const afterValueDate = afterDate.slice(valueDateMatch.index! + valueDate.length).trim();
      description = this.extractDescription(afterValueDate);
      amountPart = afterValueDate.slice(description.length);

      return this.buildRow(date, valueDate, description, amountPart, template);
    }

    description = this.extractDescription(afterDate);
    amountPart = afterDate.slice(description.length);

    return this.buildRow(date, undefined, description, amountPart, template);
  }

  /**
   * Construit un OcrExtractedRow
   */
  private buildRow(
    date: string,
    valueDate: string | undefined,
    description: string,
    amountPart: string,
    template: BankTemplateConfig
  ): OcrExtractedRow | null {
    if (!description || description.length < 3) return null;

    // Extraire les montants
    const amounts = this.extractAmounts(amountPart, template);
    if (!amounts.debit && !amounts.credit) return null;

    return {
      date,
      valueDate,
      description: description.trim(),
      debit: amounts.debit,
      credit: amounts.credit,
      balance: amounts.balance,
      confidence: amounts.confidence,
    };
  }

  /**
   * Extrait le libelle du texte
   */
  private extractDescription(text: string): string {
    // Le libelle est tout le texte avant les montants
    const amountStart = text.search(/\d{1,3}([.\s]\d{3})*[,.]?\d{0,2}\s*$/);
    if (amountStart > 0) {
      return text.slice(0, amountStart).trim();
    }
    // Chercher le premier montant dans le texte
    const firstAmount = text.search(/\s\d{1,3}([.\s]\d{3})*[,.]\d{2}/);
    if (firstAmount > 5) {
      return text.slice(0, firstAmount).trim();
    }
    return text.trim();
  }

  /**
   * Extrait les montants d'une partie de texte
   */
  private extractAmounts(
    text: string,
    template: BankTemplateConfig
  ): { debit?: number; credit?: number; balance?: number; confidence: number } {
    const amountRegex = /(\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)/g;
    const matches: number[] = [];

    let match;
    while ((match = amountRegex.exec(text)) !== null) {
      const amount = this.parseAmount(match[1], template);
      if (amount > 0) {
        matches.push(amount);
      }
    }

    if (matches.length === 0) return { confidence: 0 };

    if (matches.length === 1) {
      // Determiner si c'est un debit ou credit par le contexte
      const isDebit = text.includes('D') || text.includes('-');
      return {
        debit: isDebit ? matches[0] : undefined,
        credit: !isDebit ? matches[0] : undefined,
        confidence: 0.6,
      };
    }

    if (matches.length === 2) {
      return {
        debit: matches[0] > 0 ? matches[0] : undefined,
        credit: matches[1] > 0 ? matches[1] : undefined,
        confidence: 0.7,
      };
    }

    // 3+ amounts: debit, credit, balance
    return {
      debit: matches[0] || undefined,
      credit: matches[1] || undefined,
      balance: matches[2],
      confidence: 0.8,
    };
  }

  /**
   * Parse un montant selon le format du template
   */
  private parseAmount(text: string, template: BankTemplateConfig): number {
    let cleaned = text.trim();

    // Retirer les espaces comme separateurs de milliers
    cleaned = cleaned.replace(/\s/g, '');

    // Gerer les separateurs
    if (template.decimalSeparator === ',') {
      cleaned = cleaned.replace(/\./g, ''); // Retirer le separateur de milliers
      cleaned = cleaned.replace(',', '.'); // Normaliser le separateur decimal
    } else {
      cleaned = cleaned.replace(/,/g, ''); // Retirer le separateur de milliers
    }

    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : Math.abs(value);
  }

  /**
   * Construit une regex de date a partir du format
   */
  private getDateRegex(format: string): RegExp {
    if (format === 'dd/MM/yyyy') {
      return /\d{2}\/\d{2}\/\d{4}/;
    }
    if (format === 'dd-MM-yyyy') {
      return /\d{2}-\d{2}-\d{4}/;
    }
    if (format === 'dd.MM.yyyy') {
      return /\d{2}\.\d{2}\.\d{4}/;
    }
    // Default: any date-like pattern
    return /\d{2}[/.-]\d{2}[/.-]\d{4}/;
  }

  /**
   * Calcule la confiance des resultats
   */
  private calculateConfidence(rows: OcrExtractedRow[], metadata: OcrStatementMetadata): number {
    let confidence = 0.3;

    if (rows.length > 0) confidence += 0.2;
    if (rows.length > 5) confidence += 0.1;
    if (metadata.accountNumber) confidence += 0.1;
    if (metadata.openingBalance !== undefined) confidence += 0.1;
    if (metadata.closingBalance !== undefined) confidence += 0.1;

    // Average row confidence
    if (rows.length > 0) {
      const avgRowConf = rows.reduce((sum, r) => sum + r.confidence, 0) / rows.length;
      confidence += avgRowConf * 0.1;
    }

    return Math.min(1, confidence);
  }
}
