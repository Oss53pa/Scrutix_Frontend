// ============================================================================
// ForensicExportButton — bouton Export forensique ZIP scellé
// ============================================================================
// Câble le ForensicExporter (CDC §8.3) au flux UI de la page rapport.
// ============================================================================

import { useState } from 'react';
import { ShieldCheck, Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ForensicExporter, createDevExporter } from '../../../../cdc/export/ForensicExporter';
import type { ForensicBundle } from '../../../../cdc/export/ForensicExporter';
import type {
  Anomaly,
  SignedReport,
  BankReconciliation,
  AccountConvention,
} from '../../types/statement.types';
import type { CdcAuditSession, ResolutionResult } from '../../../../cdc/types';

interface ForensicExportButtonProps {
  /** Rapport signé. Le bouton n'apparaît que si status === 'signed' ou 'sent'. */
  signedReport: SignedReport | null;
  /** Données pour assembler le bundle. */
  statementId: string;
  tenantId: string;
  organizationId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  anomalies: Anomaly[];
  reconciliation: BankReconciliation | null;
  convention: AccountConvention | null;
  /** Receipts du moteur de résolution si disponibles. */
  receipts?: ResolutionResult[];
  /** Bytes du PDF source du relevé. */
  statementFileBytes?: Uint8Array;
  statementFileName?: string;
}

export function ForensicExportButton(props: ForensicExportButtonProps) {
  const [state, setState] = useState<'idle' | 'building' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  if (!props.signedReport || props.signedReport.status === 'draft') return null;

  async function exportBundle() {
    setState('building');
    setError(null);
    try {
      // Bundle minimal — receipts vides si pas dispo, fichier source vide si pas dispo
      const session: CdcAuditSession = {
        id: props.statementId,
        tenantId: props.tenantId,
        organizationId: props.organizationId,
        accountId: props.accountId,
        periodStart: new Date(props.periodStart),
        periodEnd: new Date(props.periodEnd),
        status: 'completed',
        totalOperations: 0,
        totalEcarts: props.anomalies.length,
        totalImpactCentimes: BigInt(
          props.anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0),
        ),
        ecartsByCode: {} as never,
        startedAt: new Date(props.periodStart),
        completedAt: new Date(),
        startedBy: null,
        error: null,
        createdAt: new Date(),
      };

      const bundle: ForensicBundle = {
        session,
        statementFile: {
          name: props.statementFileName ?? 'statement.pdf',
          bytes: props.statementFileBytes ?? new Uint8Array(0),
          mimeType: 'application/pdf',
        },
        receipts: props.receipts ?? [],
        agreements: props.convention ? [{
          agreement: {
            id: props.convention.id,
            layer: 4,
            scopeOrgId: props.organizationId,
            bankId: 'unknown',
            accountId: props.accountId,
            agreementLabel: 'Convention compte',
            signedAt: new Date(props.convention.signedDate),
            validFrom: new Date(props.convention.signedDate),
            validTo: props.convention.expiresDate ? new Date(props.convention.expiresDate) : null,
            recordedFrom: new Date(props.convention.createdAt),
            recordedTo: null,
            sourcePdfUrl: props.convention.documentUrl,
            sourceHashSha256: null,
            validationStatus: 'validated',
            validatedBy: null,
            supersededBy: null,
            createdAt: new Date(props.convention.createdAt),
          },
          conditions: [],
        }] : [],
        bankReferenceVersions: [],
        calculations: {},
        ecarts: props.anomalies.map((a) => ({
          id: a.id,
          auditSessionId: props.statementId,
          code: 'E01',
          rubricCode: a.type,
          resolutionId: null,
          expectedCentimes: BigInt(0),
          actualCentimes: BigInt(a.transaction.amountCentimes),
          ecartCentimes: BigInt(a.potentialRecoveryCentimes ?? 0),
          scoring: {
            materialiteCentimes: BigInt(a.potentialRecoveryCentimes ?? 0),
            confiance: Math.round(a.detection.confidence * 100),
            recuperabilite: 'moyenne' as const,
          },
          operationDate: new Date(a.transaction.date),
          operationRef: a.transaction.id,
          description: a.title,
          details: { algorithm: a.detection.algorithm, rule: a.detection.rule },
        })),
      };

      // Exporter avec clé dérivée du tenant (DEV) — en prod câbler clé Vault
      const exporter: ForensicExporter = createDevExporter(props.tenantId);
      const { blob, manifest } = await exporter.exportBundle(bundle);
      const url = URL.createObjectURL(blob);

      setDownloadUrl(url);
      setState('done');

      // Auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = `forensic-${props.statementId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();

      console.log('[forensic-export] manifest:', manifest);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'export failed');
    }
  }

  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-emerald-900">Export forensique</h3>
          <p className="text-xs text-emerald-800 mt-1">
            ZIP scellé contenant relevé, conventions, receipts signés, calculs, écarts
            et signature globale HMAC-SHA256. Conservation 10 ans (OHADA).
          </p>

          <div className="mt-3 flex items-center gap-2">
            {state === 'idle' && (
              <button
                onClick={exportBundle}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                Générer le bundle scellé
              </button>
            )}
            {state === 'building' && (
              <span className="px-3 py-1.5 text-xs text-emerald-700 inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Construction du bundle…
              </span>
            )}
            {state === 'done' && (
              <>
                <span className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Bundle généré + téléchargé
                </span>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download
                    className="text-xs text-emerald-800 underline"
                  >
                    Re-télécharger
                  </a>
                )}
              </>
            )}
            {state === 'error' && (
              <span className="text-xs text-rose-700 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Échec : {error}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
