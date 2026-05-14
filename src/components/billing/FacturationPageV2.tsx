// ============================================================================
// FacturationPageV2 — page complète du module Facturation (god mode)
// ============================================================================
// Architecture par onglets :
//   1. Dashboard  — KPIs CA / encaissé / en attente / DSO + aging + charts
//   2. Factures   — table CRUD complète (filtre, recherche, multi-export)
//   3. Devis      — proforma avant validation (convertible en facture)
//   4. Avoirs     — notes de crédit (annulation comptable)
//   5. Paramètres — BillingSettingsPanel (NIF, RCCM, logo, banque…)
//
// Toutes les actions sont câblées sur BillingService → Supabase
// (fallback mock si Supabase pas configuré).
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt, FileText, Banknote, Settings, BarChart3, Plus, Download,
  Send, CheckCircle2, XCircle, Eye, RefreshCw, FileSpreadsheet,
  Mail, AlertTriangle, ArrowRight, FileDown, Wallet, Clock, Target,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardBody, Button, Select, Modal, Input, Badge,
} from '../ui';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceForm } from './InvoiceForm';
import { InvoicePreview } from './InvoicePreview';
import { BillingSettingsPanel } from './BillingSettingsPanel';
import {
  BillingService,
  type Invoice,
  type InvoiceStatus,
  type BillingSettings,
  type DocumentKind,
  INVOICE_STATUS_LABELS,
} from '../../billing';
import { useClientStore } from '../../store/clientStore';
import { formatCurrency } from '../../utils';

type TabId = 'dashboard' | 'invoices' | 'devis' | 'avoirs' | 'settings';

const STATUS_FILTER_OPTIONS: Array<{ value: '' | InvoiceStatus; label: string }> = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyée' },
  { value: 'paid', label: 'Payée' },
  { value: 'overdue', label: 'En retard' },
  { value: 'cancelled', label: 'Annulée' },
];

