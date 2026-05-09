// ============================================================================
// ATLASBANX - useIntelligence Hook
// React hook pour dispatcher les 14 competences PROPH3T Intelligence
// ============================================================================

import { useState, useCallback, useRef } from 'react';
import {
  CompetenceId,
  COMPETENCE_LABELS,
  type CompetenceIOMap,
  type IntelligenceResponse,
  type IntelligenceError,
  type OrchestratorResult,
  orchestrate,
} from '../ai/proph3t/intelligence';
import { isLlmAvailable } from '../ai/proph3t/intelligence/llmEnricher';
import { useAuthStore } from '../store/authStore';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface IntelligenceState {
  loading: boolean;
  error: string | null;
  lastResult: IntelligenceResponse | null;
  lastCompetence: CompetenceId | null;
}

interface UseIntelligenceResult {
  /** Current state */
  loading: boolean;
  error: string | null;
  lastResult: IntelligenceResponse | null;

  /** Whether LLM enrichment is available */
  llmAvailable: boolean;

  /** Dispatch a competence (type-safe) */
  dispatch: <K extends CompetenceId>(
    competenceId: K,
    context: CompetenceIOMap[K]['input'],
  ) => Promise<OrchestratorResult>;

  /** Dispatch and extract typed output (throws on failure) */
  run: <K extends CompetenceId>(
    competenceId: K,
    context: CompetenceIOMap[K]['input'],
  ) => Promise<CompetenceIOMap[K]['output']>;

  /** Clear error and last result */
  reset: () => void;
}

// Placeholder IDs when auth is not configured
const ANON_USER_ID = 'a0000000-0000-4000-8000-000000000000';
const ANON_ORG_ID = 'a0000000-0000-4000-8000-000000000000';

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useIntelligence(): UseIntelligenceResult {
  const [state, setState] = useState<IntelligenceState>({
    loading: false,
    error: null,
    lastResult: null,
    lastCompetence: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const dispatch = useCallback(async <K extends CompetenceId>(
    competenceId: K,
    context: CompetenceIOMap[K]['input'],
  ): Promise<OrchestratorResult> => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Get user/org from auth store (fallback to anon)
      const authState = useAuthStore.getState();
      const userId = authState.user?.id ?? ANON_USER_ID;
      const organizationId = ANON_ORG_ID;

      const result = await orchestrate({
        competence_id: competenceId,
        context: context as Record<string, unknown>,
        user_id: userId,
        organization_id: organizationId,
      });

      if (result.success) {
        setState({
          loading: false,
          error: null,
          lastResult: result.response,
          lastCompetence: competenceId,
        });
      } else {
        setState({
          loading: false,
          error: result.error.error,
          lastResult: null,
          lastCompetence: competenceId,
        });
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setState({
        loading: false,
        error: message,
        lastResult: null,
        lastCompetence: competenceId,
      });
      return {
        success: false,
        error: {
          error: message,
          code: 'INTERNAL',
          competence_id: competenceId,
        },
      };
    }
  }, []);

  const run = useCallback(async <K extends CompetenceId>(
    competenceId: K,
    context: CompetenceIOMap[K]['input'],
  ): Promise<CompetenceIOMap[K]['output']> => {
    const result = await dispatch(competenceId, context);
    if (!result.success) {
      throw new Error(`${COMPETENCE_LABELS[competenceId]}: ${result.error.error}`);
    }
    return result.response.output as CompetenceIOMap[K]['output'];
  }, [dispatch]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      loading: false,
      error: null,
      lastResult: null,
      lastCompetence: null,
    });
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    lastResult: state.lastResult,
    llmAvailable: isLlmAvailable(),
    dispatch,
    run,
    reset,
  };
}
