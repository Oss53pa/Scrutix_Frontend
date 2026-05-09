// ============================================================================
// ATLASBANX - PROPH3T Intelligence Orchestrator
// Dispatches IntelligenceRequest to the correct competence handler.
// No business logic here — pure routing + validation + trace assembly.
// Ref: CDC PROPH3T v1.0, Section 3 (Architecture couche 2)
// ============================================================================

import type {
  IntelligenceRequest,
  IntelligenceResponse,
  IntelligenceError,
  IntelligenceTrace,
  IntelligenceModel,
  CompetenceIOMap,
} from './types';
import {
  CompetenceId,
  COMPETENCE_VERSIONS,
  COMPETENCE_ZONES,
  COMPETENCE_LABELS,
} from './types';
import {
  IntelligenceRequestSchema,
  COMPETENCE_INPUT_SCHEMAS,
  COMPETENCE_OUTPUT_SCHEMAS,
} from './schemas';
import { isLlmAvailable } from './llmEnricher';
import { handleC1 } from './handlers/C1ExtractionCGHandler';
import { handleC2 } from './handlers/C2ConventionHandler';
import { handleC3 } from './handlers/C3AvenantHandler';
import { handleC4 } from './handlers/C4OcrHandler';
import { handleC5, handleC5WithLlm } from './handlers/C5CategorisationHandler';
import { handleC6 } from './handlers/C6IdentificationHandler';
import { handleC7 } from './handlers/C7DimensionsHandler';
import { handleC8, handleC8WithLlm } from './handlers/C8ExplicationHandler';
import { handleC9, handleC9WithLlm } from './handlers/C9RapportHandler';
import { handleC10, handleC10WithLlm } from './handlers/C10QAHandler';
import { handleC11 } from './handlers/C11AnomaliesHandler';
import { handleC12 } from './handlers/C12FraudHandler';
import { handleC13 } from './handlers/C13MappingHandler';
import { handleC14 } from './handlers/C14AssistantHandler';
import type {
  C1Input, C2Input, C3Input, C4Input, C5Input, C6Input, C7Input,
  C8Input, C9Input, C10Input, C11Input, C12Input, C13Input, C14Input,
} from './types';

// ----------------------------------------------------------------------------
// Hash utility
// ----------------------------------------------------------------------------

