// ============================================================================
// ATLASBANX — Generic position-aware Conditions extractor
// ============================================================================
// Pipeline:
//   1. Read PDF with pdfjs → items[] with X/Y per page (OCR fallback for
//      scanned docs)
//   2. Extract label-value pairs row by row using positions
//      (LabelValueExtractor)
//   3. Match each pair to the best-fitting FieldDefinition in the registry
//      (RubricMatcher)
//   4. Return a result with the best match per rubric, all raw pairs
//      (for diagnostic UI), section headers, and stats.
//
// Works on any bank format because:
//   • No hardcoded column positions
//   • No bank-specific patterns required
//   • Generic label-similarity + unit/range sanity checks
//   • Section context disambiguation
// ============================================================================

import { pdfjsLib } from '../../services/pdfjsWorker';
import { OcrService } from '../../services/OcrService';
import type { PositionedItem } from '../bank-statement/types';
import { extractLabelValuePairs } from './LabelValueExtractor';
import { matchRubrics } from './RubricMatcher';
import type { ConditionsExtractionResult } from './types';

export interface ConditionsExtractionOptions {
  /** Force OCR even with a text layer */
  forceOcr?: boolean;
  /** Skip OCR entirely (faster but fails on scans) */
  skipOcr?: boolean;
  /** Bank code hint (used by future per-bank templates) */
  bankCode?: string;
  onProgress?: (p: { stage: string; pct: number; message: string }) => void;
}

export async function extractConditions(
  file: File,
  options: ConditionsExtractionOptions = {},
): Promise<ConditionsExtractionResult> {
  const start = performance.now();
  const warnings: string[] = [];

  options.onProgress?.({ stage: 'load', pct: 0, message: 'Lecture du PDF...' });

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const items: PositionedItem[] = [];
  let totalChars = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const text = (it as { str: string }).str;
      if (!text || !text.trim()) continue;
      const transform = (it as { transform?: number[] }).transform;
      const x = transform?.[4] ?? 0;
      const y = transform?.[5] ?? 0;
      const width = (it as { width?: number }).width ?? text.length * 4;
      const height = (it as { height?: number }).height ?? 8;
      items.push({ text, page: p, x, y, width, height });
      totalChars += text.length;
    }
    options.onProgress?.({
      stage: 'load',
      pct: p / pdf.numPages,
      message: `Lecture page ${p}/${pdf.numPages}`,
    });
  }

  // OCR fallback if the PDF has no text layer
  const avgPerPage = totalChars / Math.max(1, pdf.numPages);
  const needsOcr = options.forceOcr || (!options.skipOcr && avgPerPage < 50);

  if (needsOcr) {
    warnings.push('PDF scanné détecté — extraction par OCR (positions limitées)');
    options.onProgress?.({ stage: 'ocr', pct: 0, message: 'OCR en cours...' });

    // For scanned conditions docs we OCR each page and synthesize
    // pseudo-positions: each line gets its own Y, words within a line
    // share the same Y, X = column index × estimated char width.
    // This is good enough for the "rightmost amount = value" heuristic.
    items.length = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      const result = await OcrService.recognizeImage(blob);
      if (!result.success) continue;

      const lines = result.text.split('\n');
      const lineHeight = 12;
      const charWidth = 5;
      lines.forEach((line, lineIdx) => {
        const y = (lines.length - lineIdx) * lineHeight; // top-to-bottom → big Y first
        let x = 0;
        for (const word of line.split(/\s+/)) {
          if (!word) continue;
          items.push({
            text: word,
            page: p,
            x,
            y,
            width: word.length * charWidth,
            height: lineHeight,
          });
          x += (word.length + 1) * charWidth;
        }
      });

      options.onProgress?.({
        stage: 'ocr',
        pct: p / pdf.numPages,
        message: `OCR page ${p}/${pdf.numPages}`,
      });
    }
  }

  options.onProgress?.({ stage: 'pairs', pct: 0.6, message: 'Extraction des paires label/valeur...' });

  const { pairs, sections } = extractLabelValuePairs(items, pdf.numPages);

  options.onProgress?.({
    stage: 'match',
    pct: 0.85,
    message: `${pairs.length} paires détectées, mise en correspondance...`,
  });

  const { matches } = matchRubrics(pairs);
  const matchedFields = Object.keys(matches);
  const avgConf =
    matchedFields.length === 0
      ? 0
      : matchedFields.reduce((s, k) => s + matches[k].confidence, 0) / matchedFields.length;

  // Compute pairs that were extracted but didn't match any rubric in the
  // registry. These are valuable signal: either real conditions we don't
  // model yet, or noisy lines. The UI surfaces them so the user can map
  // manually or request registry extension.
  const matchedPairKeys = new Set<string>();
  for (const m of Object.values(matches)) {
    matchedPairKeys.add(`${m.pair.page}-${Math.round(m.pair.y)}-${m.pair.label}`);
  }
  const unmatchedPairs = pairs.filter(
    (p) => !matchedPairKeys.has(`${p.page}-${Math.round(p.y)}-${p.label}`),
  );

  options.onProgress?.({
    stage: 'done',
    pct: 1,
    message: `${matchedFields.length} rubriques identifiées sur ${pairs.length} paires (${unmatchedPairs.length} non rattachées)`,
  });

  return {
    matches,
    rawPairs: pairs,
    unmatchedPairs,
    sections,
    stats: {
      totalPages: pdf.numPages,
      pairsFound: pairs.length,
      rubricsMatched: matchedFields.length,
      pairsUnmatched: unmatchedPairs.length,
      averageConfidence: avgConf,
      durationMs: Math.round(performance.now() - start),
    },
    warnings,
  };
}
