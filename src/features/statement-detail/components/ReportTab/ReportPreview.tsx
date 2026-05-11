// ============================================================================
// ReportPreview — apercu du rapport genere (HTML, pas PDF embed)
// ============================================================================
// Le PDF est genere cote serveur (Edge Function generate-report).
// En mode offline/mock, on affiche un apercu HTML stylise.
// Si l'URL pointe vers un vrai fichier, on tente l'embed PDF.
// ============================================================================

import { FileText, Download, CheckCircle2 } from 'lucide-react';
import { ReportOptions } from './ReportOptions';
import type { SignedReport } from '../../types/statement.types';

interface ReportPreviewProps {
  report: SignedReport;
}

function isRealUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:');
}

export function ReportPreview({ report }: ReportPreviewProps) {
  const hasRealPdf = isRealUrl(report.documentUrl);

  return (
    <div className="bg-white border border-canvas-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-canvas-200 bg-canvas-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Apercu du rapport</h3>
        <span className="text-[10px] font-mono text-ink-500">
          hash {report.hash.slice(0, 12)}...
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
        <div className="lg:col-span-2">
          {hasRealPdf ? (
            <embed
              src={report.documentUrl}
              type="application/pdf"
              className="w-full rounded border border-canvas-200"
              style={{ height: 600 }}
            />
          ) : (
            <ReportHtmlPreview report={report} />
          )}
        </div>
        <ReportOptions />
      </div>
    </div>
  );
}

// ============================================================================
// HTML preview fallback — rendered when no real PDF is available
// ============================================================================

function ReportHtmlPreview({ report }: { report: SignedReport }) {
  const templateLabel = report.template === 'valeur_probante'
    ? 'Rapport valeur probante'
    : report.template === 'synthese'
      ? 'Rapport synthese'
      : 'Export comptable';

  return (
    <div className="border border-canvas-200 rounded-lg bg-white overflow-hidden" style={{ height: 600, overflowY: 'auto' }}>
      {/* Simulated A4 page */}
      <div className="p-8 max-w-[640px] mx-auto">
        {/* Header */}
        <div className="border-b-2 border-ink-900 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-ink-900">AtlasBanx</h1>
              <p className="text-xs text-ink-500">Plateforme d'audit bancaire UEMOA/CEMAC</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-500">Document genere le</p>
              <p className="text-sm font-mono text-ink-700">
                {report.createdAt
                  ? new Date(report.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-base font-bold text-ink-900 uppercase tracking-wider">{templateLabel}</h2>
          <p className="text-xs text-ink-500 mt-1">Releve bancaire · Periode d'audit</p>
        </div>

        {/* Status badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            report.status === 'signed' || report.status === 'sent'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {report.status === 'signed' || report.status === 'sent' ? (
              <><CheckCircle2 className="w-3 h-3" /> Signe</>
            ) : (
              <><FileText className="w-3 h-3" /> Brouillon</>
            )}
          </span>
        </div>

        {/* Sections */}
        <div className="space-y-5">
          <Section title="Identification">
            <Row label="Template" value={templateLabel} />
            <Row label="Statut" value={report.status} />
            {report.signatureType && <Row label="Type de signature" value={report.signatureType === 'advist' ? 'ADVIST (legalement opposable)' : 'Signature simple'} />}
            {report.signedAt && <Row label="Signe le" value={new Date(report.signedAt).toLocaleString('fr-FR')} />}
          </Section>

          <Section title="Integrite">
            <Row label="Hash SHA-256" value={report.hash} mono />
            {report.timestampRfc3161 && <Row label="Horodatage RFC 3161" value={report.timestampRfc3161} mono />}
          </Section>

          {report.recipients.length > 0 && (
            <Section title="Destinataires">
              {report.recipients.map((r, i) => (
                <Row key={i} label={r.displayName} value={`${r.email} (${r.audience})`} />
              ))}
            </Section>
          )}

          {report.proofBundleUrl && (
            <Section title="Preuve">
              <Row label="Bundle ADVIST" value={report.proofBundleUrl} mono />
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-canvas-200 text-center">
          <p className="text-[10px] text-ink-400">
            Ce document a ete genere par AtlasBanx. L'integrite peut etre verifiee
            via le hash SHA-256 ci-dessus.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-ink-700 uppercase tracking-wider mb-2 border-b border-canvas-100 pb-1">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-ink-500 shrink-0 w-32">{label}</span>
      <span className={`text-ink-900 ${mono ? 'font-mono text-[11px] break-all' : ''}`}>{value}</span>
    </div>
  );
}
