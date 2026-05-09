// ============================================================================
// ATLASBANX — Verification state hook
// ============================================================================
// Manages the in-modal review state:
//   • per-row pending/validated/rejected
//   • per-row user edits
//   • debounced server-side persistence (atlasbanx.import_drafts)
//   • auto-validation threshold
//   • bulk actions
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { importDraftsRepo } from '../../lib/repositories';
import {
  AUTO_VALIDATE_CONFIDENCE,
  type ConditionRow,
  type RowState,
  type StatementRow,
  type VerificationMode,
  type VerificationPayload,
} from './types';

type AnyRow = StatementRow | ConditionRow;

export interface UseVerificationStateArgs {
  draftId: string | null;
  initialPayload: VerificationPayload;
  /** When true, persist changes to Supabase (debounced 800ms). */
  persistDraft?: boolean;
  autoValidateThreshold?: number;
}

export interface UseVerificationStateReturn {
  rows: AnyRow[];
  mode: VerificationMode;
  threshold: number;
  setThreshold: (n: number) => void;
  /** Counts of each state for the toolbar */
  counts: { pending: number; validated: number; rejected: number; total: number };
  /** Currently focused row id (drives PDF highlight) */
  focusedRowId: string | null;
  setFocusedRowId: (id: string | null) => void;
  /** Per-row updaters */
  setRowState: (id: string, state: RowState) => void;
  toggleRowValidation: (id: string) => void;
  patchRowData: (id: string, patch: Record<string, unknown>) => void;
  /** Bulk actions */
  validateAll: () => void;
  rejectAll: () => void;
  clearAllStates: () => void;
  /** Re-run auto-validate using current threshold */
  applyAutoValidate: (newThreshold?: number) => void;
  /** Server-persistence flag */
  isSaving: boolean;
  lastSavedAt: Date | null;
}

export function useVerificationState({
  draftId,
  initialPayload,
  persistDraft = true,
  autoValidateThreshold = AUTO_VALIDATE_CONFIDENCE,
}: UseVerificationStateArgs): UseVerificationStateReturn {
  const [rows, setRows] = useState<AnyRow[]>(() =>
    autoValidateInit(initialPayload.rows, autoValidateThreshold),
  );
  const [threshold, setThreshold] = useState(autoValidateThreshold);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, validated: 0, rejected: 0, total: rows.length };
    for (const r of rows) {
      c[r.state]++;
    }
    return c;
  }, [rows]);

  // ─── Per-row updates ──────────────────────────────────────────────────
  const setRowState = useCallback((id: string, state: RowState) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, state } : r)));
  }, []);

  const toggleRowValidation = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.state === 'validated') return { ...r, state: 'pending' };
        return { ...r, state: 'validated' };
      }),
    );
  }, []);

  const patchRowData = useCallback((id: string, patch: Record<string, unknown>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          edits: { ...(r.edits ?? {}), ...patch },
        } as AnyRow;
      }),
    );
  }, []);

  // ─── Bulk actions ─────────────────────────────────────────────────────
  const validateAll = useCallback(() => {
    setRows((prev) => prev.map((r) => ({ ...r, state: 'validated' })));
  }, []);

  const rejectAll = useCallback(() => {
    setRows((prev) => prev.map((r) => ({ ...r, state: 'rejected' })));
  }, []);

  const clearAllStates = useCallback(() => {
    setRows((prev) => prev.map((r) => ({ ...r, state: 'pending' })));
  }, []);

  const applyAutoValidate = useCallback(
    (newThreshold?: number) => {
      const t = newThreshold ?? threshold;
      if (newThreshold !== undefined) setThreshold(newThreshold);
      setRows((prev) =>
        prev.map((r) => {
          // Don't override explicit user choices (rejected stays rejected)
          if (r.state === 'rejected') return r;
          return { ...r, state: r.confidence >= t ? 'validated' : 'pending' };
        }),
      );
    },
    [threshold],
  );

  // ─── Debounced server persistence ─────────────────────────────────────
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef<string>('');

  useEffect(() => {
    if (!persistDraft || !draftId) return;
    const payload: VerificationPayload = {
      ...initialPayload,
      rows,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      setIsSaving(true);
      await importDraftsRepo.update(
        draftId,
        payload as unknown as Record<string, unknown>,
      );
      setIsSaving(false);
      setLastSavedAt(new Date());
    }, 800);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [rows, draftId, persistDraft, initialPayload]);

  return {
    rows,
    mode: initialPayload.mode,
    threshold,
    setThreshold,
    counts,
    focusedRowId,
    setFocusedRowId,
    setRowState,
    toggleRowValidation,
    patchRowData,
    validateAll,
    rejectAll,
    clearAllStates,
    applyAutoValidate,
    isSaving,
    lastSavedAt,
  };
}

/** Pre-validate any row whose confidence ≥ threshold on first mount. */
function autoValidateInit(rows: AnyRow[], threshold: number): AnyRow[] {
  return rows.map((r) => {
    if (r.state !== 'pending') return r;
    return r.confidence >= threshold ? { ...r, state: 'validated' } : r;
  });
}
