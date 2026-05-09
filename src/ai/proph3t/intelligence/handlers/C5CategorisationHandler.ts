// ============================================================================
// ATLASBANX - C5 Handler: Categorisation des operations
// Zone: Orange (proposition, validation humaine requise)
// Pipeline 3 passes: 1. Match exact (regex) → 2. Embedding (stub) → 3. LLM (stub)
// Baseline V1: wraps DeterministicPreFilter for pass 1, stubs passes 2-3
// ============================================================================

import type { C5Input, C5Output } from '../types';
import { DeterministicPreFilter } from '../../DeterministicPreFilter';
import { RUBRICS_CATEGORY_MAP } from './rubricMapping';
import { isLlmAvailable, llmCallJson } from '../llmEnricher';

// Singleton pre-filter instance
let preFilter: DeterministicPreFilter | null = null;

function getPreFilter(): DeterministicPreFilter {
  if (!preFilter) {
    preFilter = new DeterministicPreFilter();
  }
  return preFilter;
}

// ----------------------------------------------------------------------------
// Category → rubric_code mapping
// The DeterministicPreFilter returns broad category strings like
// "Frais bancaires", "Commissions", etc. We map these to the closest
// rubric_code from the 180-rubric taxonomy.
// ----------------------------------------------------------------------------

function mapCategoryToRubric(
  category: string,
  label: string,
): string {
  // Try specific sub-mapping based on label keywords
  const normalizedLabel = label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [pattern, rubricCode] of LABEL_TO_RUBRIC) {
    if (pattern.test(normalizedLabel)) {
      return rubricCode;
    }
  }

  // Fall back to broad category mapping
  return RUBRICS_CATEGORY_MAP[category] ?? 'non_classifie';
}

// Fine-grained label → rubric mappings (ordered by specificity)
const LABEL_TO_RUBRIC: Array<[RegExp, string]> = [
  // Compte
  [/TENUE\s*(DE\s*)?COMPTE|TDC/, 'compte.tenue_mensuelle'],
  [/FRAIS?\s*GESTION\s*COMPTE/, 'compte.tenue_mensuelle'],
  [/COTIS(ATION)?\s*COMPTE/, 'compte.tenue_mensuelle'],
  [/RELEVE|EXTRAIT/, 'compte.releve_mensuel'],
  [/ATTESTATION\s*SOLDE/, 'compte.attestation_solde'],
  [/ATTESTATION\s*BANCAIRE/, 'compte.attestation_bancaire'],

  // Decouverts
  [/AGIOS?/, 'decouverts.taux_autorise'],
  [/INTER[EE]TS?\s*DEB/, 'decouverts.taux_autorise'],
  [/INTER[EE]TS?\s*CRED/, 'decouverts.taux_autorise'],
  [/PENALITE\s*DECOUVERT/, 'decouverts.penalite_non_autorise'],
  [/COM(MISSION)?S?\s*(DE\s*)?MOUVEMENT|COM[\s/]*MVT/, 'decouverts.commission_mouvement'],
  [/CPFD|PLUS\s*FORT\s*DECOUVERT/, 'decouverts.cpfd'],
  [/COM(MISSION)?\s*INTERVENTION/, 'decouverts.commission_intervention'],

  // Cartes
  [/COTIS(ATION)?\s*CARTE/, 'cartes.cotisation_debit'],
  [/FRAIS?\s*(DE\s*)?CARTE/, 'cartes.cotisation_debit'],
  [/RENOUVELLEMENT\s*CARTE/, 'cartes.renouvellement_anticipe'],
  [/ASSURANCE\s*CARTE/, 'cartes.cotisation_debit'],
  [/RETRAIT\s*(DAB|GAB|DISTRIBUTEUR)/, 'cartes.retrait_dab_national'],
  [/\bDAB\b|\bGAB\b/, 'cartes.retrait_dab_national'],
  [/PAIEMENT\s*(PAR\s*)?CARTE|\bCB\b.*PAIEMENT/, 'cartes.paiement_tpe_national'],
  [/OPPOSITION\s*CARTE/, 'cartes.opposition'],

  // Virements
  [/VIR(EMENT)?\s*(INT(ERN)?|INTERNATIONAL)/, 'virements.international'],
  [/SWIFT/, 'virements.international'],
  [/VIR(EMENT)?\s*INTERNE/, 'virements.intra_banque'],
  [/VIR(EMENT)?\s*(NAT|NATIONAL)/, 'virements.national'],
  [/VIR(EMENT)?\s*(EMIS|EMIT|SORTANT)/, 'virements.national'],
  [/VIR(EMENT)?\s*(RECU|REC|RECEP)/, 'virements.intra_banque'],
  [/VIR(EMENT)?\s*PERMANENT/, 'virements.permanent'],
  [/ORDRE\s*VIR/, 'virements.national'],
  [/TRANSFERT?\s*INTERNATIONAL/, 'virements.international'],

  // Cheques
  [/REMISE?\s*(DE\s*)?CHEQUE/, 'cheques.remise_cheque'],
  [/ENCAISSEMENT\s*CHEQUE/, 'cheques.remise_cheque'],
  [/EMISSION\s*CHEQUE/, 'cheques.emission_cheque'],
  [/CHQ\s*\d+/, 'cheques.emission_cheque'],
  [/FRAIS?\s*(DE\s*)?CHEQUE/, 'cheques.frais_chequier'],

  // E-banking
  [/E-?BANKING|INTERNET\s*BANKING/, 'ebanking.abonnement'],
  [/SMS|ALERTE/, 'ebanking.alerte_sms'],

  // Credits
  [/FRAIS?\s*DOSSIER\s*(CR|PRET|CREDIT)?/, 'credits.frais_dossier'],

  // Taxes
  [/\bTVA\b/, 'divers.tva_services'],
  [/TAXE\s*SUR\s*FRAIS|\bTSF\b/, 'divers.tva_services'],
  [/IMPOT|FISC/, 'divers.tva_services'],

  // Especes
  [/VERSEMENT\s*ESPECES/, 'especes.versement'],
  [/RETRAIT\s*ESPECES/, 'especes.retrait_guichet'],

  // Mobile Money (use strict patterns to avoid matching "COM/MVT" via OM)
  [/MOBILE\s*MONEY/, 'virements.mobile_money'],
  [/\bMOMO\b/, 'virements.mobile_money'],
  [/MTN\s*MONEY/, 'virements.mobile_money'],
  [/ORANGE\s*MONEY/, 'virements.mobile_money'],
];

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC5(input: C5Input): C5Output {
  const filter = getPreFilter();

  const categorized: C5Output['categorized'] = [];
  const uncategorized: C5Output['uncategorized'] = [];

  for (const op of input.operations) {
    const match = filter.categorize(op.label);

    if (match) {
      const rubricCode = mapCategoryToRubric(match.category, op.label);
      categorized.push({
        operation_id: op.id,
        rubric_code: rubricCode,
        confidence: Math.round(match.confidence * 100),
        match_method: 'exact',
      });
    } else {
      uncategorized.push({
        operation_id: op.id,
        candidates: [],
      });
    }
  }

  return { categorized, uncategorized };
}

