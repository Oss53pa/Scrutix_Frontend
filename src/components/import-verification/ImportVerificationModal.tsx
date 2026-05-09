// ============================================================================
// ATLASBANX — Import Verification Modal
// ============================================================================
// Post-import review modal. Bi-mode (statement / conditions). Composes:
//   - Left  60% : PdfViewerWithOverlay (gold-highlighted bbox of focused row)
//   - Right 40% : Toolbar + SanityCheckBanner + VerificationTable
//   - Footer    : Cancel / Save Draft / Validate & Import
//
// Persistence: when persistDraft=true, edits and per-row state are debounced
// (800ms) into atlasbanx.import_drafts via useVerificationState. Existing
// drafts (matched on user_id + sourceHash + mode) are auto-loaded.
//
// Auto-validation: any row with confidence >= AUTO_VALIDATE_CONFIDENCE (0.9)
// is pre-checked on mount. The user can adjust the threshold via a slider.
// ============================================================================

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  X,
  Loader2,
  Save,
  CheckCheck,
  Sparkles,
  ListChecks,
  CheckCircle2 as CircleCheck,
  XCircle as CircleX,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { PdfViewerWithOverlay } from './PdfViewerWithOverlay';
import { VerificationTable } from './VerificationTable';
import { SanityCheckBanner } from './SanityCheckBanner';
import { useVerificationState } from './useVerificationState';
import {
  type CommitArgs,
  type CommitResult,
  type ConditionRow,
  type StatementRow,
  type VerificationPayload,
  AUTO_VALIDATE_CONFIDENCE,
  getEffective,
} from './types';
import {
  hashFile,
  importDraftsRepo,
  type ImportDraftRow,
} from '../../lib/repositories/importDraftsRepo';
import { useAuthStore } from '../../store/authStore';
import { TransactionType, type Transaction } from '../../types';

interface Props {
  /** PDF file (or other document) being verified. */
  file: File;
  /** Initial extraction payload — what extractStatement / DocumentIntelligenceEngine produced. */
  initialPayload: VerificationPayload;
  /** Called with the validated rows when the user clicks "Importer".
   *  The parent commits to the domain stores (transactions, conditions, …). */
  onCommit: (args: CommitArgs, result: CommitResult) => void | Promise<void>;
  /** Called when the user cancels (no commit). */
  onCancel: () => void;
  /** When true, persist edits to atlasbanx.import_drafts. Default: true. */
  persistDraft?: boolean;
  /** Open / close (declarative). */
  open: boolean;
}

