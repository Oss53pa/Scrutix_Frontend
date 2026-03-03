// ============================================================================
// SCRUTIX - OCR Pipeline Orchestrator
// Chaine les 4 couches: Pre-analyse -> Extraction -> Validation -> Structuration
// ============================================================================

import { PreAnalysisLayer } from './PreAnalysisLayer';
import { ExtractionLayer } from './ExtractionLayer';
import { ValidationLayer } from './ValidationLayer';
import { StructurationLayer } from './StructurationLayer';
import type {
  OcrStructuredOutput,
  OcrPipelineOptions,
  OcrPipelineProgress,
} from './OcrPipelineTypes';
import type { BankTemplateConfig } from './TemplateExtractor';

/**
 * Pipeline OCR multi-couches
 * Orchestre le traitement: Pre-analyse -> Extraction -> Validation -> Structuration
 */
export class OcrPipeline {
  private preAnalysis: PreAnalysisLayer;
  private extraction: ExtractionLayer;
  private validation: ValidationLayer;
  private structuration: StructurationLayer;
  private templateRegistry: Map<string, BankTemplateConfig> = new Map();

  constructor() {
    this.preAnalysis = new PreAnalysisLayer();
    this.extraction = new ExtractionLayer();
    this.validation = new ValidationLayer();
    this.structuration = new StructurationLayer();
  }

  /**
   * Enregistre un template de banque
   */
  registerTemplate(template: BankTemplateConfig): void {
    this.templateRegistry.set(template.code, template);
  }

  /**
   * Traite un fichier a travers le pipeline complet
   */
  async process(
    rawText: string,
    options?: OcrPipelineOptions,
    wordBboxes?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>
  ): Promise<OcrStructuredOutput> {
    const progress = options?.onProgress;

    // =========================================================================
    // Layer 1: Pre-analyse
    // =========================================================================
    progress?.({
      layer: 'pre_analysis',
      progress: 0,
      message: 'Analyse du document...',
    });

    const preAnalysisStart = performance.now();
    const analysis = this.preAnalysis.analyze(rawText, wordBboxes);
    const preAnalysisTime = performance.now() - preAnalysisStart;

    // Override bank code if provided
    if (options?.bankCode) {
      analysis.bankCode = options.bankCode;
    }

    progress?.({
      layer: 'pre_analysis',
      progress: 1,
      message: `Document: ${analysis.docType}, Banque: ${analysis.bankName || 'non detectee'}`,
    });

    // =========================================================================
    // Layer 2: Extraction
    // =========================================================================
    progress?.({
      layer: 'extraction',
      progress: 0,
      message: `Extraction en mode ${analysis.recommendedMode}...`,
    });

    const extractionStart = performance.now();

    // Find template if available
    let template: BankTemplateConfig | undefined;
    if (analysis.templateCode) {
      template = this.templateRegistry.get(analysis.templateCode);
    }

    const extractionResult = await this.extraction.extract(
      rawText,
      analysis,
      template,
      options?.forceMode
    );
    const extractionTime = performance.now() - extractionStart;

    progress?.({
      layer: 'extraction',
      progress: 1,
      message: `${extractionResult.rows.length} lignes extraites (mode: ${extractionResult.mode})`,
    });

    // =========================================================================
    // Layer 3: Validation
    // =========================================================================
    progress?.({
      layer: 'validation',
      progress: 0,
      message: 'Validation des donnees...',
    });

    const validationStart = performance.now();
    const validationResult = this.validation.validate(
      extractionResult.rows,
      extractionResult.metadata
    );
    const validationTime = performance.now() - validationStart;

    progress?.({
      layer: 'validation',
      progress: 1,
      message: `Validation: ${validationResult.warnings.length} avertissement(s)`,
    });

    // =========================================================================
    // Layer 4: Structuration
    // =========================================================================
    progress?.({
      layer: 'structuration',
      progress: 0,
      message: 'Structuration des donnees...',
    });

    const output = this.structuration.structure(
      extractionResult.rows,
      extractionResult.metadata,
      validationResult,
      extractionResult.mode,
      {
        preAnalysis: Math.round(preAnalysisTime),
        extraction: Math.round(extractionTime),
        validation: Math.round(validationTime),
      }
    );

    progress?.({
      layer: 'structuration',
      progress: 1,
      message: `Pipeline termine: ${output.rows.length} transactions, confiance ${Math.round(validationResult.confidence * 100)}%`,
    });

    return output;
  }
}
