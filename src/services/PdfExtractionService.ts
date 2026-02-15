import * as pdfjsLib from 'pdfjs-dist';
import type {
  BankConditions,
  AccountFees,
  CardFees,
  TransferFees,
  CheckFees,
  CreditFees,
  MiscFees,
  PenaltyFees,
} from '../types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractionResult {
  success: boolean;
  extractedData?: Partial<BankConditions>;
  rawText?: string;
  pages?: number;
  error?: string;
  confidence: number;
}

interface _ExtractedAmount {
  value: number;
  text: string;
  context: string;
}

/**
 * Service d'extraction de conditions bancaires depuis des fichiers PDF
 * Utilise PDF.js pour l'extraction de texte et des regex pour l'analyse
 */
export class PdfExtractionService {

  /**
   * Extrait le texte d'un fichier PDF
   */
  async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText;
  }

  /**
   * Extrait le texte d'un PDF en base64
   */
  async extractTextFromBase64(base64Data: string): Promise<string> {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:application\/pdf;base64,/, '');
    const binaryString = atob(base64Clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText;
  }

  /**
   * Analyse le texte extrait et retourne les conditions bancaires
   */
  analyzeText(text: string): ExtractionResult {
    try {
      const normalizedText = this.normalizeText(text);

      // Extract different fee categories
      const accountFees = this.extractAccountFees(normalizedText);
      const cardFees = this.extractCardFees(normalizedText);
      const transferFees = this.extractTransferFees(normalizedText);
      const checkFees = this.extractCheckFees(normalizedText);
      const creditFees = this.extractCreditFees(normalizedText);
      const miscFees = this.extractMiscFees(normalizedText);
      const penalties = this.extractPenalties(normalizedText);

      // Calculate confidence based on how many fields were found
      const confidence = this.calculateConfidence(accountFees, cardFees, transferFees, checkFees, creditFees);

      return {
        success: true,
        extractedData: {
          accountFees,
          cardFees,
          transferFees,
          checkFees,
          creditFees,
          miscFees,
          penalties,
        },
        rawText: text,
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'extraction',
        confidence: 0,
      };
    }
  }

  /**
   * Extraction complète depuis un fichier
   */
  async extractFromFile(file: File): Promise<ExtractionResult> {
    try {
      const text = await this.extractTextFromPdf(file);
      const result = this.analyzeText(text);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'extraction du PDF',
        confidence: 0,
      };
    }
  }

  /**
   * Extraction depuis un PDF en base64
   */
  async extractFromBase64(base64Data: string): Promise<ExtractionResult> {
    try {
      const text = await this.extractTextFromBase64(base64Data);
      const result = this.analyzeText(text);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'extraction du PDF',
        confidence: 0,
      };
    }
  }

  // === PRIVATE METHODS ===

  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/(\d)\s+(\d)/g, '$1$2') // Join split numbers
      .replace(/FCFA|F\s*CFA|XAF|XOF/gi, 'FCFA')
      .trim();
  }

  private extractAmount(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Extract number, remove spaces and convert
        const numStr = match[1] || match[0];
        const cleaned = numStr.replace(/[^\d,.]/g, '').replace(',', '.');
        const value = parseFloat(cleaned);
        if (!isNaN(value)) {
          return value;
        }
      }
    }
    return null;
  }

  private extractPercentage(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const numStr = match[1] || match[0];
        const cleaned = numStr.replace(/[^\d,.]/g, '').replace(',', '.');
        const value = parseFloat(cleaned);
        if (!isNaN(value)) {
          return value;
        }
      }
    }
    return null;
  }

  private extractAccountFees(text: string): AccountFees {
    // Patterns for account fees in African bank documents
    const tenueCompteParticulier = this.extractAmount(text, [
      /tenue\s*(?:de\s*)?compte.*?particulier[^\d]*(\d[\d\s]*)/i,
      /frais\s*(?:de\s*)?tenue.*?particulier[^\d]*(\d[\d\s]*)/i,
      /particulier[^\d]*tenue[^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    const tenueComptePro = this.extractAmount(text, [
      /tenue\s*(?:de\s*)?compte.*?professionnel[^\d]*(\d[\d\s]*)/i,
      /frais\s*(?:de\s*)?tenue.*?professionnel[^\d]*(\d[\d\s]*)/i,
      /professionnel[^\d]*tenue[^\d]*(\d[\d\s]*)/i,
    ]) || 10000;

    const tenueCompteEntreprise = this.extractAmount(text, [
      /tenue\s*(?:de\s*)?compte.*?entreprise[^\d]*(\d[\d\s]*)/i,
      /frais\s*(?:de\s*)?tenue.*?entreprise[^\d]*(\d[\d\s]*)/i,
      /entreprise[^\d]*tenue[^\d]*(\d[\d\s]*)/i,
      /personne\s*morale[^\d]*(\d[\d\s]*)/i,
    ]) || 25000;

    const releveCompte = this.extractAmount(text, [
      /relev[eé]\s*(?:de\s*)?compte[^\d]*(\d[\d\s]*)/i,
      /envoi\s*relev[eé][^\d]*(\d[\d\s]*)/i,
    ]) || 1000;

    const duplicataReleve = this.extractAmount(text, [
      /duplicata[^\d]*relev[eé][^\d]*(\d[\d\s]*)/i,
      /relev[eé].*?duplicata[^\d]*(\d[\d\s]*)/i,
    ]) || 2500;

    const attestationSolde = this.extractAmount(text, [
      /attestation\s*(?:de\s*)?solde[^\d]*(\d[\d\s]*)/i,
      /certificat.*?solde[^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    const fraisCloture = this.extractAmount(text, [
      /cl[oô]ture\s*(?:de\s*)?compte[^\d]*(\d[\d\s]*)/i,
      /frais\s*(?:de\s*)?cl[oô]ture[^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    const fraisInactivite = this.extractAmount(text, [
      /inactivit[eé][^\d]*(\d[\d\s]*)/i,
      /compte\s*dormant[^\d]*(\d[\d\s]*)/i,
      /compte\s*inactif[^\d]*(\d[\d\s]*)/i,
    ]) || 10000;

    const lettreInjonction = this.extractAmount(text, [
      /lettre\s*(?:d['´])?injonction[^\d]*(\d[\d\s]*)/i,
      /mise\s*en\s*demeure[^\d]*(\d[\d\s]*)/i,
    ]) || 15000;

    return {
      tenueCompte: {
        particulier: tenueCompteParticulier,
        professionnel: tenueComptePro,
        entreprise: tenueCompteEntreprise,
      },
      fraisOuverture: 0,
      fraisCloture,
      fraisInactivite,
      releveCompte: {
        mensuel: releveCompte,
        duplicata: duplicataReleve,
      },
      attestationSolde,
      lettreInjonction,
      droitTimbre: 0,
    };
  }

  private extractCardFees(text: string): CardFees {
    const visaClassic = this.extractAmount(text, [
      /visa\s*classic[^\d]*(\d[\d\s]*)/i,
      /carte\s*classic[^\d]*(\d[\d\s]*)/i,
    ]) || 25000;

    const visaGold = this.extractAmount(text, [
      /visa\s*gold[^\d]*(\d[\d\s]*)/i,
      /carte\s*gold[^\d]*(\d[\d\s]*)/i,
      /visa\s*premier[^\d]*(\d[\d\s]*)/i,
    ]) || 75000;

    const visaPlatinum = this.extractAmount(text, [
      /visa\s*platinum[^\d]*(\d[\d\s]*)/i,
      /carte\s*platinum[^\d]*(\d[\d\s]*)/i,
      /visa\s*infinite[^\d]*(\d[\d\s]*)/i,
    ]) || 150000;

    const gimac = this.extractAmount(text, [
      /gimac[^\d]*(\d[\d\s]*)/i,
      /gim[- ]?uemoa[^\d]*(\d[\d\s]*)/i,
      /carte\s*r[eé]gionale[^\d]*(\d[\d\s]*)/i,
    ]) || 10000;

    const opposition = this.extractAmount(text, [
      /opposition\s*(?:sur\s*)?carte[^\d]*(\d[\d\s]*)/i,
      /perte\s*(?:de\s*)?carte[^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    const renouvellement = this.extractAmount(text, [
      /renouvellement\s*anticip[eé][^\d]*(\d[\d\s]*)/i,
      /remplacement\s*carte[^\d]*(\d[\d\s]*)/i,
    ]) || 10000;

    const codePinOublie = this.extractAmount(text, [
      /code\s*pin[^\d]*(\d[\d\s]*)/i,
      /code\s*secret[^\d]*(\d[\d\s]*)/i,
      /r[eé]initialisation\s*pin[^\d]*(\d[\d\s]*)/i,
    ]) || 2500;

    const retraitDabAutre = this.extractAmount(text, [
      /retrait\s*(?:dab|gab).*?autre\s*banque[^\d]*(\d[\d\s]*)/i,
      /retrait\s*d[eé]plac[eé][^\d]*(\d[\d\s]*)/i,
      /retrait\s*hors\s*r[eé]seau[^\d]*(\d[\d\s]*)/i,
    ]) || 1500;

    return {
      cartes: [
        { nom: 'Carte VISA Classic', type: 'debit', reseau: 'VISA', cotisationAnnuelle: visaClassic, plafondRetrait: 500000, plafondPaiement: 1000000, validite: 3 },
        { nom: 'Carte VISA Gold', type: 'debit', reseau: 'VISA', cotisationAnnuelle: visaGold, plafondRetrait: 1000000, plafondPaiement: 3000000, validite: 3 },
        { nom: 'Carte VISA Platinum', type: 'credit', reseau: 'VISA', cotisationAnnuelle: visaPlatinum, plafondRetrait: 2000000, plafondPaiement: 5000000, validite: 3 },
        { nom: 'Carte GIMAC/GIM-UEMOA', type: 'debit', reseau: 'GIMAC', cotisationAnnuelle: gimac, plafondRetrait: 300000, plafondPaiement: 500000, validite: 2 },
      ],
      oppositionCarte: opposition,
      renouvellementAnticipe: renouvellement,
      codePinOublie: codePinOublie,
      retraitDabAutreBanque: retraitDabAutre,
      paiementTpe: 0,
      consultationSolde: 200,
    };
  }

  private extractTransferFees(text: string): TransferFees {
    const virementCemac = this.extractPercentage(text, [
      /virement\s*(?:cemac|beac|zone)[^\d]*(\d[\d,.]*)\s*%/i,
      /transfert\s*r[eé]gional[^\d]*(\d[\d,.]*)\s*%/i,
    ]) || 0.5;

    const virementCemacMin = this.extractAmount(text, [
      /virement\s*(?:cemac|beac).*?minimum[^\d]*(\d[\d\s]*)/i,
      /minimum.*?virement\s*(?:cemac|beac)[^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    const virementInternational = this.extractPercentage(text, [
      /virement\s*international[^\d]*(\d[\d,.]*)\s*%/i,
      /transfert\s*international[^\d]*(\d[\d,.]*)\s*%/i,
      /virement\s*[eé]tranger[^\d]*(\d[\d,.]*)\s*%/i,
    ]) || 1;

    const virementIntMin = this.extractAmount(text, [
      /virement\s*international.*?minimum[^\d]*(\d[\d\s]*)/i,
      /minimum.*?virement\s*international[^\d]*(\d[\d\s]*)/i,
    ]) || 15000;

    const swift = this.extractAmount(text, [
      /swift[^\d]*(\d[\d\s]*)/i,
      /frais\s*swift[^\d]*(\d[\d\s]*)/i,
    ]) || 25000;

    const virementInstantane = this.extractAmount(text, [
      /virement\s*instantan[eé][^\d]*(\d[\d\s]*)/i,
      /transfert\s*instantan[eé][^\d]*(\d[\d\s]*)/i,
    ]) || 500;

    const ordreVirementPermanent = this.extractAmount(text, [
      /virement\s*permanent[^\d]*(\d[\d\s]*)/i,
      /ordre\s*permanent[^\d]*(\d[\d\s]*)/i,
    ]) || 2500;

    const rejetVirement = this.extractAmount(text, [
      /rejet\s*(?:de\s*)?virement[^\d]*(\d[\d\s]*)/i,
      /virement\s*rejet[eé][^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    return {
      virementInterne: { commission: 0, minimum: 0, maximum: 0 },
      virementCemacUemoa: { commission: virementCemac, minimum: virementCemacMin, swift: 10000 },
      virementInternational: { commission: virementInternational, minimum: virementIntMin, swift, fraisCorrespondant: 30000 },
      virementInstantane,
      ordreVirementPermanent,
      rejetVirement,
    };
  }

  private extractCheckFees(text: string): CheckFees {
    const carnet25 = this.extractAmount(text, [
      /carnet.*?25\s*feuilles[^\d]*(\d[\d\s]*)/i,
      /ch[eè]quier.*?25[^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    const carnet50 = this.extractAmount(text, [
      /carnet.*?50\s*feuilles[^\d]*(\d[\d\s]*)/i,
      /ch[eè]quier.*?50[^\d]*(\d[\d\s]*)/i,
    ]) || 8000;

    const chequeGuichet = this.extractAmount(text, [
      /ch[eè]que\s*(?:de\s*)?guichet[^\d]*(\d[\d\s]*)/i,
    ]) || 500;

    const chequeCertifie = this.extractAmount(text, [
      /ch[eè]que\s*certifi[eé][^\d]*(\d[\d\s]*)/i,
      /certification\s*ch[eè]que[^\d]*(\d[\d\s]*)/i,
    ]) || 5000;

    const oppositionCheque = this.extractAmount(text, [
      /opposition\s*(?:sur\s*)?ch[eè]que[^\d]*(\d[\d\s]*)/i,
    ]) || 10000;

    const chequeImpaye = this.extractAmount(text, [
      /ch[eè]que\s*impay[eé][^\d]*(\d[\d\s]*)/i,
      /impay[eé]\s*ch[eè]que[^\d]*(\d[\d\s]*)/i,
    ]) || 25000;

    const chequeRetourne = this.extractAmount(text, [
      /ch[eè]que\s*retourn[eé][^\d]*(\d[\d\s]*)/i,
      /retour\s*ch[eè]que[^\d]*(\d[\d\s]*)/i,
    ]) || 15000;

    return {
      carnetCheques: { feuilles25: carnet25, feuilles50: carnet50 },
      chequeGuichet,
      chequeCertifie,
      oppositionCheque,
      chequeImpaye,
      chequeRetourne,
      encaissementChequePlace: 0,
      encaissementChequeDeplacement: 2500,
      certificationCheque: chequeCertifie,
    };
  }

  private extractCreditFees(text: string): CreditFees {
    const tauxDecouvertAutorise = this.extractPercentage(text, [
      /d[eé]couvert\s*autoris[eé][^\d]*(\d[\d,.]*)\s*%/i,
      /taux\s*d[eé]biteur\s*autoris[eé][^\d]*(\d[\d,.]*)\s*%/i,
    ]) || 14.5;

    const tauxDecouvertNonAutorise = this.extractPercentage(text, [
      /d[eé]couvert\s*non\s*autoris[eé][^\d]*(\d[\d,.]*)\s*%/i,
      /d[eé]couvert\s*d[eé]pass[eé][^\d]*(\d[\d,.]*)\s*%/i,
      /taux\s*d[eé]biteur\s*non\s*autoris[eé][^\d]*(\d[\d,.]*)\s*%/i,
    ]) || 18;

    const commissionMouvement = this.extractPercentage(text, [
      /commission\s*(?:de\s*)?mouvement[^\d]*(\d[\d,.]*)\s*%/i,
    ]) || 0.025;

    const commissionPlusForte = this.extractPercentage(text, [
      /plus\s*forte\s*d[eé]couverte[^\d]*(\d[\d,.]*)\s*%/i,
      /commission\s*(?:de\s*)?plus\s*fort[^\d]*(\d[\d,.]*)\s*%/i,
    ]) || 0.05;

    const tauxUsure = this.extractPercentage(text, [
      /taux\s*(?:d['´])?usure[^\d]*(\d[\d,.]*)\s*%/i,
    ]) || 27;

    const tauxCreditConsommationMin = this.extractPercentage(text, [
      /cr[eé]dit\s*consommation.*?(\d[\d,.]*)\s*%/i,
    ]) || 12;

    const tauxCreditImmobilierMin = this.extractPercentage(text, [
      /cr[eé]dit\s*immobilier.*?(\d[\d,.]*)\s*%/i,
      /pr[eê]t\s*immobilier.*?(\d[\d,.]*)\s*%/i,
    ]) || 8;

    return {
      decouvertAutorise: {
        tauxAnnuel: tauxDecouvertAutorise,
        commissionMouvement,
        commissionPlusForte,
      },
      decouvertNonAutorise: {
        tauxAnnuel: tauxDecouvertNonAutorise,
        penalite: 0.5,
      },
      creditConsommation: {
        tauxMin: tauxCreditConsommationMin,
        tauxMax: tauxCreditConsommationMin + 6,
        fraisDossier: 1,
      },
      creditImmobilier: {
        tauxMin: tauxCreditImmobilierMin,
        tauxMax: tauxCreditImmobilierMin + 4,
        fraisDossier: 0.5,
      },
      tauxUsure,
    };
  }

  private extractMiscFees(text: string): MiscFees {
    const smsAlerte = this.extractAmount(text, [
      /sms\s*(?:alerte)?[^\d]*(\d[\d\s]*)/i,
      /alerte\s*sms[^\d]*(\d[\d\s]*)/i,
    ]) || 500;

    const coffrePetit = this.extractAmount(text, [
      /coffre.*?petit[^\d]*(\d[\d\s]*)/i,
      /petit\s*coffre[^\d]*(\d[\d\s]*)/i,
    ]) || 50000;

    const coffreMoyen = this.extractAmount(text, [
      /coffre.*?moyen[^\d]*(\d[\d\s]*)/i,
      /moyen\s*coffre[^\d]*(\d[\d\s]*)/i,
    ]) || 100000;

    const coffreGrand = this.extractAmount(text, [
      /coffre.*?grand[^\d]*(\d[\d\s]*)/i,
      /grand\s*coffre[^\d]*(\d[\d\s]*)/i,
    ]) || 200000;

    return {
      smsAlerte,
      eBanking: { abonnement: 0, parOperation: 0 },
      mobileBanking: { abonnement: 0 },
      coffre: { petit: coffrePetit, moyen: coffreMoyen, grand: coffreGrand },
      assuranceCompte: 2500,
      garantieLocative: 25000,
      cautionMarche: 50000,
    };
  }

  private extractPenalties(text: string): PenaltyFees {
    const chequeRejete = this.extractAmount(text, [
      /ch[eè]que\s*rejet[eé].*?p[eé]nalit[eé][^\d]*(\d[\d\s]*)/i,
      /p[eé]nalit[eé].*?ch[eè]que[^\d]*(\d[\d\s]*)/i,
      /incident\s*ch[eè]que[^\d]*(\d[\d\s]*)/i,
    ]) || 50000;

    const incidentPaiement = this.extractAmount(text, [
      /incident\s*(?:de\s*)?paiement[^\d]*(\d[\d\s]*)/i,
    ]) || 25000;

    const decouvertDepasse = this.extractAmount(text, [
      /d[eé]couvert\s*d[eé]pass[eé][^\d]*(\d[\d\s]*)/i,
      /d[eé]passement\s*d[eé]couvert[^\d]*(\d[\d\s]*)/i,
    ]) || 15000;

    const commissionIntervention = this.extractAmount(text, [
      /commission\s*(?:d['´])?intervention[^\d]*(\d[\d\s]*)/i,
      /frais\s*(?:d['´])?intervention[^\d]*(\d[\d\s]*)/i,
    ]) || 15000;

    const fraisContentieux = this.extractAmount(text, [
      /frais\s*(?:de\s*)?contentieux[^\d]*(\d[\d\s]*)/i,
      /contentieux[^\d]*(\d[\d\s]*)/i,
    ]) || 50000;

    return {
      chequeRejete,
      incidentPaiement,
      decouvertDepasse,
      retardRemboursement: 0.5,
      commissionIntervention,
      fraisContentieux,
    };
  }

  private calculateConfidence(
    accountFees: AccountFees,
    cardFees: CardFees,
    transferFees: TransferFees,
    checkFees: CheckFees,
    creditFees: CreditFees
  ): number {
    let foundFields = 0;
    let totalFields = 0;

    // Check account fees
    if (accountFees.tenueCompte.particulier !== 5000) foundFields++;
    if (accountFees.tenueCompte.professionnel !== 10000) foundFields++;
    if (accountFees.attestationSolde !== 5000) foundFields++;
    totalFields += 3;

    // Check card fees
    if (cardFees.cartes[0].cotisationAnnuelle !== 25000) foundFields++;
    if (cardFees.oppositionCarte !== 5000) foundFields++;
    totalFields += 2;

    // Check transfer fees
    if (transferFees.virementCemacUemoa.commission !== 0.5) foundFields++;
    if (transferFees.virementInternational.commission !== 1) foundFields++;
    totalFields += 2;

    // Check check fees
    if (checkFees.carnetCheques.feuilles25 !== 5000) foundFields++;
    totalFields += 1;

    // Check credit fees
    if (creditFees.decouvertAutorise.tauxAnnuel !== 14.5) foundFields++;
    if (creditFees.tauxUsure !== 27) foundFields++;
    totalFields += 2;

    return Math.round((foundFields / totalFields) * 100);
  }
}

// Singleton instance
export const pdfExtractionService = new PdfExtractionService();