async function sha256Short(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// ----------------------------------------------------------------------------
// Orchestrator
// ----------------------------------------------------------------------------

export type OrchestratorResult =
  | { success: true; response: IntelligenceResponse }
  | { success: false; error: IntelligenceError };

export async function orchestrate(req: IntelligenceRequest): Promise<OrchestratorResult> {
  const startMs = performance.now();

  // 1. Validate request envelope
  const envelopeResult = IntelligenceRequestSchema.safeParse(req);
  if (!envelopeResult.success) {
    return {
      success: false,
      error: {
        error: `Requete invalide: ${envelopeResult.error.issues[0]?.message ?? 'schema error'}`,
        code: 'VALIDATION_FAILED',
        competence_id: req.competence_id,
        details: { issues: envelopeResult.error.issues },
      },
    };
  }

  // 2. Validate context against competence-specific input schema
  const inputSchema = COMPETENCE_INPUT_SCHEMAS[req.competence_id as CompetenceId];
  if (inputSchema) {
    const inputResult = inputSchema.safeParse(req.context);
    if (!inputResult.success) {
      return {
        success: false,
        error: {
          error: `Context invalide pour ${COMPETENCE_LABELS[req.competence_id as CompetenceId]}: ${inputResult.error.issues[0]?.message}`,
          code: 'VALIDATION_FAILED',
          competence_id: req.competence_id,
          details: { issues: inputResult.error.issues },
        },
      };
    }
  }

  // 3. Dispatch to handler
  let output: unknown;
  let modelUsed: IntelligenceModel = 'ollama-qwen2.5-7b';
  let tokensIn = 0;
  let tokensOut = 0;
  let confidenceScore = 0;

  try {
    switch (req.competence_id) {
      case CompetenceId.EXTRACTION_CG: {
        const result = handleC1(req.context as C1Input);
        output = result;
        modelUsed = 'tesseract'; // C1 baseline is regex, no LLM
        const extracted = result.extracted_conditions.filter(c => c.value_numeric !== null);
        confidenceScore = extracted.length > 0
          ? Math.round(extracted.reduce((s, c) => s + c.confidence, 0) / extracted.length)
          : 0;
        break;
      }

      case CompetenceId.EXTRACTION_CONVENTIONS: {
        const result = handleC2(req.context as C2Input);
        output = result;
        modelUsed = 'tesseract';
        const c2Extracted = result.extracted_conditions.filter(c => c.value_numeric !== null);
        confidenceScore = c2Extracted.length > 0
          ? Math.round(c2Extracted.reduce((s, c) => s + c.confidence, 0) / c2Extracted.length)
          : 0;
        break;
      }

      case CompetenceId.EXTRACTION_AVENANTS: {
        const result = handleC3(req.context as C3Input);
        output = result;
        modelUsed = 'tesseract';
        confidenceScore = result.engagement_score;
        break;
      }

      case CompetenceId.OCR_AUGMENTE: {
        const result = handleC4(req.context as C4Input);
        output = result;
        modelUsed = 'tesseract';
        const avgConf = result.pages.length > 0
          ? Math.round(result.pages.reduce((s, p) => s + p.overall_confidence, 0) / result.pages.length)
          : 0;
        confidenceScore = avgConf;
        break;
      }

      case CompetenceId.CATEGORISATION: {
        const result = isLlmAvailable()
          ? await handleC5WithLlm(req.context as C5Input)
          : handleC5(req.context as C5Input);
        output = result;
        modelUsed = result.categorized.some(c => c.match_method === 'llm') ? 'ollama-qwen2.5-7b' : 'tesseract';
        const total = result.categorized.length + result.uncategorized.length;
        confidenceScore = total > 0
          ? Math.round(result.categorized.reduce((s, c) => s + c.confidence, 0) / Math.max(1, total))
          : 0;
        break;
      }

      case CompetenceId.IDENTIFICATION: {
        const result = handleC6(req.context as C6Input);
        output = result;
        modelUsed = 'tesseract'; // C6 baseline is heuristic, no LLM
        confidenceScore = Math.max(
          result.detected_bank.confidence,
          result.detected_document_type.confidence,
        );
        break;
      }

      case CompetenceId.DIMENSIONS_TARIFAIRES: {
        const result = handleC7(req.context as C7Input);
        output = result;
        modelUsed = 'tesseract';
        confidenceScore = result.dimensions.length > 0
          ? Math.round(result.dimensions.reduce((s, d) => s + d.confidence, 0) / result.dimensions.length)
          : 0;
        break;
      }

      case CompetenceId.EXPLICATION_ECARTS: {
        const result = isLlmAvailable()
          ? await handleC8WithLlm(req.context as C8Input)
          : handleC8(req.context as C8Input);
        output = result;
        modelUsed = isLlmAvailable() ? 'ollama-qwen2.5-7b' : 'tesseract';
        confidenceScore = 85;
        break;
      }

      case CompetenceId.RAPPORT_AUDIT: {
        const result = isLlmAvailable()
          ? await handleC9WithLlm(req.context as C9Input)
          : handleC9(req.context as C9Input);
        output = result;
        modelUsed = isLlmAvailable() ? 'ollama-qwen2.5-7b' : 'tesseract';
        confidenceScore = result.validation_ok ? 90 : 50;
        break;
      }

      case CompetenceId.QA_CONVERSATIONNEL: {
        const result = isLlmAvailable()
          ? await handleC10WithLlm(req.context as C10Input)
          : handleC10(req.context as C10Input);
        output = result;
        modelUsed = isLlmAvailable() ? 'ollama-qwen2.5-7b' : 'tesseract';
        confidenceScore = result.requires_investigation ? 20 : 75;
        break;
      }

      case CompetenceId.ANOMALIES_STATS: {
        const result = handleC11(req.context as C11Input);
        output = result;
        modelUsed = 'tesseract'; // C11 baseline is TS-based stats
        confidenceScore = result.anomalies.length > 0
          ? Math.round(result.anomalies.reduce((s, a) => s + a.confidence, 0) / result.anomalies.length)
          : 100; // No anomalies = high confidence in clean data
        break;
      }

      case CompetenceId.PATTERNS_FRAUDULEUX: {
        const result = handleC12(req.context as C12Input);
        output = result;
        modelUsed = 'tesseract'; // C12 baseline is rule-based TS
        confidenceScore = result.patterns.length > 0
          ? Math.round(result.patterns.reduce((s, p) => s + p.confidence, 0) / result.patterns.length)
          : 100;
        break;
      }

      case CompetenceId.MAPPING_RUBRIQUES: {
        const result = handleC13(req.context as C13Input);
        output = result;
        modelUsed = 'tesseract'; // C13 baseline is text similarity
        confidenceScore = result.best_match?.confidence ?? 0;
        break;
      }

      case CompetenceId.ASSISTANT_SAISIE: {
        const result = handleC14(req.context as C14Input);
        output = result;
        modelUsed = 'tesseract'; // C14 baseline is rule-based
        confidenceScore = result.suggestions.length > 0 ? 80 : 100;
        break;
      }

      // --- Competences not yet implemented ---
      default: {
        const zone = COMPETENCE_ZONES[req.competence_id as CompetenceId];
        const label = COMPETENCE_LABELS[req.competence_id as CompetenceId];
        output = {
          _stub: true,
          message: `Competence "${label}" (C${req.competence_id}) non encore implementee.`,
          zone,
          requires_validation: zone === 'orange',
        };
        confidenceScore = 0;
        break;
      }
    }
  } catch (err) {
    return {
      success: false,
      error: {
        error: err instanceof Error ? err.message : 'Erreur interne du handler',
        code: 'INTERNAL',
        competence_id: req.competence_id,
      },
    };
  }

  // 4. Validate output schema (if defined)
  const outputSchema = COMPETENCE_OUTPUT_SCHEMAS[req.competence_id as CompetenceId];
  if (outputSchema && output && !(output as Record<string, unknown>)._stub) {
    const outputResult = outputSchema.safeParse(output);
    if (!outputResult.success) {
      return {
        success: false,
        error: {
          error: `Sortie du handler invalide: ${outputResult.error.issues[0]?.message}`,
          code: 'VALIDATION_FAILED',
          competence_id: req.competence_id,
          details: { issues: outputResult.error.issues },
        },
      };
    }
  }

  // 5. Build trace
  const durationMs = Math.round(performance.now() - startMs);
  const promptHash = await sha256Short(JSON.stringify(req.context).slice(0, 500));
  const competenceVersion = COMPETENCE_VERSIONS[req.competence_id as CompetenceId] ?? '0.0.0';

  const trace: IntelligenceTrace = {
    model_used: modelUsed,
    competence_version: competenceVersion,
    prompt_hash: promptHash,
    confidence_score: confidenceScore,
    duration_ms: durationMs,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  };

  return {
    success: true,
    response: { output, trace },
  };
}

// ----------------------------------------------------------------------------
// Convenience: type-safe dispatch (for internal TS callers)
// ----------------------------------------------------------------------------

export async function dispatch<K extends CompetenceId>(
  competenceId: K,
  context: CompetenceIOMap[K]['input'],
  userId: string,
  organizationId: string,
): Promise<OrchestratorResult> {
  return orchestrate({
    competence_id: competenceId,
    context: context as Record<string, unknown>,
    user_id: userId,
    organization_id: organizationId,
  });
}
