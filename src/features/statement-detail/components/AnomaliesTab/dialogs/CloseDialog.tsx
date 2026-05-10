// ============================================================================
// CloseDialog — clôture définitive d'une anomalie
// ============================================================================

import { ConfirmDialog } from '../../../../../components/shared';
import type { Anomaly } from '../../../types/statement.types';

interface CloseDialogProps {
  anomaly: Anomaly;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
}

export function CloseDialog({ anomaly, futureHash, onClose, onConfirm }: CloseDialogProps) {
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Clôturer cette anomalie"
      variant="success"
      confirmLabel="Clôturer"
      futureHash={futureHash}
      description={
        <span>
          <b>{anomaly.title}</b> sera marquée comme clôturée. Cette action est traçable
          mais peut être réouverte ultérieurement par un senior+.
        </span>
      }
      onConfirm={onConfirm}
    />
  );
}
