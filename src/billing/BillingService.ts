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
    const documentKind = dto.documentKind ?? 'invoice';

    const dueDate = new Date(dto.issueDate);
    dueDate.setDate(dueDate.getDate() + termsDays);

    // Pour un avoir : montants négatifs (note de crédit)
    const sign = documentKind === 'avoir' ? -1 : 1;
    const lines = dto.lines.map((l) => ({ ...l, unitPriceFcfa: l.unitPriceFcfa * sign }));
    const { subtotal, tax, total } = this.computeTotals(lines, taxRate);

    // 1. Générer le numéro via RPC — avec préfixe selon documentKind
    //    invoice → FAC-YYYY-NNNN  ·  devis → DEV-YYYY-NNNN  ·  avoir → AVO-YYYY-NNNN
    const { data: numberData, error: numberErr } = await supabase
      .schema('atlasbanx')
      .rpc('next_invoice_number', { p_user_id: userId });

    if (numberErr || !numberData) {
      throw new Error(`Génération numéro facture: ${numberErr?.message ?? 'inconnue'}`);
    }
    let invoiceNumber = numberData as unknown as string;
    // Re-préfixer selon le type de document si la RPC retourne un format générique
    if (documentKind === 'devis' && !invoiceNumber.startsWith('DEV')) {
      invoiceNumber = invoiceNumber.replace(/^[A-Z]+/, 'DEV');
    } else if (documentKind === 'avoir' && !invoiceNumber.startsWith('AVO')) {
      invoiceNumber = invoiceNumber.replace(/^[A-Z]+/, 'AVO');
    }

    // 2. Créer la facture — on stocke documentKind dans metadata jsonb
    //    pour ne pas dépendre d'une migration DB (rétrocompat assurée).
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
        metadata: {
          document_kind: documentKind,
          ...(dto.parentInvoiceId ? { parent_invoice_id: dto.parentInvoiceId } : {}),
        },
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
  // DEVIS / AVOIR — workflow étendu
  // ==========================================================================

  /**
   * Convertit un devis (proforma) en facture définitive. Le devis source
   * passe en status='cancelled' (archive), une nouvelle invoice est créée
   * avec les mêmes lignes mais en documentKind='invoice'.
   */
  static async convertDevisToInvoice(devisId: string): Promise<Invoice> {
    const devis = await this.getInvoice(devisId);
    if (!devis) throw new Error('Devis introuvable');
    if (devis.documentKind !== 'devis') {
      throw new Error('Seuls les devis peuvent être convertis en facture');
    }
    if (!devis.lines || devis.lines.length === 0) {
      throw new Error('Devis sans lignes — impossible de convertir');
    }

    // Crée la facture définitive
    const invoice = await this.createInvoice({
      clientId: devis.clientId,
      documentKind: 'invoice',
      issueDate: new Date(),
      taxRate: devis.taxRate,
      currency: devis.currency,
      notes: devis.notes ?? undefined,
      lines: devis.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceFcfa: l.unitPriceFcfa,
        lineType: l.lineType,
        analysisId: l.analysisId,
        reportId: l.reportId,
      })),
    });

    // Archive le devis
    await this.cancel(devisId);

    return invoice;
  }

  /**
   * Crée une facture d'avoir (note de crédit) qui annule comptablement
   * une facture existante. Montants négatifs, lien parent_invoice_id.
   */
  static async createAvoir(invoiceId: string, reason: string): Promise<Invoice> {
    const original = await this.getInvoice(invoiceId);
    if (!original) throw new Error('Facture originale introuvable');
    if (!original.lines || original.lines.length === 0) {
      throw new Error('Facture sans lignes — impossible de créer l\'avoir');
    }

    return this.createInvoice({
      clientId: original.clientId,
      documentKind: 'avoir',
      issueDate: new Date(),
      taxRate: original.taxRate,
      currency: original.currency,
      notes: `Avoir sur facture ${original.invoiceNumber} — Motif : ${reason}`,
      parentInvoiceId: invoiceId,
      lines: original.lines.map((l) => ({
        description: `[ANNULATION] ${l.description}`,
        quantity: l.quantity,
        unitPriceFcfa: l.unitPriceFcfa, // le sign est appliqué dans createInvoice
        lineType: l.lineType,
        analysisId: l.analysisId,
        reportId: l.reportId,
      })),
    });
  }

  // ==========================================================================
  // EMAIL & REMINDERS
  // ==========================================================================

  /**
   * Envoie la facture par email via l'Edge Function `send-invoice-email`
   * (Resend). Si l'Edge Function n'est pas disponible, dégrade en
   * « mailto: » avec le PDF en pièce jointe locale (download manuel).
   */
  static async sendByEmail(
    invoiceId: string,
    args: {
      to: string;
      cc?: string;
      subject?: string;
      body?: string;
    },
  ): Promise<{ method: 'edge_function' | 'mailto' }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      window.location.href = `mailto:${encodeURIComponent(args.to)}?subject=${encodeURIComponent(args.subject ?? 'Facture')}`;
      return { method: 'mailto' };
    }

    try {
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoice_id: invoiceId,
          to: args.to,
          cc: args.cc,
          subject: args.subject,
          body: args.body,
        },
      });
      if (error) throw new Error(error.message);
      // Marquer comme envoyée
      await this.markAsSent(invoiceId);
      return { method: 'edge_function' };
    } catch (err) {
      console.warn('[BillingService.sendByEmail] Edge Function échouée, fallback mailto:', err);
      const subject = encodeURIComponent(args.subject ?? 'Facture');
      const body = encodeURIComponent(args.body ?? 'Veuillez trouver ci-joint notre facture.');
      window.location.href = `mailto:${encodeURIComponent(args.to)}?subject=${subject}&body=${body}`;
      return { method: 'mailto' };
    }
  }

  /**
   * Envoie une relance pour une facture en retard (overdue). Variante de
   * sendByEmail avec un ton plus formel selon le niveau (1ère / 2ème / 3ème).
   */
  static async sendReminder(
    invoiceId: string,
    level: 1 | 2 | 3,
    to: string,
  ): Promise<{ method: 'edge_function' | 'mailto' }> {
    const subjects = {
      1: 'Rappel — facture en attente',
      2: 'Second rappel — facture en retard',
      3: 'Mise en demeure — facture impayée',
    };
    const bodies = {
      1: 'Sauf erreur de notre part, nous n\'avons pas reçu le règlement de notre facture. Nous vous prions de bien vouloir régulariser dès que possible.',
      2: 'Malgré notre précédent courrier, notre facture demeure impayée. Nous vous demandons de procéder au règlement sous 8 jours pour éviter toute procédure de recouvrement.',
      3: 'En l\'absence de règlement sous 7 jours à compter de la présente, nous nous verrons contraints de transmettre votre dossier au contentieux et d\'engager toutes voies de droit.',
    };
    return this.sendByEmail(invoiceId, {
      to,
      subject: subjects[level],
      body: bodies[level],
    });
  }

  // ==========================================================================
  // EXCEL EXPORT
  // ==========================================================================

  /**
   * Génère un classeur Excel (.xlsx) avec :
   *   - Feuille « Facture » : en-tête + lignes + totaux
   *   - Feuille « Détail » : breakdown par type de prestation
   * Utilise ExcelJS (déjà importé pour les exports d'anomalies).
   */
  static async exportToExcel(
    invoice: Invoice,
    clientName: string,
    settings: BillingSettings | null,
  ): Promise<Blob> {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = settings?.legalName ?? 'AtlasBanx';
    wb.created = new Date();

    // ─── Feuille 1 : Facture ─────────────────────────────────────────────────
    const ws = wb.addWorksheet('Facture', {
      pageSetup: { orientation: 'portrait', paperSize: 9 },
    });

    // En-tête avec couleur
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = invoice.documentKind === 'devis' ? 'DEVIS' : invoice.documentKind === 'avoir' ? 'AVOIR' : 'FACTURE';
    titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 32;

    ws.getCell('F1').value = invoice.invoiceNumber;
    ws.getCell('F1').font = { size: 14, color: { argb: 'FFFFFFFF' } };
    ws.getCell('F1').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    ws.getCell('F1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };

    // Émetteur
    let r = 3;
    ws.getCell(`A${r}`).value = 'ÉMETTEUR';
    ws.getCell(`A${r}`).font = { bold: true, color: { argb: 'FF6A7388' } };
    r++;
    [
      settings?.legalName ?? 'Cabinet (à configurer)',
      settings?.address,
      [settings?.city, settings?.country].filter(Boolean).join(', '),
      settings?.phone ? `Tél : ${settings.phone}` : null,
      settings?.email ? `Email : ${settings.email}` : null,
      settings?.nif ? `NIF : ${settings.nif}` : null,
      settings?.rccm ? `RCCM : ${settings.rccm}` : null,
    ].filter(Boolean).forEach((line) => {
      ws.getCell(`A${r}`).value = String(line);
      r++;
    });

    // Destinataire
    r = 3;
    ws.getCell(`E${r}`).value = 'DESTINATAIRE';
    ws.getCell(`E${r}`).font = { bold: true, color: { argb: 'FF6A7388' } };
    r++;
    ws.getCell(`E${r}`).value = clientName;
    ws.getCell(`E${r}`).font = { bold: true };

    // Dates
    r = 12;
    ws.getCell(`A${r}`).value = 'Émission :';
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = invoice.issueDate.toLocaleDateString('fr-FR');
    ws.getCell(`D${r}`).value = 'Échéance :';
    ws.getCell(`D${r}`).font = { bold: true };
    ws.getCell(`E${r}`).value = invoice.dueDate.toLocaleDateString('fr-FR');

    // Tableau lignes
    r = 14;
    const headerRow = ws.addRow(['#', 'Type', 'Désignation', 'Qté', 'PU (FCFA)', 'Total (FCFA)']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };
      cell.alignment = { vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
    });
    for (const [idx, line] of (invoice.lines ?? []).entries()) {
      const row = ws.addRow([
        idx + 1,
        INVOICE_LINE_TYPE_LABELS[line.lineType],
        line.description,
        line.quantity,
        line.unitPriceFcfa,
        line.lineTotalFcfa,
      ]);
      row.getCell(5).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0';
    }

    // Totaux
    const lineCount = invoice.lines?.length ?? 0;
    const totalRow = 14 + lineCount + 2;
    ws.getCell(`E${totalRow}`).value = 'Sous-total HT';
    ws.getCell(`E${totalRow}`).font = { bold: true };
    ws.getCell(`F${totalRow}`).value = invoice.subtotalFcfa;
    ws.getCell(`F${totalRow}`).numFmt = '#,##0" FCFA"';
    ws.getCell(`E${totalRow + 1}`).value = `TVA (${invoice.taxRate.toFixed(2)}%)`;
    ws.getCell(`E${totalRow + 1}`).font = { bold: true };
    ws.getCell(`F${totalRow + 1}`).value = invoice.taxAmountFcfa;
    ws.getCell(`F${totalRow + 1}`).numFmt = '#,##0" FCFA"';
    ws.getCell(`E${totalRow + 2}`).value = 'TOTAL TTC';
    ws.getCell(`E${totalRow + 2}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`E${totalRow + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };
    ws.getCell(`F${totalRow + 2}`).value = invoice.totalFcfa;
    ws.getCell(`F${totalRow + 2}`).numFmt = '#,##0" FCFA"';
    ws.getCell(`F${totalRow + 2}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`F${totalRow + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };

    // Largeurs de colonnes
    ws.columns = [
      { width: 6 }, { width: 14 }, { width: 42 },
      { width: 8 }, { width: 16 }, { width: 18 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  static async downloadExcel(
    invoice: Invoice,
    clientName: string,
    settings: BillingSettings | null,
  ): Promise<void> {
    const blob = await this.exportToExcel(invoice, clientName, settings);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // WORD EXPORT (HTML Blob compatible MS Word + LibreOffice)
  // ==========================================================================

  static exportToWordHtml(
    invoice: Invoice,
    clientName: string,
    settings: BillingSettings | null,
  ): string {
    const kindLabel = invoice.documentKind === 'devis' ? 'DEVIS' : invoice.documentKind === 'avoir' ? 'AVOIR' : 'FACTURE';
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
    const linesHtml = (invoice.lines ?? []).map((l, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(INVOICE_LINE_TYPE_LABELS[l.lineType])}</td>
        <td>${escapeHtml(l.description)}</td>
        <td style="text-align:right;">${l.quantity}</td>
        <td style="text-align:right;">${fmt(l.unitPriceFcfa)}</td>
        <td style="text-align:right;font-weight:bold;">${fmt(l.lineTotalFcfa)}</td>
      </tr>`).join('');

    return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${kindLabel} ${invoice.invoiceNumber}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e2640; }
  h1 { color: #fff; background: #1e2640; padding: 12px; font-size: 22pt; margin: 0 0 18px 0; }
  h1 .number { float: right; font-size: 14pt; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #1e2640; color: #fff; padding: 6px; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 18px; }
  .meta .col { width: 48%; }
  .meta h4 { color: #6a7388; font-size: 9pt; text-transform: uppercase; margin: 0 0 4px 0; }
  .totals { float: right; width: 280px; margin-top: 12px; }
  .totals tr td { border: none; padding: 3px 8px; }
  .totals tr.total-ttc td { background: #1e2640; color: #fff; font-weight: bold; font-size: 12pt; }
  .footer { margin-top: 40px; font-size: 8pt; color: #888; border-top: 1px solid #ccc; padding-top: 8px; }
</style>
</head>
<body>
  <h1>${kindLabel}<span class="number">${escapeHtml(invoice.invoiceNumber)}</span></h1>

  <div class="meta">
    <div class="col">
      <h4>Émetteur</h4>
      <p><strong>${escapeHtml(settings?.legalName ?? 'Cabinet (à configurer)')}</strong><br>
      ${escapeHtml(settings?.address ?? '')}<br>
      ${[settings?.city, settings?.country].filter(Boolean).join(', ')}<br>
      ${settings?.phone ? `Tél : ${escapeHtml(settings.phone)}<br>` : ''}
      ${settings?.email ? `Email : ${escapeHtml(settings.email)}<br>` : ''}
      ${settings?.nif ? `NIF : ${escapeHtml(settings.nif)}<br>` : ''}
      ${settings?.rccm ? `RCCM : ${escapeHtml(settings.rccm)}` : ''}</p>
    </div>
    <div class="col" style="text-align:right;">
      <h4>Destinataire</h4>
      <p><strong>${escapeHtml(clientName)}</strong></p>
      <br>
      <p><strong>Émission :</strong> ${invoice.issueDate.toLocaleDateString('fr-FR')}<br>
      <strong>Échéance :</strong> ${invoice.dueDate.toLocaleDateString('fr-FR')}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Type</th><th>Désignation</th>
        <th style="text-align:right;">Qté</th>
        <th style="text-align:right;">PU (FCFA)</th>
        <th style="text-align:right;">Total (FCFA)</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <table class="totals">
    <tr><td>Sous-total HT</td><td style="text-align:right;">${fmt(invoice.subtotalFcfa)} FCFA</td></tr>
    <tr><td>TVA (${invoice.taxRate.toFixed(2)}%)</td><td style="text-align:right;">${fmt(invoice.taxAmountFcfa)} FCFA</td></tr>
    <tr class="total-ttc"><td>TOTAL TTC</td><td style="text-align:right;">${fmt(invoice.totalFcfa)} FCFA</td></tr>
  </table>

  <div style="clear:both;"></div>

  ${invoice.notes ? `<p style="margin-top:24px;"><strong>Notes :</strong><br>${escapeHtml(invoice.notes)}</p>` : ''}

  ${settings?.bankName || settings?.bankAccount ? `
    <p style="margin-top:24px;"><strong>Coordonnées bancaires :</strong><br>
    ${settings?.bankName ? `Banque : ${escapeHtml(settings.bankName)}<br>` : ''}
    ${settings?.bankAccount ? `Compte : ${escapeHtml(settings.bankAccount)}<br>` : ''}
    ${settings?.bankRib ? `RIB : ${escapeHtml(settings.bankRib)}` : ''}</p>
  ` : ''}

  <div class="footer">
    ${escapeHtml(settings?.legalMentions ?? "Facture conforme à l'Acte Uniforme OHADA portant organisation et harmonisation des comptabilités.")}
  </div>
</body>
</html>`;
  }

  static downloadWord(
    invoice: Invoice,
    clientName: string,
    settings: BillingSettings | null,
  ): void {
    const html = this.exportToWordHtml(invoice, clientName, settings);
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}.doc`;
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
  // Le champ document_kind peut être (a) une colonne dédiée, (b) dans
  // metadata jsonb si pas de colonne, (c) absent → fallback 'invoice'.
  const docKind = (
    row.document_kind
    ?? (row.metadata?.document_kind as Invoice['documentKind'] | undefined)
    ?? 'invoice'
  );
  return {
    id: row.id,
    userId: row.user_id,
    cabinetId: row.cabinet_id,
    clientId: row.client_id,
    invoiceNumber: row.invoice_number,
    documentKind: docKind,
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
    parentInvoiceId:     row.parent_invoice_id ?? (row.metadata?.parent_invoice_id as string | null) ?? null,
    recurringTemplateId: row.recurring_template_id ?? (row.metadata?.recurring_template_id as string | null) ?? null,
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