export function ImportVerificationModal({
  file,
  initialPayload,
  onCommit,
  onCancel,
  persistDraft = true,
  open,
}: Props) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [resolvedPayload, setResolvedPayload] = useState<VerificationPayload | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [committing, setCommitting] = useState(false);

  // ─── Resolve draft (load existing or create new) ─────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setDraftLoading(true);
      if (!persistDraft || !userId) {
        if (!cancelled) {
          setResolvedPayload(initialPayload);
          setDraftId(null);
          setDraftLoading(false);
        }
        return;
      }
      try {
        const sourceHash = await hashFile(file);
        const existing: ImportDraftRow | null = await importDraftsRepo
          .findByHash(userId, sourceHash, initialPayload.mode)
          .catch(() => null);

        if (existing && existing.status === 'draft') {
          if (!cancelled) {
            // Merge: keep server payload (preserves user edits) but if shapes
            // mismatch (extractor changed), fall back to initial.
            const serverPayload = existing.payload as unknown as VerificationPayload;
            setResolvedPayload(
              isCompatiblePayload(serverPayload, initialPayload) ? serverPayload : initialPayload,
            );
            setDraftId(existing.id);
          }
        } else {
          const created = await importDraftsRepo.insert(userId, {
            source_hash: sourceHash,
            mode: initialPayload.mode,
            file_name: initialPayload.fileName,
            bank_code: initialPayload.bankCode ?? null,
            client_id: initialPayload.clientId ?? null,
            payload: initialPayload as unknown as Record<string, unknown>,
          }).catch(() => null);
          if (!cancelled) {
            setResolvedPayload(initialPayload);
            setDraftId(created?.id ?? null);
          }
        }
      } catch (err) {
        console.warn('[ImportVerificationModal] Draft resolve failed:', err);
        if (!cancelled) {
          setResolvedPayload(initialPayload);
          setDraftId(null);
        }
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, file, userId, persistDraft, initialPayload]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Vérification de l'import"
    >
      <div className="relative w-full max-w-[1600px] h-[92vh] flex flex-col bg-canvas-50 rounded-card-lg shadow-elevation-3 ring-1 ring-primary-200/60 overflow-hidden">
        {draftLoading || !resolvedPayload ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-ink-500">
              <Loader2 className="w-7 h-7 animate-spin text-accent-600" />
              <p className="text-sm uppercase tracking-[0.18em]">Préparation du brouillon…</p>
            </div>
          </div>
        ) : (
          <ModalBody
            file={file}
            payload={resolvedPayload}
            draftId={draftId}
            persistDraft={persistDraft}
            committing={committing}
            onCommit={async (args, result) => {
              setCommitting(true);
              try {
                await onCommit(args, result);
                if (draftId) await importDraftsRepo.commit(draftId).catch(() => undefined);
              } finally {
                setCommitting(false);
              }
            }}
            onCancel={async () => {
              if (draftId) await importDraftsRepo.cancel(draftId).catch(() => undefined);
              onCancel();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// MODAL BODY
// ───────────────────────────────────────────────────────────────────────────

function ModalBody({
  file,
  payload,
  draftId,
  persistDraft,
  committing,
  onCommit,
  onCancel,
}: {
  file: File;
  payload: VerificationPayload;
  draftId: string | null;
  persistDraft: boolean;
  committing: boolean;
  onCommit: (args: CommitArgs, result: CommitResult) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const state = useVerificationState({
    draftId,
    initialPayload: payload,
    persistDraft,
  });

  const allBoxes = useMemo(
    () =>
      state.rows
        .filter((r) => !!r.boundingBox)
        .map((r) => ({ rowId: r.id, box: r.boundingBox! })),
    [state.rows],
  );

  const focusedRow = state.rows.find((r) => r.id === state.focusedRowId) ?? null;
  const focusedBox = focusedRow?.boundingBox ?? null;

  const stats = useMemo(() => {
    const total = state.rows.length;
    const validated = state.rows.filter((r) => r.state === 'validated').length;
    const rejected = state.rows.filter((r) => r.state === 'rejected').length;
    const pending = total - validated - rejected;
    const lowConfidence = state.rows.filter((r) => r.confidence < 0.65).length;
    const meanConfidence = total === 0 ? 0 : state.rows.reduce((s, r) => s + r.confidence, 0) / total;
    return { total, validated, rejected, pending, lowConfidence, meanConfidence };
  }, [state.rows]);

  const handleCommit = useCallback(async () => {
    const args: CommitArgs = {
      mode: payload.mode,
      bankCode: payload.bankCode,
      clientId: payload.clientId,
      rows: state.rows,
    };
    const result = computeCommitResult(args);
    await onCommit(args, result);
  }, [state.rows, payload.bankCode, payload.clientId, payload.mode, onCommit]);

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  return (
    <>
      {/* HEADER */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-primary-200/60 bg-white/60 backdrop-blur">
        <div className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center text-accent-700 shrink-0">
          <ListChecks className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink-900 truncate">
            {payload.mode === 'statement'
              ? 'Vérification du relevé bancaire'
              : 'Vérification des conditions tarifaires'}
          </h2>
          <p className="text-xs text-ink-500 truncate">
            {payload.fileName} ·{' '}
            {payload.bankCode ? <span className="font-medium">{payload.bankCode}</span> : 'banque non identifiée'}
            {' · '}
            extrait le {new Date(payload.extractedAt).toLocaleString('fr-FR')}
          </p>
        </div>
        {persistDraft && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-ink-500 mr-2">
            {state.isSaving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Enregistrement…
              </>
            ) : state.lastSavedAt ? (
              <>
                <CircleCheck className="w-3 h-3 text-emerald-500" />
                Brouillon enregistré
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                Brouillon
              </>
            )}
          </div>
        )}
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-canvas-200 text-ink-500"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-primary-200/60 bg-canvas-50">
        <Stat label="Lignes" value={stats.total} tone="neutral" />
        <Stat label="Validées" value={stats.validated} tone="emerald" />
        <Stat label="En attente" value={stats.pending} tone="ink" />
        <Stat label="Rejetées" value={stats.rejected} tone="red" />
        <Stat label="Confiance ⌀" value={`${Math.round(stats.meanConfidence * 100)}%`} tone="accent" />

        <div className="ml-auto flex items-center gap-2">
          {/* Auto-validate threshold */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-pill bg-white border border-primary-200/70">
            <Sparkles className="w-3.5 h-3.5 text-accent-600" />
            <label htmlFor="threshold" className="text-[11px] text-ink-600 select-none">
              Auto-valider ≥
            </label>
            <input
              id="threshold"
              type="range"
              min={50}
              max={100}
              step={1}
              value={Math.round(state.threshold * 100)}
              onChange={(e) => state.setThreshold(parseInt(e.target.value, 10) / 100)}
              className="w-24 accent-accent-600"
            />
            <span className="text-[11px] font-medium text-ink-800 tabular-nums w-9 text-right">
              {Math.round(state.threshold * 100)}%
            </span>
            <button
              onClick={() => state.applyAutoValidate()}
              className="ml-1 p-1 rounded hover:bg-canvas-200 text-ink-500"
              title="Réappliquer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bulk actions */}
          <button
            onClick={state.validateAll}
            className="text-xs px-2.5 py-1 rounded-pill border border-emerald-200 text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1"
          >
            <CircleCheck className="w-3.5 h-3.5" />
            Tout valider
          </button>
          <button
            onClick={state.rejectAll}
            className="text-xs px-2.5 py-1 rounded-pill border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
          >
            <CircleX className="w-3.5 h-3.5" />
            Tout rejeter
          </button>
          <button
            onClick={state.clearAllStates}
            className="text-xs px-2.5 py-1 rounded-pill border border-primary-200 text-ink-600 hover:bg-canvas-200 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        </div>
      </div>

      {/* SPLIT BODY */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT — PDF (60%) */}
        <div className="w-[60%] border-r border-primary-200/60 min-w-0">
          {isPdf ? (
            <PdfViewerWithOverlay
              file={file}
              focusedBox={focusedBox}
              allBoxes={allBoxes}
              onBoxClick={state.setFocusedRowId}
              className="h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center p-8 bg-canvas-100 text-ink-500 text-sm">
              <div className="text-center max-w-xs">
                <p className="font-medium text-ink-700">Aperçu indisponible</p>
                <p className="mt-1 text-xs">
                  Le fichier d'origine n'est pas un PDF — la prévisualisation visuelle n'est pas disponible. Tu peux
                  toujours réviser et valider les lignes à droite.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Table + sanity (40%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-canvas-50">
          <SanityCheckBanner rows={state.rows} mode={payload.mode} />
          <div className="flex-1 min-h-0">
            <VerificationTable
              rows={state.rows}
              mode={payload.mode}
              focusedRowId={state.focusedRowId}
              onFocus={state.setFocusedRowId}
              onToggleValidation={state.toggleRowValidation}
              onSetState={state.setRowState}
              onPatch={state.patchRowData}
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-primary-200/60 bg-white/60 backdrop-blur">
        <p className="text-xs text-ink-500">
          {stats.validated > 0 ? (
            <>
              <span className="font-semibold text-ink-900">{stats.validated}</span> ligne
              {stats.validated > 1 ? 's' : ''} prête{stats.validated > 1 ? 's' : ''} à être importée
              {stats.validated > 1 ? 's' : ''}
              {stats.rejected > 0 && (
                <>
                  {' · '}
                  <span className="text-red-600">{stats.rejected} rejetée{stats.rejected > 1 ? 's' : ''}</span>
                </>
              )}
              {stats.pending > 0 && (
                <>
                  {' · '}
                  <span className="text-amber-700">
                    {stats.pending} en attente
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              Aucune ligne validée — utilise <em>Tout valider</em> ou coche manuellement les lignes que tu veux importer.
            </>
          )}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-canvas-200"
          >
            Annuler
          </button>
          <button
            onClick={handleCommit}
            disabled={committing || stats.validated === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
          >
            {committing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Import en cours…
              </>
            ) : (
              <>
                <CheckCheck className="w-4 h-4" />
                Importer {stats.validated} ligne{stats.validated > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────

const STAT_TONES: Record<string, { label: string; value: string; bg: string }> = {
  neutral: { label: 'text-ink-500',     value: 'text-ink-900',      bg: 'bg-canvas-100' },
  emerald: { label: 'text-emerald-700', value: 'text-emerald-700',  bg: 'bg-emerald-50' },
  ink:     { label: 'text-ink-500',     value: 'text-ink-700',      bg: 'bg-canvas-100' },
  red:     { label: 'text-red-700',     value: 'text-red-700',      bg: 'bg-red-50' },
  accent:  { label: 'text-accent-700',  value: 'text-accent-800',   bg: 'bg-accent-50' },
};

function Stat({ label, value, tone }: { label: string; value: number | string; tone: keyof typeof STAT_TONES }) {
  const t = STAT_TONES[tone];
  return (
    <div className={`flex items-baseline gap-1.5 px-2.5 py-1 rounded-pill ${t.bg}`}>
      <span className={`text-[10px] uppercase tracking-[0.1em] ${t.label}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${t.value}`}>{value}</span>
    </div>
  );
}

/** Detect if a server-side payload is compatible (same shape, same row count). */
function isCompatiblePayload(server: VerificationPayload, initial: VerificationPayload): boolean {
  if (!server || server.mode !== initial.mode) return false;
  if (!Array.isArray(server.rows)) return false;
  // Allow row-count to drift slightly (extractor improvements) but not wildly.
  // If counts differ by >25% we abandon the draft to avoid ghost rows.
  const a = server.rows.length;
  const b = initial.rows.length;
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) / Math.max(a, b, 1) <= 0.25;
}

/** Build the final commit payload from the rows. */
function computeCommitResult(args: CommitArgs): CommitResult {
  const validated = args.rows.filter((r) => r.state === 'validated');
  const rejected = args.rows.filter((r) => r.state === 'rejected').length;

  if (args.mode === 'statement') {
    const now = new Date();
    const transactions: Transaction[] = (validated as StatementRow[]).map((row) => {
      const dateStr = (getEffective(row, 'date') as string) ?? '';
      const valueDateStr = (getEffective(row, 'valueDate') as string | undefined) ?? dateStr;
      const description = (getEffective(row, 'description') as string) ?? '';
      const amount = (getEffective(row, 'amount') as number) ?? 0;
      const balance = (getEffective(row, 'balance') as number | undefined) ?? 0;
      const reference = getEffective(row, 'reference') as string | undefined;
      return {
        id: row.id,
        clientId: args.clientId ?? '',
        accountNumber: '',
        bankCode: args.bankCode ?? '',
        date: new Date(dateStr),
        valueDate: new Date(valueDateStr),
        amount,
        balance,
        description,
        reference,
        type: amount < 0 ? TransactionType.DEBIT : TransactionType.CREDIT,
        createdAt: now,
        updatedAt: now,
      };
    });
    return { transactions, validated: validated.length, rejected };
  }

  // Conditions
  const conditions: Record<string, { value: number; unit?: string; qualitative?: string }> = {};
  for (const row of validated as ConditionRow[]) {
    const key = getEffective(row, 'rubricKey') as string | undefined;
    if (!key) continue;
    const value = (getEffective(row, 'value') as number) ?? 0;
    const unit = getEffective(row, 'unit') as string | undefined;
    const qualitative = getEffective(row, 'qualitative') as string | undefined;
    conditions[key] = { value, unit, qualitative };
  }
  return { conditions, validated: validated.length, rejected };
}

export { AUTO_VALIDATE_CONFIDENCE };