// ----------------------------------------------------------------------------
// LLM-enriched categorisation (pass 3)
// ----------------------------------------------------------------------------

const C5_SYSTEM_PROMPT = `Tu es un expert comptable specialise dans la categorisation d'operations bancaires CEMAC/UEMOA.

Pour chaque operation non categorisee, attribue le code rubrique le plus probable parmi la taxonomie.
Les codes rubriques suivent le format "categorie.sous_rubrique" (ex: "compte.tenue_mensuelle", "virements.international", "cartes.cotisation_debit").

Categories principales : compte, decouverts, cartes, virements, cheques, credits, ebanking, especes, divers.

Reponds UNIQUEMENT en JSON valide : [{"id":"...","rubric_code":"...","confidence":0-100}]`;

interface LlmCategorizationResult {
  id: string;
  rubric_code: string;
  confidence: number;
}

/**
 * Async version with LLM pass 3 for uncategorized operations.
 * Falls back to pure deterministic if LLM unavailable.
 */
export async function handleC5WithLlm(input: C5Input): Promise<C5Output> {
  const baseline = handleC5(input);

  if (!isLlmAvailable() || baseline.uncategorized.length === 0) return baseline;

  // Build LLM prompt with uncategorized operations
  const uncategorizedOps = input.operations.filter(op =>
    baseline.uncategorized.some(u => u.operation_id === op.id)
  );

  if (uncategorizedOps.length === 0) return baseline;

  // Batch: max 30 operations per LLM call
  const batch = uncategorizedOps.slice(0, 30);
  const userPrompt = `Categorise ces operations bancaires :\n${JSON.stringify(
    batch.map(op => ({ id: op.id, label: op.label, amount: op.amount }))
  )}`;

  const llmResult = await llmCallJson<LlmCategorizationResult[]>(
    C5_SYSTEM_PROMPT,
    userPrompt,
    ['id', 'rubric_code'],
    { role: 'fast', temperature: 0.1, maxTokens: 2000 },
  );

  if (!llmResult) return baseline;

  // Merge LLM results into baseline
  const llmMap = new Map(llmResult.data.map(r => [r.id, r]));
  const newCategorized = [...baseline.categorized];
  const stillUncategorized: C5Output['uncategorized'] = [];

  for (const uc of baseline.uncategorized) {
    const llmMatch = llmMap.get(uc.operation_id);
    if (llmMatch && llmMatch.confidence >= 50) {
      newCategorized.push({
        operation_id: uc.operation_id,
        rubric_code: llmMatch.rubric_code,
        confidence: Math.min(llmMatch.confidence, 85), // Cap LLM confidence
        match_method: 'llm',
      });
    } else {
      stillUncategorized.push({
        operation_id: uc.operation_id,
        candidates: llmMatch
          ? [{ rubric_code: llmMatch.rubric_code, score: llmMatch.confidence }]
          : [],
      });
    }
  }

  return { categorized: newCategorized, uncategorized: stillUncategorized };
}
