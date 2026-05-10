// ============================================================================
// RejectDialog — renvoie une anomalie au statut précédent
// ============================================================================

import { ConfirmDialog } from '../../../../../components/shared';
import type { Anomaly } from '../../../types/statement.types';

interface RejectDialogProps {
  anomaly: Anomaly;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
}

export function RejectDialog({ anomaly, futureHash, onClose, onConfirm }: RejectDialogProps) {
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Rejeter / renvoyer pour revue"
      variant="danger"
      confirmLabel="Rejeter"
      requireComment
      commentLabel="Motif du rejet"
      futureHash={futureHash}
      description={
        <span>
          L'anomalie <b>{anomaly.title}</b> sera renvoyée à l'étape précédente avec ce motif.
        </span>
      }
      onConfirm={onConfirm}
    />
  );
}
