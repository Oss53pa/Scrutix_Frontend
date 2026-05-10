// ============================================================================
// AnomalyDetailDrawer — drawer 480px à droite, détail complet d'une anomalie
// ============================================================================

import { useState } from 'react';
import { X, ChevronUp, ChevronDown, ExternalLink, ChevronRight as ChevR } from 'lucide-react';
import {
  SeverityPill, StatusPill, AmountFCFA, WorkflowSteps, RelativeDate, UserPill, MentionInput,
} from '../../../../components/shared';
import type { MentionableUser } from '../../../../components/shared';
import type { Anomaly, AnomalyComment, AuditEntry, DialogAction } from '../../types/statement.types';
import { getAvailableActions } from '../../workflow/anomalyActions';
import { useRole } from '../../../../workspace/useWorkspace';

interface AnomalyDetailDrawerProps {
  anomaly: Anomaly;
  comments: AnomalyComment[];
  auditTrail: AuditEntry[];
  team: MentionableUser[];
  /** Convention référencée si applicable. */
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

  const [draft, setDraft] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-white shadow-2xl border-l border-canvas-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-canvas-200 bg-canvas-50">
        <button onClick={props.onClose} className="p-1.5 rounded hover:bg-canvas-200">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={props.onPrev}
            disabled={!props.onPrev}
            className="p-1 rounded hover:bg-canvas-200 disabled:opacity-30"
            title="Anomalie précédente"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={props.onNext}
            disabled={!props.onNext}
            className="p-1 rounded hover:bg-canvas-200 disabled:opacity-30"
            title="Anomalie suivante"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
        {/* Titre + sévérité + statut */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityPill severity={anomaly.severity} />
            <StatusPill status={anomaly.status} />
          </div>
          <h2 className="mt-2 text-base font-semibold text-ink-900">{anomaly.title}</h2>
          <p className="text-xs text-ink-600 mt-1">{anomaly.description}</p>
        </div>

        {/* Section: Transaction concernée */}
        <Section title="Transaction concernée">
          <Row label="Date">
            <RelativeDate date={anomaly.transaction.date} />
          </Row>
          <Row label="Libellé">
            <span className="font-mono text-xs">{anomaly.transaction.label}</span>
          </Row>
          <Row label="Montant">
            <AmountFCFA value={anomaly.transaction.amountCentimes} colorize />
          </Row>
          {anomaly.transaction.balanceAfterCentimes !== undefined && (
            <Row label="Solde après">
              <AmountFCFA value={anomaly.transaction.balanceAfterCentimes} />
            </Row>
          )}
          <button
            onClick={() => props.onOpenPdfAt?.(anomaly.transaction.pdfPage)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"
          >
            Voir dans le PDF source
            <ExternalLink className="w-3 h-3" />
          </button>
        </Section>

        {/* Section: Détection */}
        <Section title="Détection">
          <Row label="Algorithme">
            <span className="font-mono text-xs">{anomaly.detection.algorithm}</span>
          </Row>
          <Row label="Confiance">
            <span className="text-xs">{Math.round(anomaly.detection.confidence * 100)}%</span>
          </Row>
          <Row label="Règle">
            <span className="text-xs text-ink-700">{anomaly.detection.rule}</span>
          </Row>
        </Section>

        {/* Section: Workflow */}
        <Section title="Workflow">
          <WorkflowSteps anomaly={anomaly} className="mb-3" />
          <div className="space-y-3">
            {comments.filter((c) => c.anomalyId === anomaly.id).map((c) => (
              <div key={c.id} className="text-xs">
                <div className="flex items-center gap-2 mb-0.5">
                  <UserPill user={{ userId: c.author.userId, handle: c.author.handle, role: c.author.role }} />
                  <span className="text-ink-400">·</span>
                  <RelativeDate date={c.createdAt} className="text-ink-500" />
                </div>
                <div className="pl-7 text-ink-700 whitespace-pre-wrap">{c.content}</div>
              </div>
            ))}
            <MentionInput
              value={draft}
              onChange={setDraft}
              candidates={team}
              onSubmit={(text, mentions) => {
                if (text.trim()) {
                  props.onSubmitComment(text.trim(), mentions);
                  setDraft('');
                }
              }}
              placeholder="Ajouter un commentaire… @mention possible (Ctrl+Enter)"
            />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (draft.trim()) {
                    props.onSubmitComment(draft.trim(), extractMentions(draft, team));
                    setDraft('');
                  }
                }}
                disabled={!draft.trim()}
                className="px-2.5 py-1 text-[11px] bg-amber-600 text-white rounded disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </div>
        </Section>

        {/* Section: Convention */}
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

        {/* Section: Actions */}
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

        {/* Section: Audit trail */}
        <Section
          title={`Audit trail · ${auditTrail.filter((e) => e.entityId === anomaly.id).length} entrées`}
          collapsible
          open={auditOpen}
          onToggle={() => setAuditOpen((v) => !v)}
        >
          {auditOpen && (
            <ul className="space-y-2 text-xs">
              {auditTrail.filter((e) => e.entityId === anomaly.id).map((e) => (
                <li key={e.id} className="border-l-2 border-canvas-300 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-900">{ACTION_LABEL[e.action]}</span>
                    <span className="text-ink-400">par</span>
                    <span className="font-mono text-ink-700">@{e.actor.handle}</span>
                  </div>
                  <div className="text-[10px] text-ink-500 font-mono mt-0.5">
                    {e.createdAt} · hash {e.hash.slice(0, 12)}…
                  </div>
                  {e.payload.comment && (
                    <div className="text-[11px] text-ink-600 italic mt-0.5">"{e.payload.comment}"</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface SectionProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}

function Section({ title, children, collapsible, open, onToggle }: SectionProps) {
  return (
    <div className="border-t border-canvas-100 pt-3">
      <div
        className={`flex items-center justify-between mb-2 ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? onToggle : undefined}
      >
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">{title}</h3>
        {collapsible && (
          <button className="text-[10px] text-ink-500">{open ? '▲' : '▼'}</button>
        )}
      </div>
      {(!collapsible || open) && <div>{children}</div>}
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

function extractMentions(text: string, team: MentionableUser[]): string[] {
  const handles = Array.from(text.matchAll(/@(\w+)/g)).map((m) => m[1]);
  return team.filter((u) => handles.includes(u.handle)).map((u) => u.userId);
}

const ACTION_LABEL: Record<string, string> = {
  created: 'Créée',
  assigned: 'Assignée',
  qualified: 'Qualifiée',
  commented: 'Commentaire',
  validated: 'Validée',
  signed: 'Signée',
  closed: 'Clôturée',
  reopened: 'Réouverte',
  false_positive_marked: 'Faux positif',
  severity_changed: 'Sévérité modifiée',
};
