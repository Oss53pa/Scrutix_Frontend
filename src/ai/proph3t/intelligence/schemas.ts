// ============================================================================
// ATLASBANX - PROPH3T Intelligence Zod Schemas
// Validation stricte des requetes/reponses gateway
// ============================================================================

import { z } from 'zod';
import { CompetenceId } from './types';

// ----------------------------------------------------------------------------
// Gateway request validation
// ----------------------------------------------------------------------------

export const IntelligenceRequestSchema = z.object({
  competence_id: z.number().int().min(1).max(14) as z.ZodType<CompetenceId>,
  context: z.record(z.unknown()),
  client_consent_cloud: z.boolean().optional(),
  user_id: z.string().uuid(),
  organization_id: z.string().uuid(),
});

// ----------------------------------------------------------------------------
// Shared types
// ----------------------------------------------------------------------------

const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

const ConditionUnitSchema = z.enum(['percent', 'fcfa', 'days', 'count']);

const ConditionDimensionsSchema = z.object({
  montant_centimes: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  profil: z.enum(['particulier', 'pme', 'corporate']).optional(),
  duree_jours: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  garantie: z.string().optional(),
  devise: z.string().optional(),
  canal: z.enum(['agence', 'ebanking', 'mobile', 'atm']).optional(),
}).nullable();

const ConditionFormulaSchema = z.object({
  type: z.enum(['fixed', 'percentage', 'tiered', 'min_max', 'formula']),
  expression: z.string(),
  tiers: z.array(z.object({
    min: z.number(),
    max: z.number().nullable(),
    rate: z.number(),
    unit: ConditionUnitSchema,
  })).optional(),
}).nullable();

const ExtractedConditionSchema = z.object({
  rubric_code: z.string().min(1),
  raw_label: z.string(),
  value_numeric: z.number().nullable(),
  value_formula: ConditionFormulaSchema,
  unit: ConditionUnitSchema,
  dimensions: ConditionDimensionsSchema,
  pdf_page: z.number().int().positive(),
  pdf_bbox: BoundingBoxSchema,
  confidence: z.number().min(0).max(100),
  extraction_notes: z.string(),
});

// ----------------------------------------------------------------------------
// C1 — Extraction CG bancaires
// ----------------------------------------------------------------------------

export const C1InputSchema = z.object({
  pdf_url: z.string().url(),
  bank_id: z.string().min(1),
  effective_date_hint: z.string().optional(),
  language: z.literal('fr'),
  expected_taxonomy: z.array(z.string()),
});

export const C1OutputSchema = z.object({
  extracted_conditions: z.array(ExtractedConditionSchema),
  document_metadata: z.object({
    detected_bank: z.string(),
    detected_version: z.string(),
    detected_effective_date: z.string().nullable(),
    page_count: z.number().int().positive(),
    is_native_pdf: z.boolean(),
  }),
  unmapped_segments: z.array(z.object({
    page: z.number().int().positive(),
    bbox: BoundingBoxSchema,
    raw_text: z.string(),
  })),
});

// ----------------------------------------------------------------------------
// C2 — Extraction conventions client
// ----------------------------------------------------------------------------

export const C2InputSchema = C1InputSchema.extend({
  parent_group_ref: z.string().optional(),
});

export const C2OutputSchema = C1OutputSchema.extend({
  signatories: z.array(z.object({
    name: z.string(),
    role: z.string(),
    side: z.enum(['bank', 'client']),
  })),
  signature_date: z.string(),
  effective_period: z.object({
    from: z.string(),
    to: z.string().nullable(),
  }),
  account_numbers_concerned: z.array(z.string()),
  parent_group_agreement_ref: z.string().optional(),
  derogations: z.array(z.object({
    rubric_code: z.string(),
    bank_default_value: z.number(),
    derogated_value: z.number(),
    explicit_derogation_text: z.string(),
    pdf_bbox: BoundingBoxSchema,
  })),
});

// ----------------------------------------------------------------------------
// C3 — Extraction avenants
// ----------------------------------------------------------------------------

