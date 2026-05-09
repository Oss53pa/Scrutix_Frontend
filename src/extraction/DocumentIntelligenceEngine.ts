// ============================================================================
// ATLASBANX — Document Intelligence Engine
// The orchestrator. Detects format, picks the right adapter, runs the
// 3-strategy cascade per field, produces a comprehensive ExtractionReport.
// ============================================================================

import type {
  ExtractionReport,
  ExtractionOptions,
  FieldExtraction,
  FieldDefinition,
  DocumentFormat,
  DocumentAnalysis,
} from './types';
import { FIELD_DEFINITIONS } from './FieldRegistry';
import { normalizeDocument, setByPath } from './normalize';

import { PdfAdapter } from './adapters/PdfAdapter';
import { ExcelAdapter } from './adapters/ExcelAdapter';
import { ImageAdapter } from './adapters/ImageAdapter';

import { patternStrategy } from './strategies/PatternStrategy';
import { tabularStrategy } from './strategies/TabularStrategy';
import { semanticStrategy } from './strategies/SemanticStrategy';
import { extractConditions } from './conditions';
import type { RubricMatch } from './conditions/types';

// ============================================================================
// Format detection
// ============================================================================

function detectFormat(file: File): DocumentFormat {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    // PDF native vs scan is decided inside PdfAdapter
    return 'pdf-native';
  }
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  ) {
    return 'excel';
  }
  if (type.startsWith('image/') || /\.(png|jpe?g|tiff?|bmp|gif|webp)$/i.test(name)) {
    return 'image';
  }
  if (name.endsWith('.docx')) {
    return 'docx';
  }
  return 'unknown';
}

function pickAdapter(format: DocumentFormat) {
  switch (format) {
    case 'pdf-native':
    case 'pdf-scan':
      return new PdfAdapter();
    case 'excel':
      return new ExcelAdapter();
    case 'image':
      return new ImageAdapter();
    default:
      throw new Error(`Format non supporté: ${format}`);
  }
}

// ============================================================================
// Bank detection — tries to identify the bank from text content
// ============================================================================

