// ============================================================================
// Image adapter — pure OCR via Tesseract for .png / .jpg / .tif
// ============================================================================

import { OcrService } from '../../services/OcrService';
import type { DocumentAdapter, ExtractionOptions } from '../types';

export class ImageAdapter implements DocumentAdapter {
  async extract(input: File | Blob, options?: ExtractionOptions) {
    options?.onProgress?.({ stage: 'image-ocr', pct: 0, message: 'OCR de l\'image...' });

    const result = await OcrService.recognizeImage(input);

    options?.onProgress?.({
      stage: 'image-ocr',
      pct: 1,
      message: result.success ? 'OCR terminé' : `Échec OCR: ${result.error}`,
    });

    if (!result.success) {
      return { text: '', pages: 1 };
    }

    return {
      text: result.text,
      pages: 1,
    };
  }
}
