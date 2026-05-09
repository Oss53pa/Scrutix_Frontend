// ============================================================================
// ATLASBANX — Bank statement extractor — public API
// ============================================================================

export { extractStatement } from './PdfStatementExtractor';
export { parseAmount, findAmounts, looksLikeAmount } from './AmountParser';
export { detectTableStructure, clusterRows } from './HeaderDetector';
export {
  snapRowToColumns,
  mergeMultilineTransactions,
  filterNoise,
} from './RowReconstructor';
export { buildTransaction, parseDate } from './TransactionBuilder';

export type {
  ExtractionResult,
  ExtractionOptions,
  ExtractionStats,
  ExtractedTransaction,
  TableStructure,
  DetectedColumn,
  ColumnRole,
  PositionedItem,
  ReconstructedRow,
  MappedRow,
} from './types';
