// ============================================================================
// SignDialog — signature électronique DG (anomalie critique)
// ============================================================================

import { ConfirmDialog, AmountFCFA } from '../../../../../components/shared';
import type { Anomaly } from '../../../types/statement.types';

interface SignDialogProps {
  anomaly: Anomaly;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
}

export function SignDialog({ anomaly, futureHash, onClose, onConfirm }: SignDialogProps) {
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Signer et clôturer cette anomalie"
      variant="success"
      confirmLabel="Signer et clôturer"
      requireComment
      commentLabel="Commentaire de signature"
      futureHash={futureHash}
      description={
        <span>
          Vous allez signer électroniquement la clôture de <b>{anomaly.title}</b>
          {' '}(montant <AmountFCFA value={Math.abs(anomaly.transaction.amountCentimes)} />).
          {' '}Cette signature sera transmise à ADVIST et incluse dans le rapport final
          du relevé. Elle est légalement opposable.
        </span>
      }
      onConfirm={onConfirm}
    />
  );
}
