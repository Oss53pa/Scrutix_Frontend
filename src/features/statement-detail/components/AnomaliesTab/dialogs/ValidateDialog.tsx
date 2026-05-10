// ============================================================================
// ValidateDialog — validation senior d'une anomalie qualifiée
// ============================================================================

import { ConfirmDialog } from '../../../../../components/shared';
import type { Anomaly } from '../../../types/statement.types';

interface ValidateDialogProps {
  anomaly: Anomaly;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
}

export function ValidateDialog({ anomaly, futureHash, onClose, onConfirm }: ValidateDialogProps) {
  const isCritical = anomaly.severity === 'critical';
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Valider cette anomalie"
      variant="default"
      confirmLabel="Valider"
      futureHash={futureHash}
      description={
        <span>
          Vous validez la qualification de <b>{anomaly.title}</b>
          {isCritical
            ? <>. Cette anomalie passera en attente de signature DG.</>
            : <> et la rendez prête à clôturer.</>}
        </span>
      }
      onConfirm={onConfirm}
    />
  );
}
