// ============================================================================
// ATLASBANX - C2 Handler: Extraction conventions client
// Zone: Orange — variante C1 specialisee conventions
// Detecte clauses derogatoires, signataires, comptes, heritage L3
// ============================================================================

import type { C2Input, C2Output, Derogation, BoundingBox } from '../types';
import { handleC1 } from './C1ExtractionCGHandler';
import type { C1Input } from '../types';

const PLACEHOLDER_BBOX: BoundingBox = { x: 0, y: 0, w: 100, h: 10 };

// ----------------------------------------------------------------------------
// Convention-specific extraction patterns
// ----------------------------------------------------------------------------

const DEROGATION_MARKERS: RegExp[] = [
  /par\s+d[eé]rogation\s+[àa]\s+nos\s+c\.?g/i,
  /conditions?\s+particuli[eè]res?/i,
  /d[eé]rogation\s+accord[eé]e/i,
  /tarif\s+pr[eé]f[eé]rentiel/i,
  /taux\s+n[eé]goci[eé]/i,
  /conditions?\s+sp[eé]ciales?/i,
];

const SIGNATORY_PATTERNS: RegExp[] = [
  /(?:pour|sign[eé])\s+(?:la\s+)?banque\s*[:\-]?\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,3})/i,
  /(?:pour|sign[eé])\s+(?:le\s+)?client\s*[:\-]?\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,3})/i,
  /directeur\s+(?:d['´]?agence|r[eé]gional)\s*[:\-]?\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,3})/i,
  /charg[eé]\s+d['´]?affaires?\s*[:\-]?\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,3})/i,
  /g[eé]rant\s*[:\-]?\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,3})/i,
];

const DATE_PATTERNS: RegExp[] = [
  /sign[eé]e?\s+(?:le\s+)?(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i,
  /fait\s+[àa]\s+\w+\s*,?\s*(?:le\s+)?(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i,
  /date\s*(?:de\s+signature)?\s*[:\-]?\s*(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i,
  /en\s+date\s+du\s+(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i,
];

const ACCOUNT_PATTERN = /(?:compte|n[°o]|:\s*)?\s*([A-Z]{2}\d{10,20}[\s-]?\d{0,5})/gi;

const DURATION_PATTERNS: RegExp[] = [
  /dur[eé]e\s*(?:de\s+)?(\d+)\s*(an|mois|jour)/i,
  /valable\s+(?:jusqu['´]?au|pour)\s+(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i,
  /dur[eé]e\s+ind[eé]termin[eé]e/i,
];

const GROUP_REF_PATTERN = /convention[_\-\s]cadre\s*(?:n[°o]?\s*)?([A-Z0-9\-\/]+)/i;

// ----------------------------------------------------------------------------
// Extraction helpers
// ----------------------------------------------------------------------------

function extractSignatories(text: string): C2Output['signatories'] {
  const signatories: C2Output['signatories'] = [];

  for (const pattern of SIGNATORY_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const fullMatch = match[0].toLowerCase();
      const side: 'bank' | 'client' = fullMatch.includes('banque') || fullMatch.includes('directeur') || fullMatch.includes('charge')
        ? 'bank'
        : 'client';
      const role = fullMatch.includes('directeur') ? 'Directeur d\'agence'
        : fullMatch.includes('charge') ? 'Charge d\'affaires'
        : fullMatch.includes('gerant') ? 'Gerant'
        : side === 'bank' ? 'Representant banque' : 'Representant client';

      signatories.push({ name: match[1].trim(), role, side });
    }
  }

  return signatories;
}

function extractSignatureDate(text: string): string {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return new Date().toISOString().slice(0, 10);
}

function extractAccountNumbers(text: string): string[] {
  const accounts: string[] = [];
  let match;
  const re = new RegExp(ACCOUNT_PATTERN.source, ACCOUNT_PATTERN.flags);
  while ((match = re.exec(text)) !== null) {
    const num = match[1].replace(/[\s-]/g, '');
    if (num.length >= 5 && !accounts.includes(num)) {
      accounts.push(num);
    }
  }
  return accounts;
}

function extractEffectivePeriod(text: string): C2Output['effective_period'] {
  for (const pattern of DURATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('indeterminee')) {
        return { from: extractSignatureDate(text), to: null };
      }
      if (match[1] && match[2]) {
        return { from: extractSignatureDate(text), to: null }; // Duration-based, no fixed end
      }
      if (match[1] && match[1].includes('/')) {
        return { from: extractSignatureDate(text), to: match[1] };
      }
    }
  }
  return { from: extractSignatureDate(text), to: null };
}

function detectDerogations(text: string): { hasDerogations: boolean; texts: string[] } {
  const texts: string[] = [];
  for (const marker of DEROGATION_MARKERS) {
    const match = text.match(marker);
    if (match) {
      // Extract surrounding context (200 chars around the match)
      const idx = text.indexOf(match[0]);
      const context = text.slice(Math.max(0, idx - 50), idx + 200).trim();
      texts.push(context);
    }
  }
  return { hasDerogations: texts.length > 0, texts };
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC2(input: C2Input): C2Output {
  const text = (input as Record<string, unknown>).text_content as string | undefined ?? '';

  // Run C1 extraction as base
  const c1Result = handleC1(input as C1Input);

  // Convention-specific extractions
  const signatories = extractSignatories(text);
  const signatureDate = extractSignatureDate(text);
  const effectivePeriod = extractEffectivePeriod(text);
  const accountNumbers = extractAccountNumbers(text);
  const derogationInfo = detectDerogations(text);

  // Group reference
  const groupMatch = text.match(GROUP_REF_PATTERN);
  const parentGroupRef = input.parent_group_ref ?? groupMatch?.[1] ?? undefined;

  // Build derogations (V1: mark detected derogation clauses, values need manual validation)
  const derogations: Derogation[] = derogationInfo.texts.map(derogText => ({
    rubric_code: 'non_specifie',
    bank_default_value: 0,
    derogated_value: 0,
    explicit_derogation_text: derogText,
    pdf_bbox: PLACEHOLDER_BBOX,
  }));

  return {
    // Base C1 fields
    extracted_conditions: c1Result.extracted_conditions,
    document_metadata: c1Result.document_metadata,
    unmapped_segments: c1Result.unmapped_segments,
    // Convention-specific
    signatories,
    signature_date: signatureDate,
    effective_period: effectivePeriod,
    account_numbers_concerned: accountNumbers,
    parent_group_agreement_ref: parentGroupRef,
    derogations,
  };
}