export const C3InputSchema = z.object({
  document_url: z.string(),
  format: z.enum(['pdf_signe', 'eml', 'image', 'texte_saisi']),
  bank_id: z.string().min(1),
  client_id: z.string().min(1),
  language: z.literal('fr'),
});

export const C3OutputSchema = z.object({
  engagement_score: z.number().min(0).max(100),
  conditions: z.array(ExtractedConditionSchema),
  effective_period: z.object({
    from: z.string(),
    to: z.string().nullable(),
  }).nullable(),
  source_text: z.string(),
  avenant_draft_created: z.boolean(),
});

// ----------------------------------------------------------------------------
// C5 — Categorisation operations
// ----------------------------------------------------------------------------

export const C5InputSchema = z.object({
  operations: z.array(z.object({
    id: z.string(),
    label: z.string(),
    amount: z.number(),
    date: z.string(),
    bank_code: z.string().optional(),
  })),
  bank_id: z.string().optional(),
});

export const C5OutputSchema = z.object({
  categorized: z.array(z.object({
    operation_id: z.string(),
    rubric_code: z.string(),
    confidence: z.number().min(0).max(100),
    match_method: z.enum(['exact', 'embedding', 'llm']),
  })),
  uncategorized: z.array(z.object({
    operation_id: z.string(),
    candidates: z.array(z.object({
      rubric_code: z.string(),
      score: z.number(),
    })),
  })),
});

// ----------------------------------------------------------------------------
// C6 — Identification banque/document
// ----------------------------------------------------------------------------

export const C6InputSchema = z.object({
  pdf_url: z.string().optional(),
  text_content: z.string().optional(),
  first_page_only: z.boolean().optional(),
}).refine(
  (data) => data.pdf_url || data.text_content,
  { message: 'pdf_url ou text_content requis' }
);

export const C6OutputSchema = z.object({
  detected_bank: z.object({
    code: z.string(),
    name: z.string(),
    confidence: z.number().min(0).max(100),
  }),
  detected_document_type: z.object({
    type: z.enum([
      'conditions_generales', 'convention', 'avenant', 'releve',
      'echelle_interets', 'decompte_frais', 'lettre_rm', 'non_bancaire',
    ]),
    confidence: z.number().min(0).max(100),
  }),
  signals: z.array(z.string()),
});

// ----------------------------------------------------------------------------
// C8 — Explication des ecarts
// ----------------------------------------------------------------------------

export const C8InputSchema = z.object({
  ecart: z.object({
    code: z.enum(['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08']),
    rubric: z.string(),
    expected_value: z.number(),
    actual_value: z.number(),
    delta_fcfa: z.number(),
    period: z.object({ from: z.string(), to: z.string() }),
    operations_concerned: z.array(z.record(z.unknown())),
    receipt: z.record(z.unknown()),
  }),
  audience: z.enum(['daf', 'comptable', 'dirigeant']),
  language: z.literal('fr'),
});

export const C8OutputSchema = z.object({
  short_description: z.string().min(1),
  detailed_explanation: z.string().min(1),
  legal_basis: z.string().nullable(),
  recommended_action: z.string().min(1),
  recoverability_assessment: z.enum(['forte', 'moyenne', 'faible']),
});

// ----------------------------------------------------------------------------
// C9 — Rapport audit
// ----------------------------------------------------------------------------

export const C9InputSchema = z.object({
  analysis_id: z.string(),
  client_name: z.string(),
  period: z.object({ from: z.string(), to: z.string() }),
  accounts: z.array(z.string()),
  ecarts: z.array(C8InputSchema.shape.ecart),
  tone: z.enum(['factuel', 'assertif', 'pedagogique']),
  language: z.literal('fr'),
});

export const C9OutputSchema = z.object({
  sections: z.object({
    page_de_garde: z.string(),
    resume_executif: z.string(),
    vue_par_categorie: z.string(),
    detail_ecarts_majeurs: z.string(),
    plan_action: z.string(),
    annexes: z.string(),
  }),
  total_ecarts: z.number(),
  montant_recuperable_estime: z.number(),
  validation_ok: z.boolean(),
  validation_errors: z.array(z.string()),
});

