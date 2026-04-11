/**
 * @module AtlasBanx
 * @file src/billing/BillingService.ts
 * @description Service de facturation cabinet.
 *              CRUD invoices + invoice_lines, génération de numéros
 *              séquentiels atomiques via RPC, export PDF conforme OHADA.
 *
 *              Note : l'envoi par email est volontairement HORS SCOPE de
 *              ce bloc (voir playbook Bloc 4 décision 2-c). L'utilisateur
 *              télécharge le PDF et l'envoie via son propre canal.
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSupabaseClient } from '../lib/supabase';
import type {
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  CreateInvoiceDTO,
  UpdateInvoiceDTO,
  BillingSettings,
  InvoiceRow,
  InvoiceLineRow,
  BillingSettingsRow,
} from './types';
import { INVOICE_STATUS_LABELS, INVOICE_LINE_TYPE_LABELS } from './types';

export class BillingService {
  // ==========================================================================
  // SETTINGS
  // ==========================================================================

  /**
   * Charge les paramètres de facturation du cabinet courant.
   * Crée une ligne par défaut si elle n'existe pas encore.
   */
  static async getSettings(): Promise<BillingSettings | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .schema('atlasbanx')
      .from('billing_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[BillingService] getSettings failed:', error.message);
      return null;
    }

    if (!data) {
      // Création implicite
      const { data: created, error: insertErr } = await supabase
        .schema('atlasbanx')
          .from('billing_settings')
        .insert({ user_id: userId })
        .select()
        .single();

      if (insertErr || !created) return null;
      return settingsRowToEntity(created as BillingSettingsRow);
    }

    return settingsRowToEntity(data as BillingSettingsRow);
  }

  static async updateSettings(updates: Partial<BillingSettings>): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Utilisateur non authentifié');

    const row = entityToSettingsRow(updates);
    const { error } = await supabase
      .schema('atlasbanx')
      .from('billing_settings')
      .update(row)
      .eq('user_id', userId);

    if (error) throw new Error(`Mise à jour paramètres facturation: ${error.message}`);
  }

  // ==========================================================================
  // INVOICE CRUD
  // ==========================================================================

  /**
   * Crée une facture avec ses lignes. Atomique côté app :
   *   1. Génère le numéro via next_invoice_number(user_id)
   *   2. Crée l'enregistrement invoices
   *   3. Crée toutes les invoice_lines en batch
   *   4. Recalcule les totaux et les renvoie
   */
  static async createInvoice(dto: CreateInvoiceDTO): Promise<Invoice> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Utilisateur non authentifié');

    const settings = await this.getSettings();
    const taxRate = dto.taxRate ?? settings?.defaultTaxRate ?? 18;
    const termsDays = dto.paymentTermsDays ?? settings?.defaultPaymentTermsDays ?? 30;

    const dueDate = new Date(dto.issueDate);
    dueDate.setDate(dueDate.getDate() + termsDays);

    const { subtotal, tax, total } = this.computeTotals(dto.lines, taxRate);

    // 1. Générer le numéro via RPC
    const { data: numberData, error: numberErr } = await supabase
      .schema('atlasbanx')
      .rpc('next_invoice_number', { p_user_id: userId });

    if (numberErr || !numberData) {
      throw new Error(`Génération numéro facture: ${numberErr?.message ?? 'inconnue'}`);
    }
    const invoiceNumber = numberData as unknown as string;

    // 2. Créer la facture
    const { data: invoiceData, error: invoiceErr } = await supabase
      .schema('atlasbanx')
      .from('invoices')
      .insert({
        user_id: userId,
        client_id: dto.clientId,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: dto.issueDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal_fcfa: subtotal,
        tax_rate: taxRate,
        tax_amount_fcfa: tax,
        total_fcfa: total,
        currency: dto.currency ?? 'XOF',
        notes: dto.notes ?? null,
      })
      .select()
      .single();

    if (invoiceErr || !invoiceData) {
      throw new Error(`Création facture: ${invoiceErr?.message ?? 'inconnue'}`);
    }
    const invoice = invoiceData as unknown as InvoiceRow;

    // 3. Créer les lignes
    if (dto.lines.length > 0) {
      const linesPayload = dto.lines.map((line, idx) => ({
        invoice_id: invoice.id,
        position: idx,
        description: line.description,
        quantity: line.quantity,
        unit_price_fcfa: line.unitPriceFcfa,
        line_type: line.lineType,
        analysis_id: line.analysisId ?? null,
        report_id: line.reportId ?? null,
      }));

      const { error: linesErr } = await supabase
        .schema('atlasbanx')
          .from('invoice_lines')
        .insert(linesPayload);

      if (linesErr) {
        throw new Error(`Création lignes de facture: ${linesErr.message}`);
      }
    }

    return this.getInvoice(invoice.id) as Promise<Invoice>;
  }

  static async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data: invoiceData, error: invoiceErr } = await supabase
      .schema('atlasbanx')
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceErr || !invoiceData) return null;

    const { data: linesData } = await supabase
      .schema('atlasbanx')
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position', { ascending: true });

    const entity = invoiceRowToEntity(invoiceData as InvoiceRow);
    entity.lines = (linesData as InvoiceLineRow[] | null)?.map(lineRowToEntity) ?? [];
    return entity;
  }

  static async listInvoices(
    filter: { clientId?: string; status?: InvoiceStatus; limit?: number } = {},
  ): Promise<Invoice[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    let query = supabase
      .schema('atlasbanx')
      .from('invoices')
      .select('*')
      .order('issue_date', { ascending: false })
      .limit(filter.limit ?? 200);

    if (filter.clientId) query = query.eq('client_id', filter.clientId);
    if (filter.status) query = query.eq('status', filter.status);

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as InvoiceRow[]).map(invoiceRowToEntity);
  }

  static async updateInvoice(invoiceId: string, updates: UpdateInvoiceDTO): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const payload: Record<string, unknown> = {};
    if (updates.issueDate) payload.issue_date = updates.issueDate.toISOString().split('T')[0];
    if (updates.dueDate) payload.due_date = updates.dueDate.toISOString().split('T')[0];
    if (typeof updates.taxRate === 'number') payload.tax_rate = updates.taxRate;
    if (typeof updates.notes === 'string') payload.notes = updates.notes;
    if (updates.status) payload.status = updates.status;

    const { error } = await supabase
      .schema('atlasbanx')
      .from('invoices')
      .update(payload)
      .eq('id', invoiceId);

    if (error) throw new Error(`Mise à jour facture: ${error.message}`);
  }

  /**
   * Marque une facture comme envoyée (passage draft → sent).
   */
  static async markAsSent(invoiceId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { error } = await supabase
      .schema('atlasbanx')
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (error) throw new Error(`Marquer envoyée: ${error.message}`);
  }

  static async markAsPaid(invoiceId: string, paymentDate: Date = new Date()): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { error } = await supabase
      .schema('atlasbanx')
      .from('invoices')
      .update({ status: 'paid', payment_received_at: paymentDate.toISOString() })
      .eq('id', invoiceId);

    if (error) throw new Error(`Marquer payée: ${error.message}`);
  }

  static async cancel(invoiceId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { error } = await supabase
      .schema('atlasbanx')
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', invoiceId);

    if (error) throw new Error(`Annulation facture: ${error.message}`);
  }

  /**
   * Marque comme "overdue" toutes les factures dont la due_date est dépassée
   * et qui sont encore à l'état "sent". À appeler depuis un cron (ou au
   * chargement de la page Facturation).
   */
  static async checkOverdueInvoices(): Promise<number> {
    const supabase = getSupabaseClient();
    if (!supabase) return 0;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .schema('atlasbanx')
      .from('invoices')
      .update({ status: 'overdue' })
      .eq('status', 'sent')
      .lt('due_date', today)
      .select('id');

    if (error || !data) return 0;
    return (data as Array<{ id: string }>).length;
  }

  // ==========================================================================
  // COMPUTATION
  // ==========================================================================

  static computeTotals(
    lines: Array<{ quantity: number; unitPriceFcfa: number }>,
    taxRate: number,
  ): { subtotal: number; tax: number; total: number } {
    const subtotal = lines.reduce((s, line) => s + line.quantity * line.unitPriceFcfa, 0);
    const tax = Math.round((subtotal * taxRate) / 100);
    const total = subtotal + tax;
    return { subtotal: Math.round(subtotal), tax, total };
  }

  // ==========================================================================
  // PDF EXPORT (OHADA-compliant)
  // ==========================================================================

  /**
   * Génère un PDF conforme OHADA :
   *   - Numéro, date d'émission, date d'échéance
   *   - Identité vendeur (cabinet) : raison sociale, NIF, RCCM, adresse
   *   - Identité acheteur (client)
   *   - Description ligne par ligne
   *   - HT / TVA / TTC
   *   - Mentions légales en pied de page
   */
  static async exportToPDF(
    invoice: Invoice,
    clientName: string,
    settings: BillingSettings | null,
  ): Promise<Blob> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const primary: [number, number, number] = [30, 58, 138]; // primary-900
    const muted: [number, number, number] = [100, 100, 100];

    // Header
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoiceNumber, pageWidth - 14, 18, { align: 'right' });

    let y = 38;

    // Cabinet (vendeur)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ÉMETTEUR', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
    const vendorLines = [
      settings?.legalName ?? 'Cabinet (à configurer)',
      settings?.address ?? '',
      [settings?.city, settings?.country].filter(Boolean).join(', '),
      settings?.phone ? `Tél : ${settings.phone}` : '',
      settings?.email ? `Email : ${settings.email}` : '',
      settings?.nif ? `NIF : ${settings.nif}` : '',
      settings?.rccm ? `RCCM : ${settings.rccm}` : '',
    ].filter(Boolean);
    for (const line of vendorLines) {
      doc.text(line, 14, y);
      y += 4;
    }

    // Client (acheteur)
    let yClient = 38;
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINATAIRE', pageWidth - 14 - 70, yClient, { align: 'left' });
    doc.setFont('helvetica', 'normal');
    yClient += 5;
    doc.text(clientName, pageWidth - 14 - 70, yClient);

    // Dates
    y = Math.max(y, yClient) + 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Date d\'émission :', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.issueDate.toLocaleDateString('fr-FR'), 50, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Date d\'échéance :', pageWidth / 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.dueDate.toLocaleDateString('fr-FR'), pageWidth / 2 + 36, y);
    y += 8;

    // Tableau des lignes
    const lines = invoice.lines ?? [];
    const tableBody = lines.map((line, idx) => [
      String(idx + 1),
      INVOICE_LINE_TYPE_LABELS[line.lineType],
      line.description,
      line.quantity.toString(),
      line.unitPriceFcfa.toLocaleString('fr-FR'),
      line.lineTotalFcfa.toLocaleString('fr-FR'),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Type', 'Désignation', 'Qté', 'PU (FCFA)', 'Total (FCFA)']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 22 },
        3: { cellWidth: 12, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    // @ts-expect-error — autoTable attaches lastAutoTable to doc
    y = doc.lastAutoTable.finalY + 8;

    // Totaux
    const boxX = pageWidth - 14 - 70;
    const boxW = 70;
    const rowH = 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Sous-total HT', boxX, y);
    doc.text(`${invoice.subtotalFcfa.toLocaleString('fr-FR')} FCFA`, boxX + boxW, y, { align: 'right' });
    y += rowH;
    doc.text(`TVA (${invoice.taxRate.toFixed(2)}%)`, boxX, y);
    doc.text(`${invoice.taxAmountFcfa.toLocaleString('fr-FR')} FCFA`, boxX + boxW, y, { align: 'right' });
    y += rowH;
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(...primary);
    doc.setTextColor(255, 255, 255);
    doc.rect(boxX - 2, y - 4, boxW + 4, 8, 'F');
    doc.text('TOTAL TTC', boxX, y + 1);
    doc.text(`${invoice.totalFcfa.toLocaleString('fr-FR')} FCFA`, boxX + boxW, y + 1, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Informations bancaires
    if (settings?.bankName || settings?.bankAccount || settings?.bankRib) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Coordonnées bancaires', 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      if (settings.bankName) { doc.text(`Banque : ${settings.bankName}`, 14, y); y += 4; }
      if (settings.bankAccount) { doc.text(`N° compte : ${settings.bankAccount}`, 14, y); y += 4; }
      if (settings.bankRib) { doc.text(`RIB : ${settings.bankRib}`, 14, y); y += 4; }
    }

    // Notes
    if (invoice.notes) {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.text('Notes', 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - 28);
      doc.text(noteLines, 14, y);
      y += noteLines.length * 4;
    }

    // Mentions légales OHADA en pied de page
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    const legalMentions =
      settings?.legalMentions ??
      `Facture émise conformément à l'Acte Uniforme OHADA portant organisation et harmonisation des comptabilités. ${
        settings?.nif ? `NIF ${settings.nif}` : ''
      } ${settings?.rccm ? `RCCM ${settings.rccm}` : ''}`;
    const legalWrapped = doc.splitTextToSize(legalMentions, pageWidth - 28);
    doc.text(legalWrapped, 14, pageHeight - 18);

    const footerText =
      settings?.footerText ?? `AtlasBanx — ${INVOICE_STATUS_LABELS[invoice.status]}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });

    return doc.output('blob');
  }

  static async downloadPDF(
    invoice: Invoice,
    clientName: string,
    settings: BillingSettings | null,
  ): Promise<void> {
    const blob = await this.exportToPDF(invoice, clientName, settings);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // IMPORT MISSIONS FROM ANALYSES
  // ==========================================================================

  /**
   * Importe les missions d'audit d'un client sur une période comme
   * lignes de facture. Utilisé par InvoiceForm pour pré-remplir.
   *
   * Note : sans table "analyses" centralisée dans le schéma atlasbanx,
   * cette méthode reste un stub qui retourne une ligne forfait basée sur
   * le nombre de rapports existants. À enrichir quand la table analyses
   * sera consolidée côté serveur.
   */
  static async importMissionsFromAnalyses(
    clientId: string,
    period: { start: Date; end: Date },
    defaultUnitPrice = 150000,
  ): Promise<Array<{ description: string; quantity: number; unitPriceFcfa: number; lineType: 'service' }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    // Stub minimal : compte les relevés de la période comme missions
    const { data } = await supabase
      .schema('atlasbanx')
      .from('bank_statements')
      .select('id', { count: 'exact', head: false })
      .eq('client_id', clientId)
      .gte('period_start', period.start.toISOString().split('T')[0])
      .lte('period_end', period.end.toISOString().split('T')[0]);

    const count = (data as unknown[] | null)?.length ?? 0;
    if (count === 0) return [];

    return [
      {
        description: `Audit bancaire — ${count} relevé(s) — période ${period.start.toLocaleDateString(
          'fr-FR',
        )} au ${period.end.toLocaleDateString('fr-FR')}`,
        quantity: count,
        unitPriceFcfa: defaultUnitPrice,
        lineType: 'service' as const,
      },
    ];
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function invoiceRowToEntity(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    userId: row.user_id,
    cabinetId: row.cabinet_id,
    clientId: row.client_id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    issueDate: new Date(row.issue_date),
    dueDate: new Date(row.due_date),
    subtotalFcfa: Number(row.subtotal_fcfa),
    taxRate: Number(row.tax_rate),
    taxAmountFcfa: Number(row.tax_amount_fcfa),
    totalFcfa: Number(row.total_fcfa),
    currency: row.currency,
    notes: row.notes,
    paymentReceivedAt: row.payment_received_at ? new Date(row.payment_received_at) : null,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function lineRowToEntity(row: InvoiceLineRow): InvoiceLine {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    position: row.position,
    description: row.description,
    quantity: Number(row.quantity),
    unitPriceFcfa: Number(row.unit_price_fcfa),
    lineTotalFcfa: Number(row.line_total_fcfa),
    lineType: row.line_type,
    analysisId: row.analysis_id,
    reportId: row.report_id,
    createdAt: new Date(row.created_at),
  };
}

function settingsRowToEntity(row: BillingSettingsRow): BillingSettings {
  return {
    userId: row.user_id,
    cabinetId: row.cabinet_id,
    defaultPaymentTermsDays: row.default_payment_terms_days,
    defaultTaxRate: Number(row.default_tax_rate),
    invoicePrefix: row.invoice_prefix,
    lastSequenceNumber: row.last_sequence_number,
    lastSequenceYear: row.last_sequence_year,
    legalName: row.legal_name,
    nif: row.nif,
    rccm: row.rccm,
    address: row.address,
    city: row.city,
    country: row.country,
    phone: row.phone,
    email: row.email,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    bankRib: row.bank_rib,
    legalMentions: row.legal_mentions,
    footerText: row.footer_text,
    logoUrl: row.logo_url,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function entityToSettingsRow(updates: Partial<BillingSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.defaultPaymentTermsDays !== undefined) row.default_payment_terms_days = updates.defaultPaymentTermsDays;
  if (updates.defaultTaxRate !== undefined) row.default_tax_rate = updates.defaultTaxRate;
  if (updates.invoicePrefix !== undefined) row.invoice_prefix = updates.invoicePrefix;
  if (updates.legalName !== undefined) row.legal_name = updates.legalName;
  if (updates.nif !== undefined) row.nif = updates.nif;
  if (updates.rccm !== undefined) row.rccm = updates.rccm;
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.city !== undefined) row.city = updates.city;
  if (updates.country !== undefined) row.country = updates.country;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.bankName !== undefined) row.bank_name = updates.bankName;
  if (updates.bankAccount !== undefined) row.bank_account = updates.bankAccount;
  if (updates.bankRib !== undefined) row.bank_rib = updates.bankRib;
  if (updates.legalMentions !== undefined) row.legal_mentions = updates.legalMentions;
  if (updates.footerText !== undefined) row.footer_text = updates.footerText;
  if (updates.logoUrl !== undefined) row.logo_url = updates.logoUrl;
  return row;
}
