// ============================================================================
// ATLASBANX — Verification payload builders
// ============================================================================
// Bridges the extractor outputs into the VerificationPayload shape the modal
// understands. Statement: ExtractedTransaction[] → StatementRow[].
// Conditions: LabelValuePair[] (+ ExtractionReport) → ConditionRow[].
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { ExtractedTransaction } from '../../extraction/bank-statement';
import type { ExtractionReport } from '../../extraction';
import type { LabelValuePair, RubricMatch } from '../../extraction/conditions/types';
import type {
  ConditionRow,
  StatementRow,
  VerificationPayload,
} from './types';

interface StatementBuildArgs {
  fileName: string;
  bankCode?: string;
  clientId?: string;
  candidates: ExtractedTransaction[];
  pages?: number;
  defaultCurrency?: string;
}

export function buildStatementPayload(args: StatementBuildArgs): VerificationPayload {
  const rows: StatementRow[] = args.candidates.map((tx) => ({
    id: uuidv4(),
    state: 'pending',
    confidence: tx.confidence,
    warnings: tx.warnings ?? [],
    boundingBox: tx.boundingBox,
    data: {
      date: tx.date instanceof Date ? tx.date.toISOString().slice(0, 10) : '',
      valueDate: tx.valueDate instanceof Date ? tx.valueDate.toISOString().slice(0, 10) : undefined,
      description: tx.description ?? '',
      reference: tx.reference,
      amount: tx.amount,
      balance: tx.balance,
      currency: tx.currency ?? args.defaultCurrency,
    },
  }));

  const total = rows.length;
  const meanConfidence = total === 0 ? 0 : rows.reduce((s, r) => s + r.confidence, 0) / total;

  return {
    mode: 'statement',
    fileName: args.fileName,
    bankCode: args.bankCode,
    clientId: args.clientId,
    extractedAt: new Date().toISOString(),
    stats: {
      totalRows: total,
      extracted: total,
      averageConfidence: meanConfidence,
      pages: args.pages,
    },
    rows,
  };
}

interface ConditionsBuildArgs {
  fileName: string;
  bankCode?: string;
  pairs: LabelValuePair[];
  /** Optional: full report — used to seed rubricKey from matched fields. */
  report?: ExtractionReport;
  /** Optional: matches keyed by rubric key — preferred when calling extractConditions
   *  directly (each match knows exactly which pair drove it). */
  matches?: Record<string, RubricMatch>;
}

export function buildConditionsPayload(args: ConditionsBuildArgs): VerificationPayload {
  // Pair-fingerprint → rubric key, derived from explicit matches when provided.
  const matchedPairToRubric = new Map<string, { key: string; confidence: number }>();
  if (args.matches) {
    for (const [key, m] of Object.entries(args.matches)) {
      const fp = `${m.pair.page}-${Math.round(m.pair.y)}-${normalize(m.pair.label)}`;
      matchedPairToRubric.set(fp, { key, confidence: m.confidence });
    }
  }

  // Fallback evidence lookup (used only when matches map is absent)
  const fieldsByEvidence = new Map<string, string>();
  if (!args.matches && args.report) {
    for (const [key, field] of Object.entries(args.report.fields)) {
      if (field.evidence) {
        fieldsByEvidence.set(normalize(field.evidence), key);
      }
    }
  }

  const rows: ConditionRow[] = args.pairs.map((pair) => {
    let rubricKey: string | undefined;
    let confidence = pair.confidence ?? 0.5;

    // 1. Direct match lookup by pair fingerprint
    const fp = `${pair.page}-${Math.round(pair.y)}-${normalize(pair.label)}`;
    const direct = matchedPairToRubric.get(fp);
    if (direct) {
      rubricKey = direct.key;
      confidence = Math.max(confidence, direct.confidence);
    }

    // 2. Evidence-based fallback
    if (!rubricKey && fieldsByEvidence.size > 0) {
      const labelKey = normalize(pair.label);
      for (const [evidence, key] of fieldsByEvidence) {
        if (evidence.includes(labelKey) || labelKey.includes(evidence.slice(0, 30))) {
          rubricKey = key;
          break;
        }
      }
    }

    return {
      id: uuidv4(),
      state: 'pending',
      confidence,
      warnings: [],
      boundingBox: pair.boundingBox,
      data: {
        label: pair.label,
        value: pair.value,
        unit: pair.unit,
        qualitative: pair.qualitative,
        section: pair.section,
        rubricKey,
      },
    };
  });

  const total = rows.length;
  const meanConfidence = total === 0 ? 0 : rows.reduce((s, r) => s + r.confidence, 0) / total;

  return {
    mode: 'conditions',
    fileName: args.fileName,
    bankCode: args.bankCode,
    extractedAt: new Date().toISOString(),
    stats: {
      totalRows: total,
      extracted: total,
      averageConfidence: meanConfidence,
    },
    rows,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
