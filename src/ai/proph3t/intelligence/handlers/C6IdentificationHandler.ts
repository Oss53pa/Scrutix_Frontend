// ============================================================================
// ATLASBANX - C6 Handler: Identification banque & type de document
// Zone: Orange (proposition, validation humaine requise)
// Approche baseline: heuristiques textuelles (pas de vision pour V1)
// ============================================================================

import type { C6Input, C6Output, DocumentType } from '../types';

// ----------------------------------------------------------------------------
// Bank fingerprints — SWIFT BIC + name patterns
// Extends the existing DocumentIntelligenceEngine fingerprints with broader
// CEMAC/UEMOA coverage.
// ----------------------------------------------------------------------------

interface BankFingerprint {
  code: string;
  name: string;
  markers: RegExp[];
}

const BANK_FINGERPRINTS: BankFingerprint[] = [
  // Cote d'Ivoire (UEMOA)
  { code: 'SGBCCICI', name: 'SGBCI', markers: [/\bsgbci\b/i, /soci[eé]t[eé]\s+g[eé]n[eé]rale.*c[oô]te\s+d['´']?ivoire/i, /SGBCCICI/] },
  { code: 'BICICICX', name: 'BICICI', markers: [/\bbicici\b/i, /banque\s+internationale.*commerce.*industrie.*c[oô]te/i, /BICICICX/] },
  { code: 'ECABCICI', name: 'Ecobank CI', markers: [/\becobank\b.*c[oô]te\s+d['´']?ivoire/i, /\becobank\b.*\bci\b/i, /ECABCICI/] },
  { code: 'BOACICIX', name: 'BOA CI', markers: [/\bboa\b.*c[oô]te\s+d['´']?ivoire/i, /bank\s+of\s+africa.*c[oô]te/i, /BOACICIX/] },
  { code: 'NSIACICI', name: 'NSIA Banque CI', markers: [/\bnsia\s*banque\b/i, /NSIACICI/] },
  { code: 'ATLNCICI', name: 'Banque Atlantique CI', markers: [/banque\s*atlantique.*c[oô]te/i, /banque\s*atlantique/i, /ATLNCICI/] },
  { code: 'COBACICI', name: 'Coris Bank CI', markers: [/coris\s*bank.*c[oô]te/i, /COBACICI/] },
  { code: 'ORACICIX', name: 'Orabank CI', markers: [/orabank.*c[oô]te/i, /ORACICIX/] },
  { code: 'UBACICIX', name: 'UBA CI', markers: [/\buba\b.*c[oô]te/i, /UBACICIX/] },
  { code: 'BGFICICI', name: 'BGFIBank CI', markers: [/bgfi\s*bank.*c[oô]te/i, /BGFICICI/] },

  // Cameroun (CEMAC)
  { code: 'ABORECMX', name: 'Afriland First Bank', markers: [/afriland\s*first/i, /ABORECMX/] },
  { code: 'BICCMCMX', name: 'BICEC', markers: [/\bbicec\b/i, /BICCMCMX/] },
  { code: 'SGCMCMX', name: 'SG Cameroun', markers: [/soci[eé]t[eé]\s+g[eé]n[eé]rale.*cameroun/i, /SGCMCMX/] },
  { code: 'ECABORDC', name: 'Ecobank Cameroun', markers: [/ecobank.*cameroun/i, /ECABORDC/] },
  { code: 'UBACMCMX', name: 'UBA Cameroun', markers: [/\buba\b.*cameroun/i, /UBACMCMX/] },
  { code: 'CBCXCMCX', name: 'CBC', markers: [/commercial\s+bank.*cameroun/i, /\bcbc\b.*cameroun/i, /CBCXCMCX/] },
  { code: 'BGFICMCX', name: 'BGFIBank Cameroun', markers: [/bgfi\s*bank.*cameroun/i, /BGFICMCX/] },
  { code: 'ATLNCMCX', name: 'Banque Atlantique Cameroun', markers: [/banque\s*atlantique.*cameroun/i, /ATLNCMCX/] },
  { code: 'NSIACMCX', name: 'NSIA Cameroun', markers: [/nsia.*cameroun/i, /NSIACMCX/] },

  // Gabon (CEMAC)
  { code: 'BGFIGABX', name: 'BGFIBank Gabon', markers: [/bgfi\s*bank.*gabon/i, /BGFIGABX/] },
  { code: 'BICIGABX', name: 'BICIG', markers: [/\bbicig\b/i, /BICIGABX/] },
  { code: 'ECABGABX', name: 'Ecobank Gabon', markers: [/ecobank.*gabon/i, /ECABGABX/] },

  // Senegal (UEMOA)
  { code: 'CBAOSNDA', name: 'CBAO', markers: [/\bcbao\b/i, /attijariwafa.*s[eé]n[eé]gal/i, /CBAOSNDA/] },
  { code: 'SGBSSNDA', name: 'SG Senegal', markers: [/soci[eé]t[eé]\s+g[eé]n[eé]rale.*s[eé]n[eé]gal/i, /SGBSSNDA/] },
  { code: 'ECABSNDA', name: 'Ecobank Senegal', markers: [/ecobank.*s[eé]n[eé]gal/i, /ECABSNDA/] },
  { code: 'BOASNSND', name: 'BOA Senegal', markers: [/\bboa\b.*s[eé]n[eé]gal/i, /BOASNSND/] },

  // Congo (CEMAC)
  { code: 'LCBPCGCX', name: 'LCB', markers: [/congolaise\s+de\s+banque/i, /\blcb\b/i, /LCBPCGCX/] },
  { code: 'BGFICGCX', name: 'BGFIBank Congo', markers: [/bgfi\s*bank.*congo/i, /BGFICGCX/] },

  // Generic multi-country (fallback — lower confidence)
  { code: 'ECOBANK', name: 'Ecobank', markers: [/\becobank\b/i] },
  { code: 'BOA', name: 'Bank of Africa', markers: [/bank\s+of\s+africa/i, /\bboa\b/i] },
  { code: 'SGBANK', name: 'Societe Generale', markers: [/soci[eé]t[eé]\s+g[eé]n[eé]rale/i] },
  { code: 'UBA', name: 'UBA', markers: [/\buba\b/i, /united\s+bank\s+for\s+africa/i] },
  { code: 'ORABANK', name: 'Orabank', markers: [/\borabank\b/i] },
  { code: 'BGFIBANK', name: 'BGFIBank', markers: [/\bbgfi\s*bank\b/i] },
  { code: 'CORISBANK', name: 'Coris Bank', markers: [/coris\s*bank/i] },
];

