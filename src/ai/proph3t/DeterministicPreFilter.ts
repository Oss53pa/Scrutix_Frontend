// ============================================================================
// SCRUTIX - Deterministic Pre-Filter (Bank Label Dictionary)
// Filtre deterministe regex pour categorisation sans IA
// Couvre 60-80% des transactions bancaires CEMAC/UEMOA typiques
// ============================================================================

import { TransactionType, Transaction } from '../../types';
import type { AICategoryResult } from '../types';

interface PatternEntry {
  /** Regex pattern (applique sur description normalisee) */
  pattern: RegExp;
  /** Categorie assignee */
  category: string;
  /** Type de transaction */
  type: TransactionType;
  /** Confiance (0.85-0.98 pour patterns deterministes) */
  confidence: number;
}

/**
 * Dictionnaire de patterns pour labels bancaires CEMAC/UEMOA
 * Les descriptions sont normalisees (uppercase, sans accents) avant matching
 */
const BANK_LABEL_DICTIONARY: PatternEntry[] = [
  // === FRAIS DE TENUE DE COMPTE ===
  { pattern: /FRAIS?\s*(DE\s*)?(TENUE|TEN)\s*(DE\s*)?COMPTE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.98 },
  { pattern: /\bTDC\b/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.95 },
  { pattern: /FRAIS?\s*GESTION\s*COMPTE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.96 },
  { pattern: /COTIS(ATION)?\s*COMPTE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.94 },

  // === COMMISSIONS DE MOUVEMENT ===
  { pattern: /COM(MISSION)?S?\s*(DE\s*)?MOUVEMENT/i, category: 'Commissions', type: TransactionType.FEE, confidence: 0.97 },
  { pattern: /COM\s*MVT/i, category: 'Commissions', type: TransactionType.FEE, confidence: 0.95 },
  { pattern: /COM(MISSION)?S?\s*PLUS\s*FORT\s*DECOUVERT/i, category: 'Commissions', type: TransactionType.FEE, confidence: 0.96 },
  { pattern: /CPFD/i, category: 'Commissions', type: TransactionType.FEE, confidence: 0.90 },

  // === AGIOS / INTERETS ===
  { pattern: /AGIOS?/i, category: 'Agios/Interets', type: TransactionType.INTEREST, confidence: 0.97 },
  { pattern: /INTER[EE]TS?\s*(DEBIT|DEB)/i, category: 'Agios/Interets', type: TransactionType.INTEREST, confidence: 0.96 },
  { pattern: /INTER[EE]TS?\s*(CREDIT|CRED)/i, category: 'Agios/Interets', type: TransactionType.INTEREST, confidence: 0.96 },
  { pattern: /INT\s*DEB/i, category: 'Agios/Interets', type: TransactionType.INTEREST, confidence: 0.93 },
  { pattern: /PENALITE\s*DECOUVERT/i, category: 'Agios/Interets', type: TransactionType.INTEREST, confidence: 0.95 },

  // === VIREMENTS ===
  { pattern: /VIR(EMENT)?\s*(RECU|REC|RECEP)/i, category: 'Virement entrant', type: TransactionType.TRANSFER, confidence: 0.96 },
  { pattern: /VIR(EMENT)?\s*(EMIS|EMIT|SORTANT)/i, category: 'Virement sortant', type: TransactionType.TRANSFER, confidence: 0.96 },
  { pattern: /VIR(EMENT)?\s*PERMANENT/i, category: 'Virement sortant', type: TransactionType.TRANSFER, confidence: 0.95 },
  { pattern: /VIR(EMENT)?\s*INTERNE/i, category: 'Virement interne', type: TransactionType.TRANSFER, confidence: 0.95 },
  { pattern: /VIR(EMENT)?\s*(NAT|NATIONAL)/i, category: 'Virement sortant', type: TransactionType.TRANSFER, confidence: 0.94 },
  { pattern: /VIR(EMENT)?\s*(INT(ERN)?|INTERNATIONAL)/i, category: 'Virement international', type: TransactionType.TRANSFER, confidence: 0.94 },
  { pattern: /\bORDRE\s*VIR/i, category: 'Virement sortant', type: TransactionType.TRANSFER, confidence: 0.93 },

  // === DAB / GAB (Retraits) ===
  { pattern: /RETRAIT\s*(DAB|GAB|DISTRIBUTEUR)/i, category: 'Retrait DAB', type: TransactionType.ATM, confidence: 0.98 },
  { pattern: /\bDAB\b/i, category: 'Retrait DAB', type: TransactionType.ATM, confidence: 0.92 },
  { pattern: /\bGAB\b/i, category: 'Retrait DAB', type: TransactionType.ATM, confidence: 0.92 },
  { pattern: /RETRAIT\s*ESPECES/i, category: 'Retrait especes', type: TransactionType.ATM, confidence: 0.95 },
  { pattern: /VERSEMENT\s*ESPECES/i, category: 'Versement especes', type: TransactionType.CREDIT, confidence: 0.95 },

  // === CARTES BANCAIRES ===
  { pattern: /\bCB\b.*PAIEMENT/i, category: 'Carte bancaire', type: TransactionType.CARD, confidence: 0.95 },
  { pattern: /PAIEMENT\s*(PAR\s*)?CARTE/i, category: 'Carte bancaire', type: TransactionType.CARD, confidence: 0.96 },
  { pattern: /FRAIS?\s*(DE\s*)?CARTE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.95 },
  { pattern: /COTIS(ATION)?\s*CARTE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.95 },
  { pattern: /RENOUVELLEMENT\s*CARTE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.94 },
  { pattern: /ASSURANCE\s*CARTE/i, category: 'Assurances', type: TransactionType.FEE, confidence: 0.93 },

  // === CHEQUES ===
  { pattern: /REMISE?\s*(DE\s*)?CHEQUE/i, category: 'Cheques', type: TransactionType.CHECK, confidence: 0.96 },
  { pattern: /ENCAISSEMENT\s*CHEQUE/i, category: 'Cheques', type: TransactionType.CHECK, confidence: 0.96 },
  { pattern: /EMISSION\s*CHEQUE/i, category: 'Cheques', type: TransactionType.CHECK, confidence: 0.95 },
  { pattern: /CHQ\s*\d+/i, category: 'Cheques', type: TransactionType.CHECK, confidence: 0.94 },
  { pattern: /CHEQUE\s*(CERTIFIE|BANQUE)/i, category: 'Cheques', type: TransactionType.CHECK, confidence: 0.95 },
  { pattern: /FRAIS?\s*(DE\s*)?CHEQUE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.94 },

  // === SWIFT / INTERNATIONAL ===
  { pattern: /\bSWIFT\b/i, category: 'Operations internationales', type: TransactionType.TRANSFER, confidence: 0.95 },
  { pattern: /COM(MISSION)?S?\s*SWIFT/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.96 },
  { pattern: /FRAIS?\s*SWIFT/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.96 },
  { pattern: /TRANSFERT?\s*INTERNATIONAL/i, category: 'Operations internationales', type: TransactionType.TRANSFER, confidence: 0.95 },
  { pattern: /FRAIS?\s*(DE\s*)?CHANGE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.93 },
  { pattern: /COMMISSION\s*DE\s*CHANGE/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.94 },

  // === TAXES ET IMPOTS ===
  { pattern: /\bTVA\b/i, category: 'Impots/Taxes', type: TransactionType.DEBIT, confidence: 0.93 },
  { pattern: /TAXE\s*SUR\s*FRAIS/i, category: 'Impots/Taxes', type: TransactionType.FEE, confidence: 0.95 },
  { pattern: /\bTSF\b/i, category: 'Impots/Taxes', type: TransactionType.FEE, confidence: 0.90 },
  { pattern: /IMPOT|FISC(AL)?/i, category: 'Impots/Taxes', type: TransactionType.DEBIT, confidence: 0.92 },
  { pattern: /PRLVT?\s*(OBLIG|FISC)/i, category: 'Impots/Taxes', type: TransactionType.DEBIT, confidence: 0.93 },

  // === SALAIRES ===
  { pattern: /SALAIRE|PAIE\b/i, category: 'Salaires', type: TransactionType.CREDIT, confidence: 0.96 },
  { pattern: /VIR\s*(RECU\s*)?SALAIRE/i, category: 'Salaires', type: TransactionType.CREDIT, confidence: 0.97 },
  { pattern: /REMUNERATION/i, category: 'Salaires', type: TransactionType.CREDIT, confidence: 0.93 },

  // === PRELEVEMENTS ===
  { pattern: /PRLVT?|PRELEVEMENT/i, category: 'Prelevements', type: TransactionType.DEBIT, confidence: 0.90 },

  // === MOBILE MONEY ===
  { pattern: /MOBILE\s*MONEY|MOMO/i, category: 'Mobile Money', type: TransactionType.TRANSFER, confidence: 0.95 },
  { pattern: /MTN\s*MONEY|MTN\s*MOMO/i, category: 'Mobile Money', type: TransactionType.TRANSFER, confidence: 0.96 },
  { pattern: /ORANGE\s*MONEY|OM\b/i, category: 'Mobile Money', type: TransactionType.TRANSFER, confidence: 0.94 },

  // === TELECOM ===
  { pattern: /ORANGE|MTN|CAMTEL|NEXTTEL/i, category: 'Telecom', type: TransactionType.DEBIT, confidence: 0.88 },

  // === ASSURANCES ===
  { pattern: /ASSURANCE|PRIME\s*ASS/i, category: 'Assurances', type: TransactionType.DEBIT, confidence: 0.93 },

  // === LOYER ===
  { pattern: /LOYER|BAIL\b/i, category: 'Loyer', type: TransactionType.DEBIT, confidence: 0.92 },

  // === DIVERS FRAIS BANCAIRES ===
  { pattern: /FRAIS?\s*(DIVERS|DIV)\b/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.85 },
  { pattern: /COM(MISSION)?S?\s*(DIVERSE?S?|DIV)\b/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.85 },
  { pattern: /FRAIS?\s*DOSSIER/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.93 },
  { pattern: /FRAIS?\s*(D'?)?ABONNEMENT/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.93 },
  { pattern: /FRAIS?\s*(DE\s*)?(E-?BANKING|INTERNET\s*BANKING)/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.95 },
  { pattern: /FRAIS?\s*SMS|ALERTE\s*SMS/i, category: 'Frais bancaires', type: TransactionType.FEE, confidence: 0.95 },
];

/**
 * Normalise une description pour le matching
 * Uppercase, supprime les accents, normalise les espaces
 */
function normalizeDescription(desc: string): string {
  return desc
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filtre deterministe pour pre-categoriser les transactions bancaires
 * sans appel IA, base sur un dictionnaire de patterns regex
 */
export class DeterministicPreFilter {
  private patterns: PatternEntry[];

  constructor(customPatterns?: PatternEntry[]) {
    this.patterns = [...BANK_LABEL_DICTIONARY, ...(customPatterns || [])];
  }

  /**
   * Filtre les transactions: separe celles categorisables par regex
   * des celles necessitant l'IA
   */
  filter(transactions: Transaction[]): {
    categorized: AICategoryResult[];
    uncategorized: Transaction[];
  } {
    const categorized: AICategoryResult[] = [];
    const uncategorized: Transaction[] = [];

    for (const tx of transactions) {
      const normalized = normalizeDescription(tx.description);
      const match = this.findMatch(normalized);

      if (match) {
        categorized.push({
          transactionId: tx.id,
          category: match.category,
          confidence: match.confidence,
          type: match.type,
        });
      } else {
        uncategorized.push(tx);
      }
    }

    return { categorized, uncategorized };
  }

  /**
   * Categorise une seule description
   */
  categorize(description: string): { category: string; type: TransactionType; confidence: number } | null {
    const normalized = normalizeDescription(description);
    return this.findMatch(normalized);
  }

  /**
   * Ajoute des patterns personnalises
   */
  addPatterns(patterns: PatternEntry[]): void {
    this.patterns.push(...patterns);
  }

  /**
   * Retourne les statistiques du dictionnaire
   */
  getPatternCount(): number {
    return this.patterns.length;
  }

  private findMatch(normalized: string): { category: string; type: TransactionType; confidence: number } | null {
    for (const entry of this.patterns) {
      if (entry.pattern.test(normalized)) {
        return {
          category: entry.category,
          type: entry.type,
          confidence: entry.confidence,
        };
      }
    }
    return null;
  }
}
