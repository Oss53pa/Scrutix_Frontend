// ============================================================================
// ReportViewerPage — visualiseur plein écran 3 colonnes
// ============================================================================
// Architecture inspirée du composant ReportViewer généraliste de l'app :
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Toolbar : retour · titre · statut · zoom · imprimer · signer │
//   ├──────┬─────────────────────────────────────────────┬─────────┤
//   │ LEFT │              CENTER (A4 zoom)               │  RIGHT  │
//   │ TOC  │                                             │ OPTIONS │
//   │ Sec  │            ReportDocumentBody               │ + ACTNS │
//   │ tion │                                             │         │
//   └──────┴─────────────────────────────────────────────┴─────────┘
//
// Le centre rend le document A4 (210mm × 297mm) avec zoom variable
// (50 % à 200 %). La sidebar gauche affiche la table des matières
// (sections cliquables) ; la droite expose les ReportOptions
// (niveau de détail, toggles), le récapitulatif et les actions
// Enregistrer / Signer & envoyer.
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Printer, Download, Send, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Pencil, Eye, Save, FileText, ListTree, Sliders, RefreshCw,
} from 'lucide-react';
import { ReportDocumentBody, type ReportPreviewProps } from './ReportPreview';
import {
  ReportOptions, REPORT_OPTIONS_DEFAULTS, type ReportOptionsState,
} from './ReportOptions';
import { SignAndSendCard } from './SignAndSendCard';
import type { SignedReport, SignatureType, ReportRecipient } from '../../types/statement.types';