// ----------------------------------------------------------------------------
// C11 — Anomalies statistiques
// ----------------------------------------------------------------------------

export const C11OutputSchema = z.object({
  anomalies: z.array(z.object({
    operation_id: z.string(),
    anomaly_type: z.enum([
      'amount_outlier', 'frequency_anomaly', 'benford_deviation',
      'semantic_duplicate', 'temporal_irregularity',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    confidence: z.number().min(0).max(100),
    explanation: z.string(),
    suggested_investigation: z.string(),
  })),
});

// ----------------------------------------------------------------------------
// C12 — Patterns frauduleux
// ----------------------------------------------------------------------------

export const C12OutputSchema = z.object({
  patterns: z.array(z.object({
    pattern: z.enum([
      'plafonnement_sous_seuil', 'dv_defavorable_systematique',
      'libelles_rotatifs', 'decouvert_artificiel', 'frais_sans_contrepartie',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    confidence: z.number().min(0).max(100),
    affected_operations: z.array(z.string()),
    description: z.string(),
    evidence: z.string(),
  })),
});

// ----------------------------------------------------------------------------
// C13 — Mapping rubriques
// ----------------------------------------------------------------------------

export const C13InputSchema = z.object({
  label: z.string().min(1),
  bank_id: z.string().optional(),
  top_k: z.number().int().positive().default(5).optional(),
});

export const C13OutputSchema = z.object({
  mappings: z.array(z.object({
    rubric_code: z.string(),
    rubric_label: z.string(),
    score: z.number().min(0).max(100),
    justification: z.string(),
  })),
  best_match: z.object({
    rubric_code: z.string(),
    confidence: z.number().min(0).max(100),
  }).nullable(),
});

// ----------------------------------------------------------------------------
// Trace schema (validates every inference output trace)
// ----------------------------------------------------------------------------

export const IntelligenceTraceSchema = z.object({
  model_used: z.enum([
    'ollama-llama3.1-70b', 'ollama-qwen2.5-14b', 'ollama-qwen2.5-7b',
    'claude-sonnet', 'tesseract',
  ]),
  competence_version: z.string(),
  prompt_hash: z.string().min(1),
  confidence_score: z.number().min(0).max(100),
  duration_ms: z.number().int().nonnegative(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
});

// ----------------------------------------------------------------------------
// Input schema map (for gateway dispatch validation)
// ----------------------------------------------------------------------------

export const COMPETENCE_INPUT_SCHEMAS: Partial<Record<CompetenceId, z.ZodType>> = {
  [CompetenceId.EXTRACTION_CG]: C1InputSchema,
  [CompetenceId.EXTRACTION_CONVENTIONS]: C2InputSchema,
  [CompetenceId.EXTRACTION_AVENANTS]: C3InputSchema,
  [CompetenceId.CATEGORISATION]: C5InputSchema,
  [CompetenceId.IDENTIFICATION]: C6InputSchema,
  [CompetenceId.EXPLICATION_ECARTS]: C8InputSchema,
  [CompetenceId.RAPPORT_AUDIT]: C9InputSchema,
  [CompetenceId.MAPPING_RUBRIQUES]: C13InputSchema,
};

export const COMPETENCE_OUTPUT_SCHEMAS: Partial<Record<CompetenceId, z.ZodType>> = {
  [CompetenceId.EXTRACTION_CG]: C1OutputSchema,
  [CompetenceId.EXTRACTION_CONVENTIONS]: C2OutputSchema,
  [CompetenceId.EXTRACTION_AVENANTS]: C3OutputSchema,
  [CompetenceId.CATEGORISATION]: C5OutputSchema,
  [CompetenceId.IDENTIFICATION]: C6OutputSchema,
  [CompetenceId.EXPLICATION_ECARTS]: C8OutputSchema,
  [CompetenceId.RAPPORT_AUDIT]: C9OutputSchema,
  [CompetenceId.ANOMALIES_STATS]: C11OutputSchema,
  [CompetenceId.PATTERNS_FRAUDULEUX]: C12OutputSchema,
  [CompetenceId.MAPPING_RUBRIQUES]: C13OutputSchema,
};