// Country-specific banks have SWIFT-like codes (8+ chars) → higher confidence
function isBankCountrySpecific(code: string): boolean {
  return code.length >= 8;
}

// ----------------------------------------------------------------------------
// Document type detection
// ----------------------------------------------------------------------------

interface DocTypeSignal {
  type: DocumentType;
  patterns: RegExp[];
  weight: number;
}

const DOC_TYPE_SIGNALS: DocTypeSignal[] = [
  {
    type: 'conditions_generales',
    patterns: [
      /conditions\s+g[eé]n[eé]rales/i,
      /tarification\s+(des\s+)?services/i,
      /conditions\s+tarifaires/i,
      /bar[eè]me\s+(des\s+)?frais/i,
      /grille\s+tarifaire/i,
      /tarifs?\s+en\s+vigueur/i,
      /conditions\s+appliqu[eé]es/i,
    ],
    weight: 1.0,
  },
  {
    type: 'convention',
    patterns: [
      /convention\s+de\s+compte/i,
      /convention\s+bancaire/i,
      /convention\s+client/i,
      /par\s+d[eé]rogation\s+[àa]\s+nos\s+c\.?g/i,
      /conditions\s+particuli[eè]res/i,
      /convention[_\-\s]cadre/i,
      /entre\s+les\s+soussign[eé]s/i,
    ],
    weight: 1.0,
  },
  {
    type: 'avenant',
    patterns: [
      /avenant\s+(n[°o]?\s*)?\d*/i,
      /modification\s+des\s+conditions/i,
      /r[eé]vision\s+tarifaire/i,
      /am[eé]nagement\s+exceptionnel/i,
      /d[eé]rogation\s+ponctuelle/i,
    ],
    weight: 1.0,
  },
  {
    type: 'releve',
    patterns: [
      /relev[eé]\s+(de\s+)?compte/i,
      /relev[eé]\s+bancaire/i,
      /extrait\s+de\s+compte/i,
      /solde\s+(d[eé]biteur|cr[eé]diteur|pr[eé]c[eé]dent|nouveau)/i,
      /report\s+ancien\s+solde/i,
      /total\s+des\s+(d[eé]bits|cr[eé]dits)/i,
    ],
    weight: 1.0,
  },
  {
    type: 'echelle_interets',
    patterns: [
      /[eé]chelle\s+d['´']?int[eé]r[eê]ts/i,
      /d[eé]compte\s+d['´']?int[eé]r[eê]ts/i,
      /ticket\s+d['´']?agios/i,
      /arr[eê]t[eé]\s+de\s+compte/i,
      /int[eé]r[eê]ts\s+d[eé]biteurs/i,
      /cpfd|commission\s+du\s+plus\s+fort\s+d[eé]couvert/i,
    ],
    weight: 1.0,
  },
  {
    type: 'decompte_frais',
    patterns: [
      /d[eé]compte\s+de\s+frais/i,
      /factur(ation|e)\s+de\s+services/i,
      /pr[eé]l[eè]vement\s+de\s+commissions/i,
      /d[eé]tail\s+des\s+frais/i,
    ],
    weight: 1.0,
  },
  {
    type: 'lettre_rm',
    patterns: [
      /responsable\s+de\s+march[eé]/i,
      /charg[eé]\s+d['´']?affaires/i,
      /directeur\s+d['´']?agence/i,
      /cher\s+(client|monsieur|madame)/i,
      /proposition\s+commerciale/i,
      /offre\s+tarifaire/i,
    ],
    weight: 0.6,
  },
];