interface ReportViewerPageProps extends ReportPreviewProps {
  onBack: () => void;
  currentUser: { handle: string; displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  onSignAndSend?: (args: {
    reportId: string;
    signatureType: SignatureType;
    recipients: ReportRecipient[];
    message: string;
  }) => Promise<void>;
  onSave?: (report: SignedReport) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
}

type SidebarTab = 'options' | 'sections' | 'summary';

const TEMPLATE_LABEL: Record<string, string> = {
  synthese:        'Rapport synthèse',
  valeur_probante: 'Rapport valeur probante',
  export:          'Export comptable',
};

export function ReportViewerPage(props: ReportViewerPageProps) {
  const [showSign, setShowSign] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [editMode, setEditMode] = useState(true);
  const [options, setOptions] = useState<ReportOptionsState>(REPORT_OPTIONS_DEFAULTS);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('options');
  const [showLeftBar, setShowLeftBar] = useState(true);
  const [showRightBar, setShowRightBar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Zoom keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 10, 200));
      else if (e.key === '-') setZoom((z) => Math.max(z - 10, 50));
      else if (e.key === 'Escape' && !showSign) props.onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props, showSign]);

  // ── Print : route le document via une fenêtre dédiée pour éviter les
  //          collisions de styles globaux (la règle `body > *:not(...)` du
  //          index.css cachait notre overlay fullscreen, d'où l'aperçu vide).
  function handlePrint() {
    if (!previewRef.current) return;
    const docHtml = previewRef.current.innerHTML;
    const titleSafe = templateLabel.replace(/[^a-zA-Z0-9 ]/g, '');
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!w) {
      // Fallback : pop-up bloqué — utilise le print natif (peut être vide).
      window.print();
      return;
    }
    // Copie les styles Tailwind + variables CSS de la page principale.
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((n) => n.outerHTML).join('\n');
    w.document.write(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${titleSafe}</title>
${styles}
<style>
  @page { size: A4 portrait; margin: 12mm 10mm; }
  body { background:#fff; color:#0f0e0a; font-family: 'Dosis', system-ui, sans-serif; }
  .report-print-page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; }
  .report-print-page * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
</style>
</head><body>
<div class="report-print-page">${docHtml}</div>
<script>window.addEventListener('load', () => { setTimeout(() => { window.focus(); window.print(); window.close(); }, 300); });</script>
</body></html>`);
    w.document.close();
  }

  // Fullscreen toggle
  useEffect(() => {
    if (isFullscreen) containerRef.current?.requestFullscreen?.();
    else if (document.fullscreenElement) document.exitFullscreen?.();
  }, [isFullscreen]);

  const templateLabel = TEMPLATE_LABEL[props.report.template] ?? 'Rapport';

  // Table des matières : générée dynamiquement selon le template + detailLevel
  const toc = buildToc(props.report.template, options.detailLevel, props.anomalies?.length ?? 0);

  function scrollToSection(anchor: string) {
    const el = previewRef.current?.querySelector(`[data-section="${anchor}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSave() {
    if (!props.onSave) return;
    setSaving(true);
    try {
      await props.onSave(props.report);
      setSavedAt(new Date().toLocaleTimeString('fr-FR'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    if (!props.onRefresh) return;
    setRefreshing(true);
    try {
      await props.onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-canvas-100 flex flex-col overflow-hidden print:static print:overflow-visible print:bg-white"
    >
      {/* ── Header Toolbar ────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-canvas-200 px-4 py-2 flex items-center justify-between shrink-0 print:hidden no-print">
        {/* Left : back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={props.onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-ink-700 hover:bg-canvas-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au relevé
          </button>
          <div className="h-5 w-px bg-canvas-200" />
          <span className="text-sm font-semibold text-ink-900 truncate">{templateLabel}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            props.report.status === 'signed' || props.report.status === 'sent'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {props.report.status === 'draft' ? 'Brouillon'
              : props.report.status === 'signed' ? 'Signé'
              : props.report.status === 'sent' ? 'Envoyé'
              : props.report.status}
          </span>
          {savedAt && (
            <span className="text-[10px] text-emerald-600">Enregistré · {savedAt}</span>
          )}
        </div>

        {/* Center : zoom controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(z - 10, 50))} className="p-1.5 rounded hover:bg-canvas-100" title="Zoom −">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom(100)} className="px-2 py-1 rounded hover:bg-canvas-100 text-xs font-mono min-w-[48px]" title="Zoom 100%">
            {zoom}%
          </button>
          <button onClick={() => setZoom((z) => Math.min(z + 10, 200))} className="p-1.5 rounded hover:bg-canvas-100" title="Zoom +">
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-canvas-200 mx-2" />
          <button
            onClick={() => setEditMode(!editMode)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-canvas-300 hover:bg-canvas-50"
            title={editMode ? 'Passer en lecture seule' : 'Activer l\'édition'}
          >
            {editMode ? <><Pencil className="w-3 h-3" /> Édition</> : <><Eye className="w-3 h-3" /> Lecture</>}
          </button>
        </div>

        {/* Right : actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLeftBar((v) => !v)}
            className={`p-1.5 rounded transition-colors ${showLeftBar ? 'bg-canvas-200 text-ink-900' : 'text-ink-500 hover:bg-canvas-100'}`}
            title="Plan / Sections"
          >
            <ListTree className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowRightBar((v) => !v)}
            className={`p-1.5 rounded transition-colors ${showRightBar ? 'bg-canvas-200 text-ink-900' : 'text-ink-500 hover:bg-canvas-100'}`}
            title="Options"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen((v) => !v)}
            className="p-1.5 rounded text-ink-500 hover:bg-canvas-100"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <div className="h-5 w-px bg-canvas-200" />
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-canvas-300 hover:bg-canvas-50"
            title="Imprimer (ouvre l'aperçu dans une fenêtre dédiée)"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer
          </button>
          {props.report.documentUrl && (
            <a
              href={props.report.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-canvas-300 hover:bg-canvas-50"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </a>
          )}
          <button
            onClick={() => setShowSign(!showSign)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"
          >
            <Send className="w-3.5 h-3.5" />
            Signer et envoyer
          </button>
        </div>
      </header>

      {/* ── Main : 3 columns ──────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT SIDEBAR — Table des matières */}
        {showLeftBar && !showSign && (
          <aside className="w-64 shrink-0 bg-white border-r border-canvas-200 flex flex-col print:hidden no-print">
            <div className="px-3 py-2 border-b border-canvas-200 flex items-center gap-2">
              <ListTree className="w-3.5 h-3.5 text-ink-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-700">Sommaire</h3>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {toc.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToSection(item.anchor)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-canvas-50 flex items-center gap-2 ${
                    item.indent ? 'pl-6 text-ink-500' : 'font-medium text-ink-800'
                  }`}
                >
                  <span className="font-mono text-[10px] text-ink-400">{item.number}</span>
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="px-3 py-2 border-t border-canvas-200">
              <p className="text-[10px] text-ink-500">
                {toc.length} sections · niveau <strong className="text-ink-700">{options.detailLevel}</strong>
              </p>
            </div>
          </aside>
        )}

        {/* CENTER — A4 preview */}
        <main className="flex-1 overflow-auto bg-canvas-200 p-6 min-w-0 print:p-0 print:bg-white">
          {showSign ? (
            <div className="max-w-2xl mx-auto">
              <SignAndSendCard
                report={props.report}
                currentUser={props.currentUser}
                onSignAndSend={props.onSignAndSend}
              />
            </div>
          ) : (
            <div
              className="flex justify-center print:block"
              style={{ minWidth: 'fit-content' }}
            >
              <div
                ref={previewRef}
                className="bg-white shadow-elevated print:shadow-none transition-transform duration-150 printable-content"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  marginBottom: `${(zoom - 100) * 3}px`,
                }}
              >
                <ReportDocumentBody
                  report={props.report}
                  statement={props.statement}
                  anomalies={props.anomalies ?? []}
                  reconciliation={props.reconciliation}
                  cabinet={props.cabinet}
                  options={options}
                  sourcePdfUrl={props.sourcePdfUrl}
                  complaintLetterText={props.complaintLetterText}
                  editable={editMode}
                />
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR — Options, récapitulatif, actions */}
        {showRightBar && !showSign && (
          <aside className="w-[340px] shrink-0 bg-white border-l border-canvas-200 flex flex-col print:hidden no-print">
            {/* Tabs */}
            <div className="flex border-b border-canvas-200 shrink-0">
              <TabBtn label="Options"  active={sidebarTab === 'options'}  onClick={() => setSidebarTab('options')} />
              <TabBtn label="Récap"    active={sidebarTab === 'summary'}  onClick={() => setSidebarTab('summary')} />
              <TabBtn label="Sections" active={sidebarTab === 'sections'} onClick={() => setSidebarTab('sections')} />
            </div>

            {/* Tab body */}
            <div className="flex-1 overflow-y-auto p-3">
              {sidebarTab === 'options' && (
                <ReportOptions value={options} onChange={setOptions} />
              )}
              {sidebarTab === 'summary' && (
                <RecapPanel
                  templateLabel={templateLabel}
                  anomalies={props.anomalies ?? []}
                  options={options}
                  report={props.report}
                />
              )}
              {sidebarTab === 'sections' && (
                <SectionsPanel toc={toc} onJump={scrollToSection} />
              )}
            </div>

            {/* Footer — actions */}
            <div className="shrink-0 border-t border-canvas-200 p-3 space-y-2">
              {props.onRefresh && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-canvas-300 hover:bg-canvas-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Mettre à jour
                </button>
              )}
              {props.onSave && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors ${
        active ? 'border-ink-900 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-700'
      }`}
    >
      {label}
    </button>
  );
}

function RecapPanel({
  templateLabel, anomalies, options, report,
}: {
  templateLabel: string;
  anomalies: import('../../types/statement.types').Anomaly[];
  options: ReportOptionsState;
  report: SignedReport;
}) {
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);
  const sev = {
    c: anomalies.filter((a) => a.severity === 'critical').length,
    h: anomalies.filter((a) => a.severity === 'high').length,
    m: anomalies.filter((a) => a.severity === 'medium').length,
    l: anomalies.filter((a) => a.severity === 'low').length,
  };
  return (
    <div className="space-y-2 text-xs">
      <RecapRow label="Template"  value={templateLabel} />
      <RecapRow label="Niveau"    value={<span className="capitalize">{options.detailLevel}</span>} />
      <RecapRow label="Statut"    value={report.status} />
      <RecapRow label="Anomalies" value={`${anomalies.length}`} />
      <RecapRow label="  Critiques" value={`${sev.c}`} valueClass="text-rose-700 font-semibold" />
      <RecapRow label="  Hautes"    value={`${sev.h}`} valueClass="text-orange-700 font-semibold" />
      <RecapRow label="  Moyennes"  value={`${sev.m}`} valueClass="text-amber-700 font-semibold" />
      <RecapRow label="  Faibles"   value={`${sev.l}`} valueClass="text-ink-500" />
      <RecapRow label="Récupérable" value={`${fmtFcfa(totalRecovery)} FCFA`} valueClass="font-bold text-ink-900" />
      <div className="pt-2 border-t border-canvas-200 mt-2">
        <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Options actives</p>
        <ul className="text-[11px] text-ink-700 space-y-0.5">
          <li>{options.includeComplaint  ? '✓' : '○'} Lettre de réclamation</li>
          <li>{options.includeSourcePdf  ? '✓' : '○'} PDF source du relevé</li>
          <li>{options.customLogo        ? '✓' : '○'} En-tête personnalisée</li>
        </ul>
      </div>
      <div className="pt-2 border-t border-canvas-200 mt-2">
        <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Intégrité</p>
        <p className="text-[10px] font-mono text-ink-500 break-all">SHA-256 : {report.hash}</p>
        {report.timestampRfc3161 && (
          <p className="text-[10px] font-mono text-ink-500 mt-0.5">RFC 3161 : {report.timestampRfc3161.slice(0, 32)}…</p>
        )}
      </div>
    </div>
  );
}

function RecapRow({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ink-500">{label}</span>
      <span className={`text-ink-800 ${valueClass}`}>{value}</span>
    </div>
  );
}

function SectionsPanel({ toc, onJump }: { toc: TocItem[]; onJump: (anchor: string) => void }) {
  return (
    <div className="space-y-1">
      {toc.map((item, idx) => (
        <button
          key={idx}
          onClick={() => onJump(item.anchor)}
          className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-canvas-50 flex items-center gap-2 ${
            item.indent ? 'pl-6 text-ink-500' : 'font-medium text-ink-800'
          }`}
        >
          <span className="font-mono text-[10px] text-ink-400">{item.number}</span>
          <span className="flex-1">{item.label}</span>
          {item.optional && <FileText className="w-3 h-3 text-ink-300" />}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Table des matières — calculée selon le template + niveau de détail
// ============================================================================

interface TocItem {
  number: string;
  label: string;
  anchor: string;
  indent?: boolean;
  optional?: boolean;
}

function buildToc(
  template: string,
  detail: 'synthese' | 'standard' | 'exhaustif',
  anomaliesCount: number,
): TocItem[] {
  const isProbante = template === 'valeur_probante';
  const isExport   = template === 'export';
  const isSyn = detail === 'synthese';
  const isExh = detail === 'exhaustif';

  if (isExport) {
    const items: TocItem[] = [
      { number: '1.', label: 'Écritures de redressement', anchor: 'section-1' },
    ];
    if (!isSyn) items.push({ number: '2.', label: 'Mapping plan comptable', anchor: 'section-2' });
    if (isExh)  items.push({ number: '3.', label: 'Données structurées (JSON/CSV)', anchor: 'section-3' });
    return items;
  }

  const items: TocItem[] = [
    { number: '1.', label: 'Synthèse', anchor: 'section-1' },
    { number: '2.', label: `Anomalies détectées (${anomaliesCount})`, anchor: 'section-2' },
  ];
  let n = 3;
  if (isProbante) {
    items.push({ number: `${n}.`, label: 'État de rapprochement SYSCOHADA', anchor: `section-${n}` });
    n++;
    if (!isSyn) {
      items.push({ number: `${n}.`, label: 'Workflow de validation', anchor: `section-${n}` });
      n++;
    }
  }
  if (isExh) {
    items.push({ number: `${n}.`, label: 'Annexe statistique', anchor: `section-${n}`, optional: true });
    n++;
  }
  items.push({ number: `${n}.`, label: 'Recommandations', anchor: `section-${n}` });
  return items;
}

function fmtFcfa(centimes: number): string {
  if (!centimes) return '0';
  const u = Math.round(centimes / 100);
  return new Intl.NumberFormat('fr-FR').format(u).replace(/ /g, ' ');
}
