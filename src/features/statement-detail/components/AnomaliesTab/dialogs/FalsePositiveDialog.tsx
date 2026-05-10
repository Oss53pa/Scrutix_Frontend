// ============================================================================
// FalsePositiveDialog — marque une anomalie comme faux positif
// ============================================================================

import { ConfirmDialog } from '../../../../../components/shared';
import type { Anomaly } from '../../../types/statement.types';

interface FalsePositiveDialogProps {
  anomaly: Anomaly;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
}

export function FalsePositiveDialog({ anomaly, futureHash, onClose, onConfirm }: FalsePositiveDialogProps) {
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Marquer comme faux positif"
      variant="danger"
      confirmLabel="Marquer faux positif"
      requireComment
      commentLabel="Justification"
      futureHash={futureHash}
      description={
        <span>
          Vous indiquez que <b>{anomaly.title}</b> n'est <b>pas</b> une anomalie réelle.
          Elle sera retirée des indicateurs et des rapports.
        </span>
      }
      onConfirm={onConfirm}
    />
  );
}
