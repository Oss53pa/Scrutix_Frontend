// ============================================================================
// ATLASBANX - C13 Handler: Mapping rubriques inter-banques
// Zone: Orange (proposition, validation humaine requise)
// Baseline V1: normalized string similarity against taxonomy + DeterministicPreFilter
// Future: embedding (BGE-M3) + pgvector + LLM disambiguation
// ============================================================================

import type { C13Input, C13Output } from '../types';
import { RUBRICS_TAXONOMY, type RubricSeed } from '../../../../cdc/taxonomy/rubrics';
import { DeterministicPreFilter } from '../../DeterministicPreFilter';

// Singleton pre-filter
let preFilter: DeterministicPreFilter | null = null;
function getPreFilter(): DeterministicPreFilter {
  if (!preFilter) preFilter = new DeterministicPreFilter();
  return preFilter;
}

// Pre-compute normalized rubric labels for fast lookup
const RUBRIC_INDEX: Array<{
  rubric: RubricSeed;
  normalizedLabel: string;
  normalizedDesc: string;
  words: Set<string>;
}> = RUBRICS_TAXONOMY
  .filter(r => r.parentCode !== null) // Skip root categories
  .map(r => {
    const normalizedLabel = normalize(r.displayLabelFr);
    const normalizedDesc = normalize(r.description ?? '');
    const words = new Set([
      ...normalizedLabel.split(/\s+/).filter(w => w.length > 2),
      ...normalizedDesc.split(/\s+/).filter(w => w.length > 3),
    ]);
    return { rubric: r, normalizedLabel, normalizedDesc, words };
  });

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ----------------------------------------------------------------------------
// Scoring: word overlap + substring match
// ----------------------------------------------------------------------------

function scoreMatch(queryNorm: string, queryWords: string[], entry: typeof RUBRIC_INDEX[0]): number {
  let score = 0;

  // Exact substring match in label (highest signal)
  if (entry.normalizedLabel.includes(queryNorm) || queryNorm.includes(entry.normalizedLabel)) {
    score += 50;
  }

  // Word overlap
  const overlapCount = queryWords.filter(w => entry.words.has(w)).length;
  if (overlapCount > 0) {
    score += overlapCount * 15;
  }

  // Partial word match (prefix)
  for (const qw of queryWords) {
    for (const ew of entry.words) {
      if (qw.length >= 3 && ew.startsWith(qw.slice(0, 4))) {
        score += 5;
      }
    }
  }

  // Category code in query
  if (queryNorm.includes(entry.rubric.code)) {
    score += 40;
  }

  return score;
}

// Import category mapping from C5 for DeterministicPreFilter results
import { RUBRICS_CATEGORY_MAP } from './rubricMapping';

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC13(input: C13Input): C13Output {
  const topK = input.top_k ?? 5;
  const queryNorm = normalize(input.label);
  const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2);

  // Pass 1: Try DeterministicPreFilter for exact pattern match
  const filter = getPreFilter();
  const filterResult = filter.categorize(input.label);

  // Pass 2: Score all rubrics by text similarity
  const scored = RUBRIC_INDEX
    .map(entry => ({
      entry,
      score: scoreMatch(queryNorm, queryWords, entry),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Build mappings
  const mappings: C13Output['mappings'] = [];

  // If DeterministicPreFilter matched, add it first
  if (filterResult) {
    const rubricCode = RUBRICS_CATEGORY_MAP[filterResult.category] ?? filterResult.category;
    const existsInScored = scored.some(s => s.entry.rubric.code === rubricCode);

    if (!existsInScored) {
      const rubric = RUBRICS_TAXONOMY.find(r => r.code === rubricCode);
      mappings.push({
        rubric_code: rubricCode,
        rubric_label: rubric?.displayLabelFr ?? rubricCode,
        score: Math.round(filterResult.confidence * 100),
        justification: `Match pattern deterministe: "${filterResult.category}"`,
      });
    }
  }

  // Add scored results
  for (const s of scored) {
    // Normalize score to 0-100
    const normalizedScore = Math.min(95, Math.round(s.score * 1.2));
    mappings.push({
      rubric_code: s.entry.rubric.code,
      rubric_label: s.entry.rubric.displayLabelFr,
      score: normalizedScore,
      justification: buildJustification(queryNorm, s.entry),
    });
  }

  // Trim to topK
  const finalMappings = mappings.slice(0, topK);

  return {
    mappings: finalMappings,
    best_match: finalMappings.length > 0
      ? { rubric_code: finalMappings[0].rubric_code, confidence: finalMappings[0].score }
      : null,
  };
}

function buildJustification(queryNorm: string, entry: typeof RUBRIC_INDEX[0]): string {
  if (entry.normalizedLabel.includes(queryNorm)) {
    return `Correspondance exacte avec "${entry.rubric.displayLabelFr}"`;
  }

  const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2);
  const matchingWords = queryWords.filter(w => entry.words.has(w));

  if (matchingWords.length > 0) {
    return `Mots communs: ${matchingWords.join(', ')} → ${entry.rubric.displayLabelFr}`;
  }

  return `Similarite lexicale avec "${entry.rubric.displayLabelFr}"`;
}
