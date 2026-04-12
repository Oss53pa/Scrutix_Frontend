/**
 * @module AtlasBanx
 * @file src/import/index.ts
 * @description Barrel export du module Import étendu (Bloc 7).
 */

export { ConnectorRegistry } from './ConnectorRegistry';
export { ImportHistoryTracker } from './ImportHistoryTracker';
export { CSVUniversalImporter } from './connectors/CSVUniversalImporter';
export { ExcelImporter } from './connectors/ExcelImporter';

export type {
  BankConnector,
  ConnectorType,
  ImportSource,
  ConnectorConfig,
  ColumnMappingConfig,
  CsvDetectionResult,
  CsvPreviewRow,
  ImportHistoryEntry,
  ImportWizardStep,
} from './types';
