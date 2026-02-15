import { createWorker, Worker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface OcrResult {
  success: boolean;
  text: string;
  confidence: number;
  error?: string;
}

export interface OcrProgress {
  status: string;
  progress: number;
}

export class OcrService {
  private static worker: Worker | null = null;
  private static isInitializing = false;

  /**
   * Initialize Tesseract worker (lazy loading)
   */
  private static async getWorker(): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.worker!;
    }

    this.isInitializing = true;

    try {
      this.worker = await createWorker('fra+eng', 1, {
        logger: (m) => {
          console.log('[OCR]', m.status, Math.round((m.progress || 0) * 100) + '%');
        },
      });

      return this.worker;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Perform OCR on an image file
   */
  static async recognizeImage(
    imageSource: File | Blob | string,
    onProgress?: (progress: OcrProgress) => void
  ): Promise<OcrResult> {
    try {
      const worker = await this.getWorker();

      // Convert File to data URL if needed
      let source: string | Blob = imageSource;
      if (imageSource instanceof File) {
        source = await this.fileToDataUrl(imageSource);
      }

      onProgress?.({ status: 'Reconnaissance OCR en cours...', progress: 0 });

      const result = await worker.recognize(source);

      onProgress?.({ status: 'Terminé', progress: 100 });

      return {
        success: true,
        text: result.data.text,
        confidence: result.data.confidence,
      };
    } catch (error) {
      return {
        success: false,
        text: '',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Erreur OCR inconnue',
      };
    }
  }

  /**
   * Perform OCR on a PDF file (converts each page to image first)
   */
  static async recognizePdf(
    file: File,
    onProgress?: (progress: OcrProgress) => void
  ): Promise<OcrResult> {
    try {
      onProgress?.({ status: 'Chargement du PDF...', progress: 0 });

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const allText: string[] = [];
      let totalConfidence = 0;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        onProgress?.({
          status: `Traitement page ${pageNum}/${pdf.numPages}...`,
          progress: ((pageNum - 1) / pdf.numPages) * 100,
        });

        const page = await pdf.getPage(pageNum);

        // Render page to canvas
        const scale = 2; // Higher scale = better OCR quality
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png');
        });

        // Perform OCR on this page
        const result = await this.recognizeImage(blob);

        if (result.success) {
          allText.push(result.text);
          totalConfidence += result.confidence;
        }
      }

      onProgress?.({ status: 'Terminé', progress: 100 });

      return {
        success: true,
        text: allText.join('\n\n--- Page suivante ---\n\n'),
        confidence: totalConfidence / pdf.numPages,
      };
    } catch (error) {
      return {
        success: false,
        text: '',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Erreur OCR PDF inconnue',
      };
    }
  }

  /**
   * Check if a PDF contains extractable text or is image-based
   */
  static async isPdfImageBased(file: File): Promise<boolean> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Check first page for text content
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();

      // If very little text found, likely image-based
      const textLength = textContent.items
        .filter((item): item is { str: string } => 'str' in item)
        .reduce((acc, item) => acc + item.str.length, 0);

      // Less than 50 characters on first page suggests scanned PDF
      return textLength < 50;
    } catch {
      return true; // Assume image-based if we can't determine
    }
  }

  /**
   * Convert File to data URL
   */
  private static fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Terminate the OCR worker (call when done with OCR operations)
   */
  static async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
