// ============================================================================
// ATLASBANX - C4 Handler: OCR augmente PDF scannes
// Zone: Orange
// Baseline V1: stub — requires external Tesseract/vision infrastructure
// Pipeline: Tesseract FR → table detection → LLM reconstitution → fallback Claude
// ============================================================================

import type { C4Input, C4Output, IntelligenceModel } from '../types';

// ----------------------------------------------------------------------------
// Public handler (stub)
// In production, this will:
// 1. Call Tesseract FR via worker/WASM
// 2. Detect tables via geometric heuristics
// 3. Send uncertain chars to Ollama for reconstitution
// 4. Fallback to Claude API vision if confidence < 70
// ----------------------------------------------------------------------------

export function handleC4(input: C4Input): C4Output {
  // V1 stub: returns structured placeholder indicating OCR is needed
  const requestedPages = input.pages ?? [1];

  return {
    pages: requestedPages.map(pageNum => ({
      page_number: pageNum,
      raw_text: '',
      tables: [],
      overall_confidence: 0,
    })),
    is_native_pdf: false,
    fallback_used: false,
  };
}
