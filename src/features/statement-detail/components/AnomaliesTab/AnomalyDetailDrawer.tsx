// ============================================================================
// AnomalyDetailDrawer — drawer 480px à droite, détail complet d'une anomalie
// ============================================================================
// Délègue à AnomalyComments + AnomalyAuditTrail (composants spec §7).
// ============================================================================

import { X, ChevronUp, ChevronDown, ExternalLink, ChevronRight as ChevR } from 'lucide-react';
import {
  SeverityPill, StatusPill, AmountFCFA, RelativeDate,
} from '../../../../components/shared';
import type { MentionableUser } from '../../../../components/shared';
import { WorkflowSteps } from './WorkflowSteps';
import { AnomalyComments } from './AnomalyComments';
import { AnomalyAuditTrail } from './AnomalyAuditTrail';
import type { Anomaly, AnomalyComment, AuditEntry, DialogAction } from '../../types/statement.types';
import { getAvailableActions } from '../../workflow/anomalyActions';
import { useRole } from '../../../../workspace/useWorkspace';

interface AnomalyDetailDrawerProps {
  anomaly: Anomaly;
  comments: AnomalyComment[];
  auditTrail: AuditEntry[];
  team: MentionableUser[];
  convention?: { id: string; label: string; signedDate: string } | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onOpenPdfAt?: (page: number | undefined) => void;
  onOpenConvention?: (conventionId: string) => void;
  onSubmitComment: (text: string, mentions: string[]) => void;
  onAction: (action: DialogAction, anomaly: Anomaly) => void;
}

export function AnomalyDetailDrawer(props: AnomalyDetailDrawerProps) {
  const { anomaly, comments, auditTrail, team, convention } = props;
  const { role } = useRole();
  const actions = role ? getAvailableActions(role, anomaly) : [];

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-white shadow-2xl border-l border-canvas-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-canvas-200 bg-canvas-50">
        <button onClick={props.onClose} className="p-1.5 rounded hover:bg-canvas-200">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={props.onPrev} disabled={!props.onPrev} className="p-1 rounded hover:bg-canvas-200 disabled:opacity-30">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button onClick={props.onNext} disabled={!props.onNext} className="p-1 rounded hover:bg-canvas-200 disabled:opacity-30">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityPill severity={anomaly.severity} />
            <StatusPill status={anomaly.status} />
          </div>
          <h2 className="mt-2 text-base font-semibold text-ink-900">{anomaly.title}</h2>
          <p className="text-xs text-ink-600 mt-1">{anomaly.description}</p>
        </div>

        <Section title="Transaction concernée">
          <Row label="Date"><RelativeDate date={anomaly.transaction.date} /></Row>
          <Row label="Libellé"><span className="font-mono text-xs">{anomaly.transaction.label}</span></Row>
          <Row label="Montant"><AmountFCFA value={anomaly.transaction.amountCentimes} colorize /></Row>
          {anomaly.transaction.balanceAfterCentimes !== undefined && (
            <Row label="Solde après"><AmountFCFA value={anomaly.transaction.balanceAfterCentimes} /></Row>
          )}
          <button
            onClick={() => props.onOpenPdfAt?.(anomaly.transaction.pdfPage)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"
          >
            Voir dans le PDF source
            <ExternalLink className="w-3 h-3" />
          </button>
        </Section>

        <Section title="Détection">
          <Row label="Algorithme"><span className="font-mono text-xs">{anomaly.detection.algorithm}</span></Row>
          <Row label="Confiance"><span className="text-xs">{Math.round(anomaly.detection.confidence * 100)}%</span></Row>
          <Row label="Règle"><span className="text-xs text-ink-700">{anomaly.detection.rule}</span></Row>
        </Section>

        <Section title="Workflow">
          <WorkflowSteps anomaly={anomaly} className="mb-3" />
          <AnomalyComments
            anomalyId={anomaly.id}
            comments={comments}
            team={team}
            onSubmit={props.onSubmitComment}
          />
        </Section>

        {convention && (
          <Section title="Convention de référence">
            <p className="text-xs text-ink-700">{convention.label}</p>
            <button
              onClick={() => props.onOpenConvention?.(convention.id)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"
            >
              Voir la convention
              <ExternalLink className="w-3 h-3" />
            </button>
          </Section>
        )}

        {actions.length > 0 && (
          <Section title="Actions disponibles">
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.opens}
                  onClick={() => props.onAction(a, anomaly)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded ${
                    a.primary
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'border border-canvas-300 text-ink-700 hover:bg-canvas-50'
                  }`}
                >
                  {a.label}
                  {a.primary && <ChevR className="inline-block w-3 h-3 ml-0.5" />}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ink-500 italic">
              Cette action sera consignée dans la piste d'audit.
            </p>
          </Section>
        )}

        <AnomalyAuditTrail anomalyId={anomaly.id} auditTrail={auditTrail} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-canvas-100 pt-3">
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-xs">
      <span className="text-ink-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
