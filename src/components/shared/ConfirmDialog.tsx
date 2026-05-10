// ============================================================================
// <ConfirmDialog /> — dialog avec hash + délai anti-double-clic
// ============================================================================
// Spec §1.5 : récap action en langage naturel, commentaire optionnel
// (obligatoire pour reject/false_positive), affichage du hash SHA-256 qui
// sera produit, primaire désactivé 1.5s pour éviter le double-clic.
// ============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  /** Hash SHA-256 (court) qui sera produit côté serveur après confirmation. */
  futureHash?: string;
  /** Si true, un commentaire est requis avant validation. */
  requireComment?: boolean;
  /** Label commentaire (par défaut: "Commentaire"). */
  commentLabel?: string;
  /** Texte d'aide sous le commentaire. */
  commentHelp?: string;
  /** Variante : 'danger' colore le bouton primaire en rouge. */
  variant?: 'default' | 'danger' | 'success';
  /** Label du bouton primaire. */
  confirmLabel: string;
  /** Label du bouton secondaire (par défaut: "Annuler"). */
  cancelLabel?: string;
  /** Callback appelé avec le commentaire au confirm. */
  onConfirm: (comment: string) => Promise<void> | void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open,
    onClose,
    title,
    description,
    futureHash,
    requireComment = false,
    commentLabel = 'Commentaire',
    commentHelp,
    variant = 'default',
    confirmLabel,
    cancelLabel = 'Annuler',
    onConfirm,
  } = props;

  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [armed, setArmed] = useState(false);

  // Anti-double-clic : 1.5s avant que le bouton primaire soit cliquable
  useEffect(() => {
    if (!open) return;
    setArmed(false);
    setComment('');
    const t = setTimeout(() => setArmed(true), 1500);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const canConfirm = armed && !submitting && (!requireComment || comment.trim().length > 0);

  const variantClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : variant === 'success'
        ? 'bg-emerald-600 hover:bg-emerald-700'
        : 'bg-amber-600 hover:bg-amber-700';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between p-4 border-b border-canvas-200">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-canvas-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm text-ink-700">
          <div>{description}</div>

          {requireComment || true ? (
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                {commentLabel} {requireComment && <span className="text-rose-600">*</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 text-sm border border-canvas-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder={requireComment ? 'Justification obligatoire…' : 'Optionnel'}
              />
              {commentHelp && (
                <p className="text-[10px] text-ink-500 mt-1">{commentHelp}</p>
              )}
            </div>
          ) : null}

          {futureHash && (
            <div className="flex items-start gap-2 text-[10px] text-ink-500 bg-canvas-50 px-2 py-1.5 rounded border border-canvas-200">
              <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
              <div>
                <div>Hash d'audit après confirmation :</div>
                <div className="font-mono text-ink-700">{futureHash}</div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-[10px] text-ink-500">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            Cette action sera consignée dans la piste d'audit immuable.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-3 border-t border-canvas-200 bg-canvas-50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded border border-canvas-300 bg-white hover:bg-canvas-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            disabled={!canConfirm}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm(comment.trim());
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded text-white font-semibold ${variantClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {submitting ? 'En cours…' : armed ? confirmLabel : 'Patientez 1,5s…'}
          </button>
        </div>
      </div>
    </div>
  );
}