export function FacturationPageV2() {
  const clients = useClientStore((s) => s.clients);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState<{ kind: DocumentKind } | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [emailModal, setEmailModal] = useState<{ invoice: Invoice; level?: 1 | 2 | 3 } | null>(null);

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

  useEffect(() => { void refresh(); }, [refresh]);

  // Filtrage par type de document + recherche
  const factures = useMemo(() => invoices.filter((i) => (i.documentKind ?? 'invoice') === 'invoice'), [invoices]);
  const devis    = useMemo(() => invoices.filter((i) => i.documentKind === 'devis'), [invoices]);
  const avoirs   = useMemo(() => invoices.filter((i) => i.documentKind === 'avoir'), [invoices]);

  const filtered = useMemo(() => {
    const source = activeTab === 'devis' ? devis : activeTab === 'avoirs' ? avoirs : factures;
    if (!search) return source;
    const q = search.toLowerCase();
    return source.filter((i) =>
      i.invoiceNumber.toLowerCase().includes(q)
      || getClientName(i.clientId).toLowerCase().includes(q),
    );
  }, [activeTab, factures, devis, avoirs, search, getClientName]);

  // KPIs dashboard
  const kpis = useMemo(() => {
    const cy = new Date().getFullYear();
    const cm = new Date().getMonth();
    const monthly = factures
      .filter((i) => i.status === 'paid' && i.paymentReceivedAt
        && i.paymentReceivedAt.getMonth() === cm
        && i.paymentReceivedAt.getFullYear() === cy)
      .reduce((s, i) => s + i.totalFcfa, 0);
    const pending = factures.filter((i) => i.status === 'sent').reduce((s, i) => s + i.totalFcfa, 0);
    const overdue = factures.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.totalFcfa, 0);
    const totalInvoiced = factures.reduce((s, i) => s + i.totalFcfa, 0);
    const totalPaid     = factures.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalFcfa, 0);

    // Aging
    const now = Date.now();
    const aging = { current: 0, days30: 0, days60: 0, days90: 0 };
    factures
      .filter((i) => i.status === 'sent' || i.status === 'overdue')
      .forEach((i) => {
        const days = Math.floor((now - i.issueDate.getTime()) / 86400000);
        if (days <= 30) aging.current += i.totalFcfa;
        else if (days <= 60) aging.days30 += i.totalFcfa;
        else if (days <= 90) aging.days60 += i.totalFcfa;
        else aging.days90 += i.totalFcfa;
      });

    // DSO
    const paidInvoices = factures.filter((i) => i.status === 'paid' && i.paymentReceivedAt);
    const avgDSO = paidInvoices.length > 0
      ? Math.round(paidInvoices.reduce((s, i) =>
          s + (i.paymentReceivedAt!.getTime() - i.issueDate.getTime()) / 86400000, 0) / paidInvoices.length)
      : 0;

    return { monthly, pending, overdue, totalInvoiced, totalPaid, aging, avgDSO };
  }, [factures]);

  // Actions
  async function handleOpenPreview(id: string) {
    const full = await BillingService.getInvoice(id);
    if (full) setPreviewInvoice(full);
  }
  async function handleDownloadPdf(inv: Invoice) {
    const full = inv.lines ? inv : await BillingService.getInvoice(inv.id);
    if (!full) return;
    await BillingService.downloadPDF(full, getClientName(full.clientId), settings);
  }
  async function handleDownloadExcel(inv: Invoice) {
    const full = inv.lines ? inv : await BillingService.getInvoice(inv.id);
    if (!full) return;
    await BillingService.downloadExcel(full, getClientName(full.clientId), settings);
  }
  function handleDownloadWord(inv: Invoice) {
    const full = inv.lines ? inv : null;
    if (full) {
      BillingService.downloadWord(full, getClientName(full.clientId), settings);
      return;
    }
    BillingService.getInvoice(inv.id).then((f) => {
      if (f) BillingService.downloadWord(f, getClientName(f.clientId), settings);
    });
  }
  async function handleMarkAsSent(id: string) { await BillingService.markAsSent(id); await refresh(); }
  async function handleMarkAsPaid(id: string) {
    if (!window.confirm('Marquer comme payée ?')) return;
    await BillingService.markAsPaid(id);
    await refresh();
  }
  async function handleCancel(id: string) {
    if (!window.confirm('Annuler ce document ? Action irréversible.')) return;
    await BillingService.cancel(id);
    await refresh();
  }
  async function handleConvertDevis(devisId: string) {
    if (!window.confirm('Convertir ce devis en facture définitive ? Le devis sera archivé.')) return;
    try {
      const invoice = await BillingService.convertDevisToInvoice(devisId);
      window.alert(`Facture ${invoice.invoiceNumber} créée avec succès.`);
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erreur conversion');
    }
  }
  async function handleCreateAvoir(invoice: Invoice) {
    const reason = window.prompt('Motif de l\'avoir :');
    if (!reason) return;
    try {
      const avoir = await BillingService.createAvoir(invoice.id, reason);
      window.alert(`Avoir ${avoir.invoiceNumber} créé avec succès.`);
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erreur création avoir');
    }
  }
  async function handleSendEmail(invoice: Invoice, level?: 1 | 2 | 3) {
    setEmailModal({ invoice, level });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Facturation cabinet</h1>
          <p className="text-sm text-ink-500">
            Devis · factures · avoirs · paramètres · conforme OHADA AUDCIF
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowForm({ kind: 'invoice' })}>
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle facture
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-canvas-200">
        <nav className="flex gap-1 overflow-x-auto">
          <TabBtn id="dashboard" active={activeTab} onClick={setActiveTab} icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" />
          <TabBtn id="invoices"  active={activeTab} onClick={setActiveTab} icon={<Receipt className="w-4 h-4" />}    label="Factures"  count={factures.length} />
          <TabBtn id="devis"     active={activeTab} onClick={setActiveTab} icon={<FileText className="w-4 h-4" />}   label="Devis"     count={devis.length} />
          <TabBtn id="avoirs"    active={activeTab} onClick={setActiveTab} icon={<Banknote className="w-4 h-4" />}   label="Avoirs"    count={avoirs.length} />
          <TabBtn id="settings"  active={activeTab} onClick={setActiveTab} icon={<Settings className="w-4 h-4" />}   label="Paramètres" />
        </nav>
      </div>

      {/* ─── DASHBOARD ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard label="CA encaissé du mois" value={formatCurrency(kpis.monthly, 'XAF')} icon={CheckCircle2} tone="success" />
            <KpiCard label="Encaissé (total)"    value={formatCurrency(kpis.totalPaid, 'XAF')} icon={Wallet}      tone="default" />
            <KpiCard label="En attente"           value={formatCurrency(kpis.pending, 'XAF')}  icon={Clock}       tone="warning" />
            <KpiCard label="DSO moyen"           value={`${kpis.avgDSO} jours`}              icon={Target}      tone="default" />
          </div>

          {kpis.overdue > 0 && (
            <Card className="bg-rose-50 border-rose-200">
              <CardBody className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <div>
                    <p className="font-semibold text-rose-900">
                      {formatCurrency(kpis.overdue, 'XAF')} en retard de paiement
                    </p>
                    <p className="text-xs text-rose-700">Lancez des relances pour accélérer le recouvrement.</p>
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={() => { setActiveTab('invoices'); setStatusFilter('overdue'); }}>
                  Voir factures en retard
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Aging */}
          <Card>
            <CardHeader>
              <CardTitle>Ancienneté des créances</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {([
                  ['0–30 jours',   kpis.aging.current, 'bg-emerald-500'],
                  ['31–60 jours',  kpis.aging.days30,  'bg-amber-500'],
                  ['61–90 jours',  kpis.aging.days60,  'bg-orange-500'],
                  ['90+ jours',    kpis.aging.days90,  'bg-rose-500'],
                ] as Array<[string, number, string]>).map(([label, amount, color]) => {
                  const totalAging = kpis.aging.current + kpis.aging.days30 + kpis.aging.days60 + kpis.aging.days90;
                  const pct = totalAging > 0 ? (amount / totalAging) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-ink-700">{label}</span>
                        <span className="text-sm font-bold text-ink-900">{formatCurrency(amount, 'XAF')}</span>
                      </div>
                      <div className="h-2 bg-canvas-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ─── FACTURES / DEVIS / AVOIRS — tables ─── */}
      {(activeTab === 'invoices' || activeTab === 'devis' || activeTab === 'avoirs') && (
        <DocumentList
          documents={filtered}
          kind={activeTab === 'devis' ? 'devis' : activeTab === 'avoirs' ? 'avoir' : 'invoice'}
          getClientName={getClientName}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onCreate={() => setShowForm({ kind: activeTab === 'devis' ? 'devis' : 'invoice' })}
          onPreview={(id) => void handleOpenPreview(id)}
          onDownloadPdf={(inv) => void handleDownloadPdf(inv)}
          onDownloadExcel={(inv) => void handleDownloadExcel(inv)}
          onDownloadWord={(inv) => handleDownloadWord(inv)}
          onSendEmail={(inv) => void handleSendEmail(inv)}
          onSendReminder={(inv, level) => void handleSendEmail(inv, level)}
          onMarkSent={(id) => void handleMarkAsSent(id)}
          onMarkPaid={(id) => void handleMarkAsPaid(id)}
          onCancel={(id) => void handleCancel(id)}
          onConvertDevis={(id) => void handleConvertDevis(id)}
          onCreateAvoir={(inv) => void handleCreateAvoir(inv)}
        />
      )}

      {/* ─── SETTINGS ─── */}
      {activeTab === 'settings' && (
        <BillingSettingsPanel onSaved={() => void refresh()} />
      )}

      {/* ─── Modal création ─── */}
      {showForm && (
        <Modal
          isOpen
          onClose={() => setShowForm(null)}
          title={showForm.kind === 'devis' ? 'Nouveau devis' : 'Nouvelle facture'}
          size="xl"
        >
          <InvoiceForm
            clients={clients}
            defaultTaxRate={settings?.defaultTaxRate}
            defaultPaymentTermsDays={settings?.defaultPaymentTermsDays}
            documentKind={showForm.kind}
            onCreated={async () => { setShowForm(null); await refresh(); }}
            onCancel={() => setShowForm(null)}
          />
        </Modal>
      )}

      {/* ─── Modal aperçu ─── */}
      {previewInvoice && (
        <Modal
          isOpen
          onClose={() => setPreviewInvoice(null)}
          title={`${previewInvoice.documentKind === 'devis' ? 'Devis' : previewInvoice.documentKind === 'avoir' ? 'Avoir' : 'Facture'} ${previewInvoice.invoiceNumber}`}
          size="full"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreviewInvoice(null)}>Fermer</Button>
              <Button variant="secondary" onClick={() => void handleDownloadExcel(previewInvoice)}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button variant="secondary" onClick={() => handleDownloadWord(previewInvoice)}>
                <FileText className="w-4 h-4 mr-1" />
                Word
              </Button>
              <Button variant="primary" onClick={() => void handleDownloadPdf(previewInvoice)}>
                <Download className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          }
        >
          <div className="bg-canvas-100 p-4">
            <InvoicePreview
              invoice={previewInvoice}
              clientName={getClientName(previewInvoice.clientId)}
              settings={settings}
            />
          </div>
        </Modal>
      )}

      {/* ─── Modal email send / reminder ─── */}
      {emailModal && (
        <EmailModal
          invoice={emailModal.invoice}
          level={emailModal.level}
          defaultEmail={clients.find((c) => c.id === emailModal.invoice.clientId)?.contactEmail ?? ''}
          onClose={() => setEmailModal(null)}
          onSent={async () => { setEmailModal(null); await refresh(); }}
        />
      )}

      {/* Status legend */}
      <div className="flex flex-wrap gap-2 text-xs text-ink-500 pt-4 border-t border-canvas-200">
        <span>Statuts :</span>
        {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
          <InvoiceStatusBadge key={s} status={s} size="sm" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function TabBtn({
  id, active, onClick, icon, label, count,
}: {
  id: TabId;
  active: TabId;
  onClick: (id: TabId) => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
        active === id
          ? 'border-ink-900 text-ink-900'
          : 'border-transparent text-ink-500 hover:text-ink-700'
      }`}
    >
      {icon}
      {label}
      {typeof count === 'number' && count > 0 && (
        <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
      )}
    </button>
  );
}

function KpiCard({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'default' | 'success' | 'warning';
}) {
  const styles = {
    default: 'bg-white border-canvas-200',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
  }[tone];
  const iconTone = {
    default: 'text-ink-700',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
  }[tone];
  return (
    <Card className={`${styles} p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</p>
          <p className="text-xl font-bold text-ink-900 mt-1">{value}</p>
        </div>
        <Icon className={`w-7 h-7 ${iconTone}`} />
      </div>
    </Card>
  );
}

// ─── Liste documents (factures / devis / avoirs) ─────────────────────────────

interface DocumentListProps {
  documents: Invoice[];
  kind: DocumentKind;
  getClientName: (id: string) => string;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: '' | InvoiceStatus;
  setStatusFilter: (s: '' | InvoiceStatus) => void;
  onCreate: () => void;
  onPreview: (id: string) => void;
  onDownloadPdf: (inv: Invoice) => void;
  onDownloadExcel: (inv: Invoice) => void;
  onDownloadWord: (inv: Invoice) => void;
  onSendEmail: (inv: Invoice) => void;
  onSendReminder: (inv: Invoice, level: 1 | 2 | 3) => void;
  onMarkSent: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onCancel: (id: string) => void;
  onConvertDevis: (id: string) => void;
  onCreateAvoir: (inv: Invoice) => void;
}

function DocumentList(props: DocumentListProps) {
  const isDevis = props.kind === 'devis';
  const isAvoir = props.kind === 'avoir';
  const docLabel = isDevis ? 'devis' : isAvoir ? 'avoir' : 'facture';

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder={`Rechercher un ${docLabel}…`}
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
          className="flex-1 max-w-md"
        />
        <Select
          value={props.statusFilter}
          onChange={(e) => props.setStatusFilter(e.target.value as '' | InvoiceStatus)}
          options={STATUS_FILTER_OPTIONS}
          className="w-48"
        />
        <Button variant="primary" size="sm" onClick={props.onCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Nouveau {docLabel}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas-50 text-ink-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">N°</th>
                  <th className="px-3 py-2 text-left font-medium">Client</th>
                  <th className="px-3 py-2 text-left font-medium">Émission</th>
                  <th className="px-3 py-2 text-left font-medium">Échéance</th>
                  <th className="px-3 py-2 text-right font-medium">TTC</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.documents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-ink-500">
                      Aucun {docLabel}. Cliquez sur « Nouveau {docLabel} » pour démarrer.
                    </td>
                  </tr>
                )}
                {props.documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-canvas-100 hover:bg-canvas-50">
                    <td className="px-3 py-2 font-mono text-xs">{doc.invoiceNumber}</td>
                    <td className="px-3 py-2">{props.getClientName(doc.clientId)}</td>
                    <td className="px-3 py-2">{doc.issueDate.toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2">{doc.dueDate.toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatCurrency(doc.totalFcfa, 'XAF')}
                    </td>
                    <td className="px-3 py-2">
                      <InvoiceStatusBadge status={doc.status} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconBtn title="Aperçu" onClick={() => props.onPreview(doc.id)}>
                          <Eye className="w-4 h-4" />
                        </IconBtn>
                        <IconBtn title="PDF" onClick={() => props.onDownloadPdf(doc)}>
                          <FileDown className="w-4 h-4 text-rose-700" />
                        </IconBtn>
                        <IconBtn title="Excel" onClick={() => props.onDownloadExcel(doc)}>
                          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                        </IconBtn>
                        <IconBtn title="Word" onClick={() => props.onDownloadWord(doc)}>
                          <FileText className="w-4 h-4 text-sky-700" />
                        </IconBtn>
                        {doc.status === 'draft' && (
                          <IconBtn title="Envoyer" onClick={() => props.onSendEmail(doc)}>
                            <Send className="w-4 h-4 text-ink-700" />
                          </IconBtn>
                        )}
                        {doc.status === 'overdue' && (
                          <IconBtn title="Envoyer relance" onClick={() => props.onSendReminder(doc, 1)}>
                            <Mail className="w-4 h-4 text-amber-700" />
                          </IconBtn>
                        )}
                        {isDevis && doc.status !== 'cancelled' && (
                          <IconBtn title="Convertir en facture" onClick={() => props.onConvertDevis(doc.id)}>
                            <ArrowRight className="w-4 h-4 text-emerald-700" />
                          </IconBtn>
                        )}
                        {!isDevis && !isAvoir && (doc.status === 'sent' || doc.status === 'overdue') && (
                          <IconBtn title="Marquer payée" onClick={() => props.onMarkPaid(doc.id)}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          </IconBtn>
                        )}
                        {!isDevis && !isAvoir && doc.status === 'paid' && (
                          <IconBtn title="Créer un avoir" onClick={() => props.onCreateAvoir(doc)}>
                            <Banknote className="w-4 h-4 text-amber-700" />
                          </IconBtn>
                        )}
                        {doc.status !== 'cancelled' && doc.status !== 'paid' && (
                          <IconBtn title="Annuler" onClick={() => props.onCancel(doc.id)}>
                            <XCircle className="w-4 h-4 text-rose-700" />
                          </IconBtn>
                        )}
                        {doc.status === 'draft' && (
                          <IconBtn title="Marquer envoyée" onClick={() => props.onMarkSent(doc.id)}>
                            <Send className="w-4 h-4 text-sky-700" />
                          </IconBtn>
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
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-canvas-100 transition-colors"
    >
      {children}
    </button>
  );
}

// ─── Email modal ─────────────────────────────────────────────────────────────

interface EmailModalProps {
  invoice: Invoice;
  level?: 1 | 2 | 3;
  defaultEmail: string;
  onClose: () => void;
  onSent: () => Promise<void> | void;
}

function EmailModal({ invoice, level, defaultEmail, onClose, onSent }: EmailModalProps) {
  const [to, setTo] = useState(defaultEmail);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(
    level
      ? (level === 1 ? 'Rappel — facture en attente' : level === 2 ? 'Second rappel — facture en retard' : 'Mise en demeure')
      : `Facture ${invoice.invoiceNumber}`,
  );
  const [body, setBody] = useState(
    level
      ? (level === 1 ? 'Sauf erreur, nous n\'avons pas reçu le règlement…' : level === 2 ? 'Malgré notre rappel précédent…' : 'En l\'absence de règlement sous 7 jours…')
      : 'Bonjour, veuillez trouver ci-joint notre facture. Cordialement.',
  );
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      if (level) {
        await BillingService.sendReminder(invoice.id, level, to);
      } else {
        await BillingService.sendByEmail(invoice.id, { to, cc, subject, body });
      }
      await onSent();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erreur envoi');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={level ? `Relance niveau ${level}` : `Envoyer ${invoice.invoiceNumber}`}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={send} disabled={sending || !to}>
            <Send className="w-4 h-4 mr-1" />
            {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1">Destinataire *</label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" type="email" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1">Copie carbone</label>
          <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com (optionnel)" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1">Objet</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-canvas-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <p className="text-[11px] text-ink-500 italic">
          La facture sera jointe au format PDF. Si l'Edge Function `send-invoice-email`
          n'est pas configurée, votre client mail s'ouvrira en mailto: avec le sujet
          et le corps pré-remplis.
        </p>
      </div>
    </Modal>
  );
}
