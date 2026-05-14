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

/**
 * Type de document. Permet de distinguer devis (proforma) et facture
 * définitive — l'un peut être converti en l'autre une fois accepté
 * par le client (status devis 'accepted' → invoice created).
 */
export type DocumentKind = 'invoice' | 'devis' | 'avoir';

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  invoice: 'Facture',
  devis:   'Devis (proforma)',
  avoir:   'Avoir / Note de crédit',
};

export type InvoiceLineType = 'service' | 'forfait' | 'deplacement' | 'frais';

export const INVOICE_LINE_TYPE_LABELS: Record<InvoiceLineType, string> = {
  service: 'Service',
  forfait: 'Forfait',
  deplacement: 'Déplacement',
  frais: 'Frais',
};

/** Périodicité de récurrence pour les factures abonnement. */
export type RecurringPeriod = 'monthly' | 'quarterly' | 'yearly';

export const RECURRING_PERIOD_LABELS: Record<RecurringPeriod, string> = {
  monthly:   'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly:    'Annuelle',
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
  /** Type de document : facture / devis / avoir. Défaut 'invoice' pour rétrocompat. */
  documentKind: DocumentKind;
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
  /** Référence facture mère (cas avoir : pointe vers l'invoice corrigée). */
  parentInvoiceId?: string | null;
  /** Si récurrent : ID du template parent. */
  recurringTemplateId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Populated via join (optionnel) */
  lines?: InvoiceLine[];
}

/**
 * Template de facture récurrente — génère automatiquement une nouvelle
 * facture à chaque échéance (mensuelle / trimestrielle / annuelle).
 * Utilisé pour les forfaits d'audit récurrents.
 */
export interface RecurringInvoiceTemplate {
  id: string;
  userId: string;
  clientId: string;
  label: string;
  period: RecurringPeriod;
  /** Jour du mois (1-28) où la facture est générée. */
  dayOfPeriod: number;
  taxRate: number;
  currency: string;
  active: boolean;
  /** Prochaine date de génération auto. */
  nextRunDate: Date;
  lastRunAt: Date | null;
  /** Lignes du template — recopiées dans chaque facture générée. */
  lines: CreateInvoiceLineDTO[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  /** Type de document — défaut 'invoice'. */
  documentKind?: DocumentKind;
  issueDate: Date;
  paymentTermsDays?: number;
  taxRate?: number;
  currency?: string;
  notes?: string;
  lines: CreateInvoiceLineDTO[];
  /** Facture d'avoir — référence la facture annulée. */
  parentInvoiceId?: string | null;
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
  /** Stocké dans metadata.document_kind si la colonne dédiée n'existe pas. */
  document_kind?: DocumentKind;
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
  /** Référence facture mère (cas avoir). */
  parent_invoice_id?: string | null;
  /** Template récurrent parent. */
  recurring_template_id?: string | null;
  /** Champs étendus stockés en JSONB (fallback si colonnes dédiées absentes). */
  metadata?: Record<string, unknown> | null;
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
