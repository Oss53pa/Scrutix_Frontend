/**
 * @module AtlasBanx
 * @file src/billing/types.ts
 * @description Types pour le module Facturation cabinet (Bloc 4).
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

// ----------------------------------------------------------------------------
// STATUS
// ----------------------------------------------------------------------------

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-primary-100 text-primary-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-primary-200 text-primary-600',
};

export type InvoiceLineType = 'service' | 'forfait' | 'deplacement' | 'frais';

export const INVOICE_LINE_TYPE_LABELS: Record<InvoiceLineType, string> = {
  service: 'Service',
  forfait: 'Forfait',
  deplacement: 'Déplacement',
  frais: 'Frais',
};

// ----------------------------------------------------------------------------
// INVOICE
// ----------------------------------------------------------------------------

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceFcfa: number;
  /** Calculé par la DB : quantity * unitPriceFcfa */
  lineTotalFcfa: number;
  lineType: InvoiceLineType;
  analysisId: string | null;
  reportId: string | null;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  cabinetId: string | null;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotalFcfa: number;
  taxRate: number;
  taxAmountFcfa: number;
  totalFcfa: number;
  currency: string;
  notes: string | null;
  paymentReceivedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Populated via join (optionnel) */
  lines?: InvoiceLine[];
}

// ----------------------------------------------------------------------------
// BILLING SETTINGS
// ----------------------------------------------------------------------------

export interface BillingSettings {
  userId: string;
  cabinetId: string | null;
  defaultPaymentTermsDays: number;
  defaultTaxRate: number;
  invoicePrefix: string;
  lastSequenceNumber: number;
  lastSequenceYear: number | null;
  legalName: string | null;
  nif: string | null;
  rccm: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankRib: string | null;
  legalMentions: string | null;
  footerText: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------------------------
// DTOs
// ----------------------------------------------------------------------------

export interface CreateInvoiceLineDTO {
  description: string;
  quantity: number;
  unitPriceFcfa: number;
  lineType: InvoiceLineType;
  analysisId?: string | null;
  reportId?: string | null;
}

export interface CreateInvoiceDTO {
  clientId: string;
  issueDate: Date;
  paymentTermsDays?: number;
  taxRate?: number;
  currency?: string;
  notes?: string;
  lines: CreateInvoiceLineDTO[];
}

export interface UpdateInvoiceDTO {
  issueDate?: Date;
  dueDate?: Date;
  taxRate?: number;
  notes?: string;
  status?: InvoiceStatus;
}

// ----------------------------------------------------------------------------
// ROW SHAPES (Supabase snake_case)
// ----------------------------------------------------------------------------

export interface InvoiceRow {
  id: string;
  user_id: string;
  cabinet_id: string | null;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal_fcfa: number;
  tax_rate: number;
  tax_amount_fcfa: number;
  total_fcfa: number;
  currency: string;
  notes: string | null;
  payment_received_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price_fcfa: number;
  line_total_fcfa: number;
  line_type: InvoiceLineType;
  analysis_id: string | null;
  report_id: string | null;
  created_at: string;
}

export interface BillingSettingsRow {
  user_id: string;
  cabinet_id: string | null;
  default_payment_terms_days: number;
  default_tax_rate: number;
  invoice_prefix: string;
  last_sequence_number: number;
  last_sequence_year: number | null;
  legal_name: string | null;
  nif: string | null;
  rccm: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_rib: string | null;
  legal_mentions: string | null;
  footer_text: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}
