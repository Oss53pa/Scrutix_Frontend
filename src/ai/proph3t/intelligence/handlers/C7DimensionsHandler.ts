// ============================================================================
// ATLASBANX - C7 Handler: Detection dimensions tarifaires
// Zone: Orange — detecte les conditions dimensionnelles dans le texte
// Dimensions: montant, profil, duree, garantie, devise, canal
// ============================================================================

import type {
  C7Input, C7Output, DetectedDimension, DimensionType,
  ConditionDimensions, ConditionFormula, BoundingBox,
} from '../types';

const PLACEHOLDER_BBOX: BoundingBox = { x: 0, y: 0, w: 100, h: 10 };

// ----------------------------------------------------------------------------
// Dimension detection patterns
// ----------------------------------------------------------------------------

interface DimensionPattern {
  type: DimensionType;
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => Partial<ConditionDimensions>;
  isCumulative: boolean;
}

const DIMENSION_PATTERNS: DimensionPattern[] = [
  // Montant — ranges
  {
    type: 'montant',
    pattern: /(?:entre|de)\s+([\d\s.,]+)\s*(?:et|[àa])\s+([\d\s.,]+)\s*(?:FCFA|XAF|XOF|F\b)/i,
    extract: (m) => ({
      montant_centimes: {
        min: parseAmount(m[1]) * 100,
        max: parseAmount(m[2]) * 100,
      },
    }),
    isCumulative: false,
  },
  {
    type: 'montant',
    pattern: /(?:sup[eé]rieur|au[_\-\s]del[àa]|[>≥])\s*(?:[àa]\s*)?([\d\s.,]+)\s*(?:FCFA|XAF|XOF|F\b)/i,
    extract: (m) => ({
      montant_centimes: { min: parseAmount(m[1]) * 100 },
    }),
    isCumulative: false,
  },
  {
    type: 'montant',
    pattern: /(?:inf[eé]rieur|jusqu['´]?[àa]|[<≤])\s*(?:[àa]\s*)?([\d\s.,]+)\s*(?:FCFA|XAF|XOF|F\b)/i,
    extract: (m) => ({
      montant_centimes: { max: parseAmount(m[1]) * 100 },
    }),
    isCumulative: false,
  },

  // Profil
  {
    type: 'profil',
    pattern: /\b(particuliers?|personne\s+physique)\b/i,
    extract: () => ({ profil: 'particulier' }),
    isCumulative: false,
  },
  {
    type: 'profil',
    pattern: /\b(PME|petite|moyenne\s+entreprise|TPE)\b/i,
    extract: () => ({ profil: 'pme' }),
    isCumulative: false,
  },
  {
    type: 'profil',
    pattern: /\b(corporate|grande\s+entreprise|soci[eé]t[eé])\b/i,
    extract: () => ({ profil: 'corporate' }),
    isCumulative: false,
  },

  // Duree
  {
    type: 'duree',
    pattern: /(?:entre|de)\s+(\d+)\s*(?:et|[àa])\s+(\d+)\s*(mois|jours?|ans?)/i,
    extract: (m) => {
      const mult = m[3].startsWith('an') ? 365 : m[3].startsWith('mois') ? 30 : 1;
      return { duree_jours: { min: parseInt(m[1]) * mult, max: parseInt(m[2]) * mult } };
    },
    isCumulative: false,
  },
  {
    type: 'duree',
    pattern: /(?:court\s+terme|CT)\b/i,
    extract: () => ({ duree_jours: { min: 1, max: 365 } }),
    isCumulative: false,
  },
  {
    type: 'duree',
    pattern: /(?:moyen\s+terme|MT)\b/i,
    extract: () => ({ duree_jours: { min: 366, max: 2555 } }), // 1-7 ans
    isCumulative: false,
  },
  {
    type: 'duree',
    pattern: /(?:long\s+terme|LT)\b/i,
    extract: () => ({ duree_jours: { min: 2556 } }), // > 7 ans
    isCumulative: false,
  },

  // Garantie
  {
    type: 'garantie',
    pattern: /(?:avec|sous)\s+(?:une?\s+)?(hypoth[eè]que|caution|nantissement|gage)/i,
    extract: (m) => ({ garantie: m[1].toLowerCase() }),
    isCumulative: false,
  },
  {
    type: 'garantie',
    pattern: /sans\s+garantie/i,
    extract: () => ({ garantie: 'sans' }),
    isCumulative: false,
  },

  // Devise
  {
    type: 'devise',
    pattern: /\b(XAF|XOF|EUR|USD|GBP|FCFA)\b/i,
    extract: (m) => {
      const d = m[1].toUpperCase();
      return { devise: d === 'FCFA' ? 'XAF' : d };
    },
    isCumulative: false,
  },

  // Canal
  {
    type: 'canal',
    pattern: /\b(?:en\s+)?(agence|guichet)\b/i,
    extract: () => ({ canal: 'agence' }),
    isCumulative: false,
  },
  {
    type: 'canal',
    pattern: /\b(?:via\s+)?(e-?banking|internet\s+banking|en\s+ligne)\b/i,
    extract: () => ({ canal: 'ebanking' }),
    isCumulative: false,
  },
  {
    type: 'canal',
    pattern: /\b(?:via\s+)?(mobile|mobile\s+banking|appli)\b/i,
    extract: () => ({ canal: 'mobile' }),
    isCumulative: false,
  },
  {
    type: 'canal',
    pattern: /\b(DAB|GAB|ATM|distributeur)\b/i,
    extract: () => ({ canal: 'atm' }),
    isCumulative: false,
  },
];

// Tier/tranche detection
const TIER_PATTERN = /(\d[\d\s.,]*)\s*(%|FCFA|XAF)\s*(?:jusqu['´]?[àa]|pour\s+les?\s+(?:premiers?\s+)?)?\s*([\d\s.,]+)\s*(?:FCFA|XAF|M\b|millions?)/gi;
const TIERED_MARKERS = /tranche|d[eé]gressif|progressif|bar[eè]me|palier/i;

// Conditional rules
const CONDITIONAL_PATTERNS: Array<{ pattern: RegExp; extractCondition: string; extractEffect: string }> = [
  {
    pattern: /gratuit\s+si\s+([^.]{10,80})/i,
    extractCondition: 'gratuit si',
    extractEffect: 'exoneration',
  },
  {
    pattern: /offert\s+(?:pour|si|aux?)\s+([^.]{10,80})/i,
    extractCondition: 'offert',
    extractEffect: 'exoneration',
  },
  {
    pattern: /r[eé]duction\s+(?:de\s+)?(\d+)\s*%\s+(?:si|pour)\s+([^.]{10,60})/i,
    extractCondition: 'reduction conditionnelle',
    extractEffect: 'reduction',
  },
];

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[\s\u00A0]/g, '').replace(',', '.')) || 0;
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC7(input: C7Input): C7Output {
  const text = input.text;
  const dimensions: DetectedDimension[] = [];
  const conditionalRules: C7Output['conditional_rules'] = [];

  // Detect dimensions
  for (const dp of DIMENSION_PATTERNS) {
    const match = text.match(dp.pattern);
    if (match) {
      dimensions.push({
        type: dp.type,
        values: dp.extract(match),
        raw_text: match[0],
        is_cumulative: dp.isCumulative,
        confidence: 75,
      });
    }
  }

  // Detect tiers
  const hasTiers = TIERED_MARKERS.test(text);
  let tiers: ConditionFormula['tiers'] | undefined;

  if (hasTiers) {
    tiers = [];
    const tierRe = /(\d[\d\s.,]*)\s*(%)\s*.*?(?:jusqu['´]?[àa]|premiers?)\s*([\d\s.,]+)\s*(?:FCFA|XAF|M)/gi;
    let m;
    while ((m = tierRe.exec(text)) !== null) {
      tiers.push({
        min: tiers.length > 0 ? (tiers[tiers.length - 1].max ?? 0) : 0,
        max: parseAmount(m[3]) * (m[3].match(/M/i) ? 1000000 : 1),
        rate: parseAmount(m[1]),
        unit: 'percent',
      });
    }
    if (tiers.length === 0) tiers = undefined;
  }

  // Detect conditional rules
  for (const cp of CONDITIONAL_PATTERNS) {
    const match = text.match(cp.pattern);
    if (match) {
      conditionalRules.push({
        condition: match[1]?.trim() ?? cp.extractCondition,
        effect: cp.extractEffect,
        raw_text: match[0],
      });
    }
  }

  // Detect cumulative dimensions ("PME ET montant > 10M")
  const cumulativeRe = /\b(ET|AND)\b/;
  if (dimensions.length >= 2 && cumulativeRe.test(text)) {
    for (const dim of dimensions) {
      dim.is_cumulative = true;
    }
  }

  return {
    dimensions,
    has_tiers: hasTiers && (tiers?.length ?? 0) > 0,
    tiers,
    conditional_rules: conditionalRules,
  };
}
