// ============================================================================
// ATLASBANX - C3 Handler: Extraction avenants ponctuels
// Zone: Orange — distingue engagement contractuel ferme vs discussion commerciale
// Score d'engagement: >= 80 → draft, 50-79 → decision operateur, < 50 → pas d'avenant
// ============================================================================

import type { C3Input, C3Output, ExtractedCondition, BoundingBox } from '../types';
import { FIELD_DEFINITIONS } from '../../../../extraction/FieldRegistry';

const PLACEHOLDER_BBOX: BoundingBox = { x: 0, y: 0, w: 100, h: 10 };

// ----------------------------------------------------------------------------
// Engagement score signals
// ----------------------------------------------------------------------------

interface EngagementSignal {
  pattern: RegExp;
  score: number;
  label: string;
}

const POSITIVE_SIGNALS: EngagementSignal[] = [
  { pattern: /sign[eé]|paraph[eé]/i, score: 25, label: 'Signature detectee' },
  { pattern: /par\s+la\s+pr[eé]sente|accord[eé]|convenu/i, score: 20, label: 'Formulation contractuelle' },
  { pattern: /avenant\s+n[°o]?\s*\d/i, score: 20, label: 'Reference avenant numerote' },
  { pattern: /applicable\s+[àa]\s+compter|prend\s+effet/i, score: 15, label: 'Date d\'effet explicite' },
  { pattern: /cachet|tampon|sceau/i, score: 15, label: 'Cachet/tampon mentionne' },
  { pattern: /engagement\s+ferme|irr[eé]vocable/i, score: 15, label: 'Engagement ferme' },
  { pattern: /dur[eé]e\s+(d[eé]termin|ind[eé]termin)/i, score: 10, label: 'Duree specifiee' },
];

const NEGATIVE_SIGNALS: EngagementSignal[] = [
  { pattern: /proposition|offre\s+commerciale/i, score: -20, label: 'Proposition non engageante' },
  { pattern: /sans\s+engagement|non\s+contractuel/i, score: -25, label: 'Mention non-engagement' },
  { pattern: /sous\s+r[eé]serve|conditionn[eé]/i, score: -15, label: 'Clause de reserve' },
  { pattern: /discussion|n[eé]gociation\s+en\s+cours/i, score: -15, label: 'Negociation en cours' },
  { pattern: /projet|brouillon|draft/i, score: -10, label: 'Document projet/brouillon' },
];

// Date extraction
const DATE_PATTERNS: RegExp[] = [
  /(?:applicable|effet|compter)\s+(?:du|a)\s+(?:le\s+)?(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i,
  /(?:jusqu['´]?au|valable\s+jusqu)\s+(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i,
];

// Value extraction (simple numbers near rubric keywords)
const VALUE_PATTERN = /(\d[\d\s\u00A0.,]{0,12})\s*(%|FCFA|XAF|XOF)/gi;

// ----------------------------------------------------------------------------
// Core logic
// ----------------------------------------------------------------------------

function computeEngagementScore(text: string): { score: number; signals: string[] } {
  let score = 50; // Baseline
  const signals: string[] = [];

  for (const sig of POSITIVE_SIGNALS) {
    if (sig.pattern.test(text)) {
      score += sig.score;
      signals.push(`+${sig.score}: ${sig.label}`);
    }
  }

  for (const sig of NEGATIVE_SIGNALS) {
    if (sig.pattern.test(text)) {
      score += sig.score; // Negative values
      signals.push(`${sig.score}: ${sig.label}`);
    }
  }

  // Clamp to 0-100
  return { score: Math.max(0, Math.min(100, score)), signals };
}

function extractConditionsFromText(text: string): ExtractedCondition[] {
  const conditions: ExtractedCondition[] = [];
  const normalizedText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const fdef of FIELD_DEFINITIONS) {
    if (!fdef.aliases) continue;

    for (const alias of fdef.aliases) {
      const normalizedAlias = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const escaped = normalizedAlias
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
      const re = new RegExp(
        `${escaped}\\s*[:\\-.…\\s]{0,80}([0-9][0-9\\s\\u00A0.,]{0,15})`,
        'i'
      );
      const match = normalizedText.match(re);
      if (match?.[1]) {
        const rawNum = match[1].replace(/[\s\u00A0]/g, '').replace(',', '.');
        const value = parseFloat(rawNum);
        if (!isNaN(value)) {
          conditions.push({
            rubric_code: fdef.key,
            raw_label: fdef.label,
            value_numeric: value,
            value_formula: null,
            unit: fdef.kind === 'percentage' || fdef.unitHint === '%' ? 'percent' : 'fcfa',
            dimensions: null,
            pdf_page: 1,
            pdf_bbox: PLACEHOLDER_BBOX,
            confidence: 65, // Lower confidence for avenants (informal documents)
            extraction_notes: `Avenant match: "${match[0].trim().slice(0, 100)}"`,
          });
          break; // One match per field is enough
        }
      }
    }
  }

  return conditions;
}

function extractEffectivePeriod(text: string): C3Output['effective_period'] {
  let from: string | null = null;
  let to: string | null = null;

  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      if (!from) from = match[1];
      else if (!to) to = match[1];
    }
  }

  if (from) return { from, to };
  return null;
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC3(input: C3Input): C3Output {
  const text = (input as Record<string, unknown>).text_content as string | undefined ?? '';

  const { score, signals } = computeEngagementScore(text);
  const conditions = extractConditionsFromText(text);
  const effectivePeriod = extractEffectivePeriod(text);

  return {
    engagement_score: score,
    conditions,
    effective_period: effectivePeriod,
    source_text: text.slice(0, 2000),
    avenant_draft_created: score >= 80,
  };
}
