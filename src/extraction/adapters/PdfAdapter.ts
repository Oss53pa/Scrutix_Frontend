// ============================================================================
// PDF adapter — handles both native (text-layer) and scanned PDFs.
// Falls back to OCR (Tesseract via OcrService) when the text layer is empty.
// ============================================================================

import { pdfjsLib } from '../../services/pdfjsWorker';
import { OcrService } from '../../services/OcrService';
import type { DocumentAdapter, ExtractionOptions } from '../types';

interface PageWord {
  text: string;
  x: number;
  y: number;
  page: number;
}

export class PdfAdapter implements DocumentAdapter {
  async extract(input: File | Blob | ArrayBuffer | string, options?: ExtractionOptions) {
    const data = await this.toArrayBuffer(input);
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    options?.onProgress?.({ stage: 'pdf', pct: 0, message: `PDF chargé (${pdf.numPages} pages)` });

    let nativeText = '';
    const words: PageWord[] = [];
    let totalChars = 0;

    // Pass 1: try native text layer
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const pageText = tc.items
        .map((it) => ('str' in it ? (it as { str: string }).str : ''))
        .join(' ');
      nativeText += pageText + '\n\n';
      totalChars += pageText.length;

      // Capture word positions for tabular reconstruction
      for (const it of tc.items) {
        if ('str' in it && (it as { str: string }).str.trim()) {
          const item = it as { str: string; transform?: number[] };
          const x = item.transform?.[4] ?? 0;
          const y = item.transform?.[5] ?? 0;
          words.push({ text: item.str, x, y, page: p });
        }
      }

      options?.onProgress?.({
        stage: 'pdf-native',
        pct: p / pdf.numPages,
        message: `Texte natif page ${p}/${pdf.numPages}`,
      });
    }

    // Heuristic: < 50 chars/page on average → likely scanned
    const avgPerPage = totalChars / Math.max(1, pdf.numPages);
    const needsOcr = !options?.skipOcr && avgPerPage < 50;

    if (!needsOcr) {
      return {
        text: nativeText,
        pages: pdf.numPages,
        words,
      };
    }

    // Pass 2: OCR each page
    options?.onProgress?.({
      stage: 'ocr',
      pct: 0,
      message: 'PDF scanné détecté — bascule sur OCR Tesseract',
    });

    let ocrText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const scale = 2;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      }).promise;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });

      const result = await OcrService.recognizeImage(blob);
      if (result.success) {
        ocrText += result.text + '\n\n';
      }

      options?.onProgress?.({
        stage: 'ocr',
        pct: p / pdf.numPages,
        message: `OCR page ${p}/${pdf.numPages}`,
      });
    }

    return {
      text: ocrText,
      pages: pdf.numPages,
      // No reliable word positions in OCR mode (Tesseract has them but the cost
      // of plumbing through is high; we let SemanticStrategy work on raw text)
    };
  }

  private async toArrayBuffer(input: File | Blob | ArrayBuffer | string): Promise<ArrayBuffer> {
    if (input instanceof ArrayBuffer) return input;
    if (input instanceof Blob || input instanceof File) return await input.arrayBuffer();
    if (typeof input === 'string') {
      // Assume base64
      const clean = input.replace(/^data:application\/pdf;base64,/, '');
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    throw new Error('PdfAdapter: input type not supported');
  }
}
