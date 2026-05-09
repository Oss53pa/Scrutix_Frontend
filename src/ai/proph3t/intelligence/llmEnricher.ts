// ============================================================================
// ATLASBANX - PROPH3T LLM Enricher
// Wrapper leger pour enrichir les sorties des handlers via Proph3tEngine.
// Graceful fallback: si Ollama est indisponible, retourne null silencieusement.
// ============================================================================

import type { Proph3tEngine } from '../Proph3tEngine';
import type { Proph3tModelRole } from '../types';
import { JsonValidator } from '../JsonValidator';

export interface LlmCallOptions {
  role?: Proph3tModelRole;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LlmResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

// Singleton engine reference (set by orchestrator at startup)
let _engine: Proph3tEngine | null = null;

export function setLlmEngine(engine: Proph3tEngine | null): void {
  _engine = engine;
}

export function getLlmEngine(): Proph3tEngine | null {
  return _engine;
}

export function isLlmAvailable(): boolean {
  return _engine !== null;
}

/**
 * Call the LLM with graceful fallback.
 * Returns null if engine unavailable or call fails.
 */
export async function llmCall(
  systemPrompt: string,
  userPrompt: string,
  options: LlmCallOptions = {},
): Promise<LlmResult | null> {
  if (!_engine) return null;

  try {
    const result = await _engine.callWithRole(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        role: options.role ?? 'fast',
        temperature: options.temperature ?? 0.3,
        maxTokens: options.maxTokens ?? 2000,
      },
    );

    return {
      content: result.content,
      tokensIn: result.inputTokens,
      tokensOut: result.outputTokens,
      model: 'ollama', // Actual model resolved by engine
    };
  } catch {
    // Graceful fallback — LLM unavailable or error
    return null;
  }
}

/**
 * Call the LLM and parse JSON response.
 * Returns null if engine unavailable, call fails, or JSON invalid.
 */
export async function llmCallJson<T>(
  systemPrompt: string,
  userPrompt: string,
  requiredKeys: string[] = [],
  options: LlmCallOptions = {},
): Promise<{ data: T; tokensIn: number; tokensOut: number } | null> {
  const result = await llmCall(systemPrompt, userPrompt, {
    ...options,
    jsonMode: true,
  });

  if (!result) return null;

  const parsed = JsonValidator.parseAndValidate<T>(result.content, requiredKeys);
  if (!parsed) return null;

  return {
    data: parsed,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
  };
}

/**
 * Double-pass anti-hallucination for numeric extraction.
 * Runs two passes at different temperatures, flags divergence > threshold.
 */
export async function llmDoublePass(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; divergenceThreshold?: number } = {},
): Promise<{
  pass1: string;
  pass2: string;
  divergent: boolean;
  divergenceDetails?: string;
} | null> {
  if (!_engine) return null;

  const threshold = options.divergenceThreshold ?? 0.05;

  try {
    // Pass 1: T=0.0 (deterministic)
    const pass1 = await llmCall(systemPrompt, userPrompt, {
      role: 'reasoning',
      temperature: 0.0,
      maxTokens: options.maxTokens ?? 4000,
    });
    if (!pass1) return null;

    // Pass 2: T=0.3 (slight variation)
    const pass2 = await llmCall(systemPrompt, userPrompt, {
      role: 'reasoning',
      temperature: 0.3,
      maxTokens: options.maxTokens ?? 4000,
    });
    if (!pass2) return null;

    // Compare numeric values
    const nums1 = extractNumbers(pass1.content);
    const nums2 = extractNumbers(pass2.content);

    let divergent = false;
    let divergenceDetails: string | undefined;

    if (nums1.length > 0 && nums2.length > 0) {
      for (let i = 0; i < Math.min(nums1.length, nums2.length); i++) {
        if (nums1[i] === 0 && nums2[i] === 0) continue;
        const base = Math.max(Math.abs(nums1[i]), Math.abs(nums2[i]));
        const diff = Math.abs(nums1[i] - nums2[i]) / base;
        if (diff > threshold) {
          divergent = true;
          divergenceDetails = `Valeur #${i + 1}: pass1=${nums1[i]}, pass2=${nums2[i]}, divergence=${(diff * 100).toFixed(1)}%`;
          break;
        }
      }
    }

    return {
      pass1: pass1.content,
      pass2: pass2.content,
      divergent,
      divergenceDetails,
    };
  } catch {
    return null;
  }
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d[\d\s\u00A0.,]*\d/g) ?? [];
  return matches
    .map(m => parseFloat(m.replace(/[\s\u00A0]/g, '').replace(',', '.')))
    .filter(n => !isNaN(n));
}