// Negative signals: if present, more likely non_bancaire
const NON_BANCAIRE_SIGNALS: RegExp[] = [
  /facture\s+(d['´']?[eé]lectricit[eé]|d['´']?eau|t[eé]l[eé]phone)/i,
  /bulletin\s+de\s+(salaire|paie)/i,
  /contrat\s+de\s+travail/i,
  /quittance\s+de\s+loyer/i,
  /devis\s+n[°o]/i,
  /bon\s+de\s+commande/i,
];

// Regulatory body mentions (boosts "this is a banking document")
const REGULATORY_SIGNALS: RegExp[] = [
  /\bbceao\b/i,
  /\bcobac\b/i,
  /\bohada\b/i,
  /\bbeac\b/i,
  /\bcemac\b/i,
  /\buemoa\b/i,
  /\bteg\b/i,
  /\btaea\b/i,
  /rccm\s*[:\-]?\s*[A-Z]{2}/i,
  /swift\s*[:\-]?\s*[A-Z]{4,}/i,
];

// ----------------------------------------------------------------------------
// Core detection logic
// ----------------------------------------------------------------------------

function detectBank(text: string): C6Output['detected_bank'] & { signals: string[] } {
  const searchText = text.slice(0, 8000);
  const signals: string[] = [];
  let bestMatch: { code: string; name: string; confidence: number } | null = null;

  for (const fp of BANK_FINGERPRINTS) {
    for (const marker of fp.markers) {
      const match = searchText.match(marker);
      if (match) {
        const isSpecific = isBankCountrySpecific(fp.code);
        const confidence = isSpecific ? 92 : 65;
        signals.push(`Bank marker: "${match[0]}" → ${fp.name}`);

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { code: fp.code, name: fp.name, confidence };
        }
        break;
      }
    }
  }

  // Check SWIFT/BIC code directly
  const swiftMatch = searchText.match(/\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?)\b/);
  if (swiftMatch) {
    const swift = swiftMatch[1];
    const knownBank = BANK_FINGERPRINTS.find(fp => fp.code === swift);
    if (knownBank) {
      signals.push(`SWIFT/BIC direct: ${swift}`);
      if (!bestMatch || 95 > bestMatch.confidence) {
        bestMatch = { code: knownBank.code, name: knownBank.name, confidence: 95 };
      }
    }
  }

  // Regulatory signals boost general "banking" confidence
  for (const re of REGULATORY_SIGNALS) {
    const m = searchText.match(re);
    if (m) {
      signals.push(`Regulatory: "${m[0]}"`);
    }
  }

  return bestMatch
    ? { ...bestMatch, signals }
    : { code: 'UNKNOWN', name: 'Non identifie', confidence: 0, signals };
}

function detectDocumentType(text: string): C6Output['detected_document_type'] & { signals: string[] } {
  const searchText = text.slice(0, 15000);
  const signals: string[] = [];
  const scores: Partial<Record<DocumentType, number>> = {};

  // Check positive signals
  for (const sig of DOC_TYPE_SIGNALS) {
    let matchCount = 0;
    for (const pattern of sig.patterns) {
      const m = searchText.match(pattern);
      if (m) {
        matchCount++;
        signals.push(`DocType[${sig.type}]: "${m[0]}"`);
      }
    }
    if (matchCount > 0) {
      scores[sig.type] = (scores[sig.type] || 0) + matchCount * sig.weight;
    }
  }

  // Check non-bancaire signals
  let nonBancaireScore = 0;
  for (const re of NON_BANCAIRE_SIGNALS) {
    if (re.test(searchText)) {
      nonBancaireScore++;
      signals.push('Non-bancaire signal detected');
    }
  }

  // If strong non-bancaire signals and no banking signals
  if (nonBancaireScore >= 2 && Object.keys(scores).length === 0) {
    return {
      type: 'non_bancaire',
      confidence: Math.min(90, 50 + nonBancaireScore * 20),
      signals,
    };
  }

  // Pick highest scoring type
  const entries = Object.entries(scores) as [DocumentType, number][];
  if (entries.length === 0) {
    return { type: 'non_bancaire', confidence: 30, signals };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = entries[0];
  const confidence = Math.min(95, 50 + bestScore * 15);

  return { type: bestType, confidence, signals };
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC6(input: C6Input): C6Output {
  const text = input.text_content ?? '';

  const bankResult = detectBank(text);
  const docResult = detectDocumentType(text);

  const allSignals = [...bankResult.signals, ...docResult.signals];

  return {
    detected_bank: {
      code: bankResult.code,
      name: bankResult.name,
      confidence: bankResult.confidence,
    },
    detected_document_type: {
      type: docResult.type,
      confidence: docResult.confidence,
    },
    signals: allSignals,
  };
}