const BANK_FINGERPRINTS: Array<{ code: string; name: string; markers: RegExp[] }> = [
  { code: 'SGBCICICI', name: 'SGBCI', markers: [/\bsgbci\b/i, /soci[eé]t[eé] g[eé]n[eé]rale.*c[oô]te d['´]ivoire/i] },
  { code: 'BICICICX', name: 'BICICI', markers: [/\bbicici\b/i, /banque internationale.*commerce.*c[oô]te d['´]ivoire/i] },
  { code: 'ECABCICI', name: 'Ecobank Côte d\'Ivoire', markers: [/\becobank\b.*ci/i, /\becobank\b.*c[oô]te d['´]ivoire/i] },
  { code: 'BOACICIX', name: 'BOA Côte d\'Ivoire', markers: [/\bboa\b.*ci/i, /bank of africa.*c[oô]te d['´]ivoire/i] },
  { code: 'NSIACICI', name: 'NSIA Banque', markers: [/\bnsia\s*banque\b/i] },
  { code: 'ATLNCICI', name: 'Banque Atlantique', markers: [/banque\s*atlantique/i] },
  { code: 'BICCMCMX', name: 'BICEC', markers: [/\bbicec\b/i] },
  { code: 'SGCMCMX', name: 'Société Générale Cameroun', markers: [/soci[eé]t[eé] g[eé]n[eé]rale.*cameroun/i] },
  { code: 'UBACMCMX', name: 'UBA Cameroun', markers: [/\buba\b.*cameroun/i] },
];

function detectBank(text: string): { code: string; name: string; confidence: number } | undefined {
  const t = text.slice(0, 5000); // First 5KB is enough for headers
  for (const bank of BANK_FINGERPRINTS) {
    for (const re of bank.markers) {
      if (re.test(t)) {
        return { code: bank.code, name: bank.name, confidence: 0.95 };
      }
    }
  }
  return undefined;
}

// ============================================================================
// Main engine
// ============================================================================

export class DocumentIntelligenceEngine {
  /**
   * Extract bank conditions from any supported document.
   * Returns a comprehensive report with per-field confidence and evidence.
   */
  async extract(file: File, options: ExtractionOptions = {}): Promise<ExtractionReport> {
    const t0 = performance.now();
    const warnings: string[] = [];
    const format = detectFormat(file);

    if (format === 'unknown') {
      return this.failedReport(format, `Format non reconnu pour le fichier "${file.name}"`, t0);
    }

    options.onProgress?.({ stage: 'init', pct: 0, message: `Format détecté: ${format}` });

    // -----------------------------------------------------------------------
    // STEP 1: Adapter — extract unified text + (optional) tables / words
    // -----------------------------------------------------------------------
    let adapterOutput: { text: string; pages: number; tables?: string[][][] };
    try {
      const adapter = pickAdapter(format);
      adapterOutput = await adapter.extract(file, options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur extraction texte';
      return this.failedReport(format, msg, t0);
    }

    const rawText = adapterOutput.text;
    const text = normalizeDocument(rawText);

    if (text.length < 30) {
      warnings.push(`Texte extrait très court (${text.length} caractères) — extraction probablement incomplète.`);
    }

    options.onProgress?.({
      stage: 'analysis',
      pct: 0.3,
      message: `Texte extrait: ${text.length} caractères`,
    });

    // -----------------------------------------------------------------------
    // STEP 2: Bank detection (used to pick template patterns later)
    // -----------------------------------------------------------------------
    const bankDetected = options.bankCode
      ? { code: options.bankCode, name: options.bankCode, confidence: 1 }
      : detectBank(text);

    options.onProgress?.({
      stage: 'analysis',
      pct: 0.4,
      message: bankDetected
        ? `Banque détectée: ${bankDetected.name} (${Math.round(bankDetected.confidence * 100)}%)`
        : 'Banque non détectée — patterns génériques',
    });

    // -----------------------------------------------------------------------
    // STEP 2.5: Position-aware extraction (PDF only) — primary strategy.
    // Reads the document with X/Y positions, isolates "label → value" pairs
    // per row, fuzzy-matches each label to a FieldDefinition. Works on
    // ANY bank format because it doesn't assume column orders.
    // -----------------------------------------------------------------------
    let positionMatches: Record<string, RubricMatch> = {};
    let unmatchedPairs: import('./types').UnmatchedPair[] = [];
    let sections: string[] = [];
    if ((format === 'pdf-native' || format === 'pdf-scan') && file) {
      try {
        const conditionsResult = await extractConditions(file, {
          bankCode: bankDetected?.code,
          onProgress: (p) =>
            options.onProgress?.({
              stage: `position-${p.stage}`,
              pct: 0.4 + p.pct * 0.2,
              message: p.message,
            }),
        });
        positionMatches = conditionsResult.matches;
        sections = conditionsResult.sections;
        unmatchedPairs = conditionsResult.unmatchedPairs.map((p) => ({
          label: p.label,
          rawValue: p.rawValue,
          value: p.value,
          unit: p.unit,
          qualitative: p.qualitative,
          page: p.page,
          section: p.section,
        }));
        if (conditionsResult.warnings.length > 0) {
          warnings.push(...conditionsResult.warnings);
        }
      } catch (err) {
        console.warn('[DocumentIntelligenceEngine] Position-aware extraction failed:', err);
      }
    }

    // -----------------------------------------------------------------------
    // STEP 3: Per-field cascade — Position → Pattern → Tabular → Semantic
    // -----------------------------------------------------------------------
    const fields: Record<string, FieldExtraction> = {};
    let extracted = 0;
    let defaulted = 0;

    for (let i = 0; i < FIELD_DEFINITIONS.length; i++) {
      const fdef = FIELD_DEFINITIONS[i];
      const result = this.extractField(
        fdef,
        text,
        adapterOutput.tables,
        bankDetected?.code,
        positionMatches[fdef.key],
      );

      if (result) {
        fields[fdef.key] = { ...result, key: fdef.key, kind: fdef.kind };
        extracted++;
      } else if (fdef.default !== undefined && !options.strictMode) {
        fields[fdef.key] = {
          key: fdef.key,
          kind: fdef.kind,
          value: fdef.default,
          confidence: 0,
          strategy: 'default',
        };
        defaulted++;
      } else {
        fields[fdef.key] = {
          key: fdef.key,
          kind: fdef.kind,
          value: null,
          confidence: 0,
          strategy: 'default',
        };
      }

      if (i % 5 === 0) {
        options.onProgress?.({
          stage: 'extraction',
          pct: 0.4 + (i / FIELD_DEFINITIONS.length) * 0.5,
          message: `Champs traités: ${i + 1}/${FIELD_DEFINITIONS.length}`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // STEP 4: Aggregate report
    // -----------------------------------------------------------------------
    const total = FIELD_DEFINITIONS.length;
    const failed = total - extracted - defaulted;
    const overallConfidence =
      extracted === 0
        ? 0
        : Object.values(fields)
            .filter((f) => f.strategy !== 'default' && f.value !== null)
            .reduce((sum, f) => sum + f.confidence, 0) / Math.max(1, extracted);

    options.onProgress?.({ stage: 'done', pct: 1, message: 'Extraction terminée' });

    return {
      success: true,
      format,
      bankDetected,
      fields,
      overallConfidence,
      stats: { total, extracted, defaulted, failed },
      processingTimeMs: Math.round(performance.now() - t0),
      rawText,
      unmatchedPairs: unmatchedPairs.length > 0 ? unmatchedPairs : undefined,
      sections: sections.length > 0 ? sections : undefined,
      warnings,
    };
  }

  /**
   * Run the cascade for one field. Returns the BEST result across strategies,
   * or null if no strategy yielded a valid value.
   */
  private extractField(
    fdef: FieldDefinition,
    text: string,
    tables: string[][][] | undefined,
    bankCode: string | undefined,
    positionMatch?: RubricMatch,
  ): Omit<FieldExtraction, 'key' | 'kind'> | null {
    const candidates: Array<Omit<FieldExtraction, 'key' | 'kind'>> = [];

    // Strategy 0 (highest priority): position-aware extraction
    // Uses X/Y from pdfjs to isolate "label → amount" pairs and fuzzy-match.
    // The most reliable strategy because it works on any bank format.
    if (positionMatch) {
      candidates.push({
        value: positionMatch.pair.value,
        confidence: positionMatch.confidence,
        strategy: 'tabular', // reuse the existing badge — it IS tabular reasoning
        evidence: `${positionMatch.pair.label} → ${positionMatch.pair.rawValue} (page ${positionMatch.pair.page})`,
      });
    }

    // Strategy 1: pattern (template + generic)
    const p = patternStrategy(text, fdef, bankCode);
    if (p) candidates.push(p);

    // Strategy 2: tabular (only if we have tables)
    if (tables && tables.length > 0) {
      const t = tabularStrategy(tables, fdef);
      if (t) candidates.push(t);
    }

    // Strategy 3: semantic (always tried as a fallback)
    const s = semanticStrategy(text, fdef);
    if (s) candidates.push(s);

    if (candidates.length === 0) return null;

    // Pick highest confidence
    candidates.sort((a, b) => b.confidence - a.confidence);
    const winner = candidates[0];
    const alternatives = candidates.slice(1).map((c) => ({
      value: c.value as number | string,
      confidence: c.confidence,
      strategy: c.strategy,
      evidence: c.evidence,
    }));

    return {
      ...winner,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }

  /**
   * Convert an ExtractionReport to a Partial<BankConditions> tree
   * (for backward compatibility with the legacy form-fill code).
   */
  toBankConditions(report: ExtractionReport): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, ex] of Object.entries(report.fields)) {
      if (ex.value === null) continue;
      setByPath(out, key, ex.value);
    }
    return out;
  }

  private failedReport(format: DocumentFormat, error: string, t0: number): ExtractionReport {
    return {
      success: false,
      format,
      fields: {},
      overallConfidence: 0,
      stats: { total: 0, extracted: 0, defaulted: 0, failed: 0 },
      processingTimeMs: Math.round(performance.now() - t0),
      rawText: '',
      warnings: [error],
    };
  }
}

// Singleton for convenience
let _instance: DocumentIntelligenceEngine | null = null;
export function getDocumentEngine(): DocumentIntelligenceEngine {
  if (!_instance) _instance = new DocumentIntelligenceEngine();
  return _instance;
}

export type {
  ExtractionReport,
  ExtractionOptions,
  FieldExtraction,
  DocumentFormat,
  DocumentAnalysis,
} from './types';
