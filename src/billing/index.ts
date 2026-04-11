/**
 * @module AtlasBanx
 * @file src/billing/index.ts
 * @description Barrel export du module Facturation (Bloc 4).
 */

export { BillingService } from './BillingService';

export {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_LINE_TYPE_LABELS,
} from './types';

export type {
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  InvoiceLineType,
  BillingSettings,
  CreateInvoiceDTO,
  CreateInvoiceLineDTO,
  UpdateInvoiceDTO,
} from './types';
