import { formatNumber } from '../../utils';
/**
 * @module AtlasBanx
 * @file src/components/billing/FacturationPage.tsx
 * @description Page principale du module Facturation cabinet.
 *              Tableau des factures, filtres, KPIs, création de facture.
 *
 *              Réservée aux comptes cabinet (route protégée par CabinetOnly
 *              dans App.tsx). Utilise BillingService + client store pour
 *              résoudre les noms de clients.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Receipt, Plus, Download, Send, CheckCircle2, XCircle, Eye, RefreshCw } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Select,
  Modal,
  StatCard,
} from '../ui';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceForm } from './InvoiceForm';
import { InvoicePreview } from './InvoicePreview';
import {
  BillingService,
  type Invoice,
  type InvoiceStatus,
  type BillingSettings,
  INVOICE_STATUS_LABELS,
} from '../../billing';
import { useClientStore } from '../../store/clientStore';

const STATUS_FILTER_OPTIONS: Array<{ value: '' | InvoiceStatus; label: string }> = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyée' },
  { value: 'paid', label: 'Payée' },
  { value: 'overdue', label: 'En retard' },
  { value: 'cancelled', label: 'Annulée' },
];

export function FacturationPage() {
  const clients = useClientStore((s) => s.clients);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('');
  const [showForm, setShowForm] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const getClientName = useCallback(
    (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? '—',
    [clients],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await BillingService.checkOverdueInvoices();
      const [list, stg] = await Promise.all([
        BillingService.listInvoices({ status: statusFilter || undefined }),
        BillingService.getSettings(),
      ]);
      setInvoices(list);
      setSettings(stg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // KPIs
  const kpis = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = invoices
      .filter(
        (i) =>
          i.status === 'paid' &&
          i.paymentReceivedAt &&
          i.paymentReceivedAt.getMonth() === currentMonth &&
          i.paymentReceivedAt.getFullYear() === currentYear,
      )
      .reduce((s, i) => s + i.totalFcfa, 0);

    const pending = invoices
      .filter((i) => i.status === 'sent')
      .reduce((s, i) => s + i.totalFcfa, 0);

    const overdue = invoices
      .filter((i) => i.status === 'overdue')
      .reduce((s, i) => s + i.totalFcfa, 0);

    return { monthlyRevenue, pending, overdue };
  }, [invoices]);

  const handleOpenPreview = async (invoiceId: string) => {
    const full = await BillingService.getInvoice(invoiceId);
    if (full) setPreviewInvoice(full);
  };

  const handleDownload = async (invoice: Invoice) => {
    const full = invoice.lines ? invoice : await BillingService.getInvoice(invoice.id);
    if (!full) return;
    await BillingService.downloadPDF(full, getClientName(full.clientId), settings);
  };

  const handleMarkAsSent = async (invoiceId: string) => {
    await BillingService.markAsSent(invoiceId);
    await refresh();
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    if (!window.confirm('Marquer cette facture comme payée ?')) return;
    await BillingService.markAsPaid(invoiceId);
    await refresh();
  };

  const handleCancel = async (invoiceId: string) => {
    if (!window.confirm('Annuler cette facture ? Cette action est irréversible.')) return;
    await BillingService.cancel(invoiceId);
    await refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Facturation</h1>
          <p className="page-description">Gérez les factures de vos missions d'audit</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Nouvelle facture
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="CA du mois"
          value={`${formatNumber(kpis.monthlyRevenue)} FCFA`}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="En attente"
          value={`${formatNumber(kpis.pending)} FCFA`}
          icon={Send}
        />
        <StatCard
          label="En retard"
          value={`${formatNumber(kpis.overdue)} FCFA`}
          icon={XCircle}
          variant="danger"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Factures
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-48">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as '' | InvoiceStatus)}
                  options={STATUS_FILTER_OPTIONS}
                />
              </div>
              <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 text-primary-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">N°</th>
                  <th className="px-3 py-2 text-left font-medium">Client</th>
                  <th className="px-3 py-2 text-left font-medium">Émission</th>
                  <th className="px-3 py-2 text-left font-medium">Échéance</th>
                  <th className="px-3 py-2 text-right font-medium">HT</th>
                  <th className="px-3 py-2 text-right font-medium">TTC</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-primary-500">
                      Aucune facture. Cliquez sur "Nouvelle facture" pour démarrer.
                    </td>
                  </tr>
                )}
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-t border-primary-100 hover:bg-primary-50"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{invoice.invoiceNumber}</td>
                    <td className="px-3 py-2">{getClientName(invoice.clientId)}</td>
                    <td className="px-3 py-2">{invoice.issueDate.toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2">{invoice.dueDate.toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatNumber(invoice.subtotalFcfa)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatNumber(invoice.totalFcfa)}
                    </td>
                    <td className="px-3 py-2">
                      <InvoiceStatusBadge status={invoice.status} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPreview(invoice.id)}
                          title="Aperçu"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(invoice)}
                          title="Télécharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {invoice.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsSent(invoice.id)}
                            title="Marquer envoyée"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsPaid(invoice.id)}
                            title="Marquer payée"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                        {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(invoice.id)}
                            title="Annuler"
                          >
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Modals */}
      {showForm && (
        <Modal
          isOpen
          onClose={() => setShowForm(false)}
          title="Nouvelle facture"
          size="xl"
        >
          <InvoiceForm
            clients={clients}
            defaultTaxRate={settings?.defaultTaxRate}
            defaultPaymentTermsDays={settings?.defaultPaymentTermsDays}
            onCreated={async () => {
              setShowForm(false);
              await refresh();
            }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}

      {previewInvoice && (
        <Modal
          isOpen
          onClose={() => setPreviewInvoice(null)}
          title={`Facture ${previewInvoice.invoiceNumber}`}
          size="full"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreviewInvoice(null)}>
                Fermer
              </Button>
              <Button variant="primary" onClick={() => handleDownload(previewInvoice)}>
                <Download className="w-4 h-4 mr-1" />
                Télécharger PDF
              </Button>
            </div>
          }
        >
          <div className="bg-primary-50 p-4">
            <InvoicePreview
              invoice={previewInvoice}
              clientName={getClientName(previewInvoice.clientId)}
              settings={settings}
            />
          </div>
        </Modal>
      )}

      {/* Status legend */}
      <div className="flex flex-wrap gap-2 text-xs text-primary-500">
        <span>Statuts possibles :</span>
        {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
          <InvoiceStatusBadge key={s} status={s} size="sm" />
        ))}
      </div>
    </div>
  );
}
